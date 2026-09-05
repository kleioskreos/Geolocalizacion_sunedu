package main

import "testing"

func TestMatchOnePrefersConfirmedLink(t *testing.T) {
	catalog := []School{{MapID: "school-a", Nombre: "Otro nombre", CodigoModular: "7654321"}}
	result := matchOne(InstitutionInput{ID: "matricula-42", Nombre: "Texto que cambió"}, catalog, map[string]knownInstitutionLink{"matricula-42": {SchoolID: "school-a"}})
	if result.Status != "matched" || result.School == nil || result.School.MapID != "school-a" || result.Reason != "Vínculo confirmado" {
		t.Fatalf("resultado inesperado: %#v", result)
	}
}

func TestMatchOneNormalizesInstitutionPrefixAndPlace(t *testing.T) {
	catalog := []School{{MapID: "school-a", Nombre: "12345", DreUgel: "UGEL PUNO"}}
	result := matchOne(InstitutionInput{ID: "matricula-42", Nombre: "I.E. Nro. 12345", Lugar: "UGEL PUNO"}, catalog, nil)
	if result.Status != "matched" || result.School == nil || result.Reason != "Nombre y lugar exactos" {
		t.Fatalf("resultado inesperado: %#v", result)
	}
}

func TestMatchOneUsesConfirmedAlias(t *testing.T) {
	catalog := []School{{MapID: "school-a", Nombre: "COLEGIO SAN JOSE"}}
	links := map[string]knownInstitutionLink{"old-id": {SchoolID: "school-a", Aliases: []string{"COL. SAN JOSÉ"}}}
	result := matchOne(InstitutionInput{Nombre: "COL SAN JOSE"}, catalog, links)
	if result.Status != "matched" || result.School == nil || result.Reason != "Alias confirmado" {
		t.Fatalf("resultado inesperado: %#v", result)
	}
}

func TestMatchOneDoesNotAutoSelectSimilarName(t *testing.T) {
	catalog := []School{{MapID: "school-a", Nombre: "Colegio San José", DreUgel: "UGEL CUSCO"}}
	result := matchOne(InstitutionInput{Nombre: "San Jose", Lugar: "UGEL CUSCO"}, catalog, nil)
	if result.Status != "needs_review" || result.School != nil || len(result.Candidates) != 1 {
		t.Fatalf("se esperaba una revisión, se obtuvo %#v", result)
	}
}
