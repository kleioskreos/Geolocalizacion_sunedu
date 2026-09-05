package main

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/xuri/excelize/v2"
)

var columns = []string{"codigoInstitucion", "codigoModular", "nombre", "ubigeo", "departamento", "provincia", "distrito", "codigoDreUgel", "dreUgel", "centroPoblado", "codigoLocal", "direccion", "nivel", "gestion", "lat", "lng", "altitud", "fuenteCoordenadas"}
var aliases = map[string]string{"codigoinstitucion": "codigoInstitucion", "codigomodular": "codigoModular", "nombredessee": "nombre", "codigodreugel": "codigoDreUgel", "dreugel": "dreUgel", "centropoblado": "centroPoblado", "codigolocal": "codigoLocal", "nivelmodalidad": "nivel", "gestiondependencia": "gestion", "latitud": "lat", "longitud": "lng", "fuentedecoordenadas": "fuenteCoordenadas"}

func normalize(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	s = strings.NewReplacer("á", "a", "é", "e", "í", "i", "ó", "o", "ú", "u", "ü", "u").Replace(s)
	return strings.Map(func(r rune) rune {
		if r >= 'a' && r <= 'z' {
			return r
		}
		return -1
	}, s)
}

func parseRow(headers, row []string) (School, error) {
	values := map[string]any{}
	for i, header := range headers {
		v := ""
		if i < len(row) {
			v = strings.TrimSpace(row[i])
		}
		if header == "" {
			continue
		}
		if header == "lat" || header == "lng" {
			f, err := strconv.ParseFloat(strings.ReplaceAll(v, ",", "."), 64)
			if err != nil {
				return School{}, fmt.Errorf("%s debe ser un número", header)
			}
			values[header] = f
		} else {
			values[header] = v
		}
	}
	data, err := json.Marshal(values)
	if err != nil {
		return School{}, err
	}
	var s School
	if err = json.Unmarshal(data, &s); err != nil {
		return s, err
	}
	return s, s.validate()
}

func template(c fiber.Ctx) error {
	f := excelize.NewFile()
	defer f.Close()
	for i, col := range columns {
		cell, _ := excelize.CoordinatesToCellName(i+1, 1)
		if err := f.SetCellValue("Sheet1", cell, col); err != nil {
			return err
		}
	}
	style, err := f.NewStyle(&excelize.Style{NumFmt: 49})
	if err != nil {
		return err
	}
	if err = f.SetColStyle("Sheet1", "A:R", style); err != nil {
		return err
	}
	_ = f.SetColWidth("Sheet1", "A", "R", 22)
	buf, err := f.WriteToBuffer()
	if err != nil {
		return err
	}
	c.Set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	c.Set("Content-Disposition", `attachment; filename="plantilla_escuelas.xlsx"`)
	return c.Send(buf.Bytes())
}

func (s *server) importXLSX(c fiber.Ctx) error {
	file, err := c.FormFile("file")
	if err != nil {
		return fiber.NewError(400, "Seleccione un archivo XLSX")
	}
	if !strings.HasSuffix(strings.ToLower(file.Filename), ".xlsx") {
		return fiber.NewError(400, "Solo se admiten archivos .xlsx; convierta los .xls en Excel o LibreOffice")
	}
	reader, err := file.Open()
	if err != nil {
		return err
	}
	defer reader.Close()
	book, err := excelize.OpenReader(reader, excelize.Options{UnzipSizeLimit: 100 * 1024 * 1024, UnzipXMLSizeLimit: 10 * 1024 * 1024})
	if err != nil {
		return fiber.NewError(400, "El archivo XLSX no es válido")
	}
	defer book.Close()
	sheets := book.GetSheetList()
	if len(sheets) == 0 {
		return fiber.NewError(400, "El libro no contiene hojas")
	}
	rows, err := book.Rows(sheets[0])
	if err != nil {
		return err
	}
	defer rows.Close()
	if !rows.Next() {
		return fiber.NewError(400, "La primera hoja está vacía")
	}
	raw, err := rows.Columns()
	if err != nil {
		return err
	}
	headers := make([]string, len(raw))
	seen := map[string]bool{}
	for i, h := range raw {
		n := normalize(h)
		key := aliases[n]
		if key == "" {
			for _, col := range columns {
				if normalize(col) == n {
					key = col
					break
				}
			}
		}
		if key != "" && seen[key] {
			return fiber.NewError(400, "Columna repetida: "+key)
		}
		headers[i] = key
		seen[key] = true
	}
	for _, key := range []string{"codigoModular", "nombre", "nivel", "lat", "lng"} {
		if !seen[key] {
			return fiber.NewError(400, "Falta la columna "+key)
		}
	}
	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	count := 0
	line := 1
	keys := map[string]bool{}
	for rows.Next() {
		line++
		if line > 100001 {
			return fiber.NewError(400, "Máximo 100 000 filas por importación")
		}
		row, err := rows.Columns()
		if err != nil {
			return fiber.NewError(400, "No se pudo leer la hoja")
		}
		if strings.TrimSpace(strings.Join(row, "")) == "" {
			continue
		}
		school, err := parseRow(headers, row)
		if err != nil {
			return fiber.NewError(400, fmt.Sprintf("Fila %d: %s. No se guardaron cambios.", line, err))
		}
		if keys[school.key()] {
			return fiber.NewError(400, fmt.Sprintf("Fila %d: servicio duplicado dentro del archivo", line))
		}
		keys[school.key()] = true
		if err = upsert(ctx, tx, school); err != nil {
			return err
		}
		count++
	}
	if err = rows.Error(); err != nil {
		return err
	}
	if count == 0 {
		return fiber.NewError(400, "El archivo no contiene servicios")
	}
	if err = tx.Commit(ctx); err != nil {
		return err
	}
	return c.JSON(fiber.Map{"imported": count, "message": "Servicios importados correctamente"})
}
