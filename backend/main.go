package main

import (
	"context"
	"crypto/sha256"
	_ "embed"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"math"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/cors"
	"github.com/gofiber/fiber/v3/middleware/limiter"
	"github.com/gofiber/fiber/v3/middleware/recover"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

//go:embed schema.sql
var schema string

type School struct {
	MapID             string  `json:"mapId,omitempty"`
	CodigoInstitucion string  `json:"codigoInstitucion"`
	CodigoModular     string  `json:"codigoModular"`
	Nombre            string  `json:"nombre"`
	Ubigeo            string  `json:"ubigeo"`
	Departamento      string  `json:"departamento"`
	Provincia         string  `json:"provincia"`
	Distrito          string  `json:"distrito"`
	CodigoDreUgel     string  `json:"codigoDreUgel"`
	DreUgel           string  `json:"dreUgel"`
	CentroPoblado     string  `json:"centroPoblado"`
	CodigoLocal       string  `json:"codigoLocal"`
	Direccion         string  `json:"direccion"`
	Nivel             string  `json:"nivel"`
	Gestion           string  `json:"gestion"`
	Lat               float64 `json:"lat"`
	Lng               float64 `json:"lng"`
	Altitud           string  `json:"altitud"`
	FuenteCoordenadas string  `json:"fuenteCoordenadas"`
}

func (s School) validate() error {
	if strings.TrimSpace(s.CodigoModular) == "" || strings.TrimSpace(s.Nombre) == "" || strings.TrimSpace(s.Nivel) == "" {
		return errors.New("código modular, nombre y nivel son obligatorios")
	}
	if math.IsNaN(s.Lat) || math.IsNaN(s.Lng) || math.IsInf(s.Lat, 0) || math.IsInf(s.Lng, 0) || s.Lat < -90 || s.Lat > 90 || s.Lng < -180 || s.Lng > 180 || (s.Lat == 0 && s.Lng == 0) {
		return errors.New("coordenadas inválidas")
	}
	return nil
}

func (s School) key() string {
	sum := sha256.Sum256([]byte(s.CodigoModular + "\x00" + s.Nivel + "\x00" + s.CodigoLocal))
	return hex.EncodeToString(sum[:])
}

func upsert(ctx context.Context, tx pgx.Tx, s School) error {
	data, err := json.Marshal(s)
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `INSERT INTO schools(id,data) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data,updated_at=now()`, s.key(), data)
	return err
}

type server struct{ db *pgxpool.Pool }

func (s *server) schools(c fiber.Ctx) error {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	rows, err := s.db.Query(ctx, "SELECT id,data FROM schools ORDER BY data->>'nombre',id")
	if err != nil {
		return err
	}
	defer rows.Close()
	result := make([]json.RawMessage, 0)
	for rows.Next() {
		var id string
		var data []byte
		if err = rows.Scan(&id, &data); err != nil {
			return err
		}
		var school School
		if err = json.Unmarshal(data, &school); err != nil {
			return err
		}
		school.MapID = id
		payload, err := json.Marshal(school)
		if err != nil {
			return err
		}
		result = append(result, json.RawMessage(payload))
	}
	if err = rows.Err(); err != nil {
		return err
	}
	return c.JSON(fiber.Map{"schools": result, "total": len(result), "source": "Padrón local importado; sin sincronización automática con MINEDU"})
}

func (s *server) authorize(c fiber.Ctx) error {
	auth := strings.TrimPrefix(c.Get("Authorization"), "Basic ")
	decoded, err := base64.StdEncoding.DecodeString(auth)
	_, password, ok := strings.Cut(string(decoded), ":")
	user := os.Getenv("ADMIN_USER")
	if err != nil || !ok || len(password) > 72 {
		return fiber.NewError(401, "Contraseña incorrecta")
	}
	var hash string
	err = s.db.QueryRow(context.Background(), "SELECT password_hash FROM administrators WHERE username=$1", user).Scan(&hash)
	if err != nil {
		hash = "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy"
	}
	valid := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	if err != nil || valid != nil {
		return fiber.NewError(401, "Contraseña incorrecta")
	}
	return c.Next()
}

func initialize(ctx context.Context, db *pgxpool.Pool) error {
	if _, err := db.Exec(ctx, schema); err != nil {
		return err
	}
	user, pass := os.Getenv("ADMIN_USER"), os.Getenv("ADMIN_PASSWORD")
	if user == "" || len(pass) < 8 || len(pass) > 72 {
		return errors.New("configure ADMIN_USER y ADMIN_PASSWORD (8 a 72 bytes)")
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(pass), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	if _, err = db.Exec(ctx, `INSERT INTO administrators(username,password_hash) VALUES($1,$2) ON CONFLICT(username) DO UPDATE SET password_hash=EXCLUDED.password_hash`, user, string(hash)); err != nil {
		return err
	}
	tx, err := db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err = tx.Exec(ctx, "LOCK TABLE schools IN EXCLUSIVE MODE"); err != nil {
		return err
	}
	var count int
	if err = tx.QueryRow(ctx, "SELECT count(*) FROM schools").Scan(&count); err != nil {
		return err
	}
	if count == 0 && os.Getenv("SEED_FILE") != "" {
		file, err := os.Open(os.Getenv("SEED_FILE"))
		if err != nil {
			return err
		}
		defer file.Close()
		var data []School
		if err = json.NewDecoder(file).Decode(&data); err != nil {
			return err
		}
		for i, school := range data {
			if err = school.validate(); err != nil {
				return fmt.Errorf("semilla fila %d: %w", i+1, err)
			}
			if err = upsert(ctx, tx, school); err != nil {
				return err
			}
		}
		log.Printf("Carga inicial: %d filas procesadas", len(data))
	}
	return tx.Commit(ctx)
}

func main() {
	ctx := context.Background()
	db, err := pgxpool.New(ctx, os.Getenv("DATABASE_URL"))
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()
	if err = initialize(ctx, db); err != nil {
		log.Fatal(err)
	}
	s := &server{db: db}
	app := fiber.New(fiber.Config{BodyLimit: 20 * 1024 * 1024, ReadTimeout: 30 * time.Second, WriteTimeout: 120 * time.Second, ErrorHandler: func(c fiber.Ctx, err error) error {
		code := 500
		message := "No se pudo completar la operación"
		var e *fiber.Error
		if errors.As(err, &e) {
			code = e.Code
			message = e.Message
		} else {
			log.Printf("request error: %v", err)
		}
		return c.Status(code).JSON(fiber.Map{"error": message})
	}})
	app.Use(recover.New())
	if origin := os.Getenv("FRONTEND_URL"); origin != "" {
		app.Use(cors.New(cors.Config{AllowOrigins: []string{origin}, AllowMethods: []string{"GET", "POST", "OPTIONS"}, AllowHeaders: []string{"Origin", "Content-Type", "Accept", "Authorization", "X-Integration-Key"}}))
	}
	app.Get("/api/health", func(c fiber.Ctx) error {
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		if err := db.Ping(ctx); err != nil {
			return fiber.NewError(503, "Base de datos no disponible")
		}
		return c.JSON(fiber.Map{"status": "ok"})
	})
	app.Get("/api/schools", s.schools)
	app.Post("/api/integration/sessions", limiter.New(limiter.Config{Max: 30, Expiration: time.Minute}), s.integrationAuthorize, s.createMatchSession)
	app.Get("/api/integration/sessions/:id", s.getMatchSession)
	app.Post("/api/integration/links", limiter.New(limiter.Config{Max: 20, Expiration: time.Minute}), s.authorize, s.saveInstitutionLink)
	app.Get("/api/import/template", template)
	app.Post("/api/import", limiter.New(limiter.Config{Max: 10, Expiration: time.Minute}), s.authorize, s.importXLSX)
	go func() {
		sig := make(chan os.Signal, 1)
		signal.Notify(sig, os.Interrupt, syscall.SIGTERM)
		<-sig
		_ = app.ShutdownWithTimeout(10 * time.Second)
	}()
	log.Fatal(app.Listen(":8091"))
}
