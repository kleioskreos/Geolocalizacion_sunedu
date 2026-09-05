package main

import (
	"math"
	"testing"
)

func TestParseRowPreservesCodes(t *testing.T) {
	s, err := parseRow([]string{"codigoModular", "nombre", "nivel", "lat", "lng"}, []string{"0012345", "Escuela de prueba", "Primaria", "-15,5", "-70.2"})
	if err != nil {
		t.Fatal(err)
	}
	if s.CodigoModular != "0012345" || s.Lat != -15.5 {
		t.Fatalf("Códigos o coordenadas alterados: %+v", s)
	}
}

func TestInvalidCoordinates(t *testing.T) {
	for _, point := range [][2]float64{{0, 0}, {91, 20}, {20, -181}, {math.NaN(), 0}, {0, math.Inf(1)}} {
		s := School{CodigoModular: "001", Nombre: "Prueba", Nivel: "Primaria", Lat: point[0], Lng: point[1]}
		if s.validate() == nil {
			t.Errorf("Se aceptaron coordenadas inválidas: %v", point)
		}
	}
}

func TestHeaderNormalization(t *testing.T) {
	for raw, want := range map[string]string{"Código Modular": "codigoModular", "Nombre de SS.EE.": "nombre", "Nivel / Modalidad": "nivel", "Gestión / Dependencia": "gestion", "Fuente de coordenadas": "fuenteCoordenadas"} {
		if got := aliases[normalize(raw)]; got != want {
			t.Errorf("%s = %s; esperado %s", raw, got, want)
		}
	}
}

func TestSchoolIdentity(t *testing.T) {
	a := School{CodigoModular: "001", Nivel: "Primaria", CodigoLocal: "001"}
	b := a
	b.Nombre = "Nombre actualizado"
	if a.key() != b.key() {
		t.Fatal("Cambiar un nombre no debe crear un duplicado")
	}
	b.Nivel = "Secundaria"
	if a.key() == b.key() {
		t.Fatal("Modalidades distintas no deben sobrescribirse")
	}
}
