package main

import (
	"context"
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"sort"
	"strings"
	"time"
	"unicode"

	"github.com/gofiber/fiber/v3"
)

const matchSessionLifetime = 24 * time.Hour

// InstitutionInput is the minimum contract expected from the enrolment system.
// The external ID must be stable: it lets a reviewed match remain correct if a
// school later changes its display name.
type InstitutionInput struct {
	ID                string `json:"id"`
	Nombre            string `json:"nombre"`
	Lugar             string `json:"lugar"`
	CodigoModular     string `json:"codigoModular"`
	CodigoInstitucion string `json:"codigoInstitucion"`
	CodigoLocal       string `json:"codigoLocal"`
}

type matchRequest struct {
	Instituciones []InstitutionInput `json:"instituciones"`
}

type matchCandidate struct {
	School School `json:"school"`
	Score  int    `json:"score"`
	Reason string `json:"reason"`
}

type institutionMatch struct {
	Institution InstitutionInput `json:"institution"`
	Status      string           `json:"status"`
	Reason      string           `json:"reason"`
	School      *School          `json:"school,omitempty"`
	Candidates  []matchCandidate `json:"candidates,omitempty"`
}

type matchSession struct {
	Results   []institutionMatch `json:"results"`
	CreatedAt time.Time          `json:"createdAt"`
	ExpiresAt time.Time          `json:"expiresAt"`
}

type institutionLinkRequest struct {
	ExternalID    string   `json:"externalId"`
	SchoolID      string   `json:"schoolId"`
	ExternalName  string   `json:"externalName"`
	ExternalPlace string   `json:"externalPlace"`
	Aliases       []string `json:"aliases"`
}

type knownInstitutionLink struct {
	SchoolID string
	Aliases  []string
}

func (s *server) integrationAuthorize(c fiber.Ctx) error {
	key := os.Getenv("INTEGRATION_API_KEY")
	provided := c.Get("X-Integration-Key")
	if len(key) < 24 {
		return fiber.NewError(503, "La integración no está configurada")
	}
	if subtle.ConstantTimeCompare([]byte(provided), []byte(key)) != 1 {
		return fiber.NewError(401, "Credencial de integración incorrecta")
	}
	return c.Next()
}

func (s *server) createMatchSession(c fiber.Ctx) error {
	publicMapURL := strings.TrimRight(strings.TrimSpace(os.Getenv("FRONTEND_URL")), "/")
	if publicMapURL == "" {
		return fiber.NewError(503, "La URL pública del mapa no está configurada")
	}
	var request matchRequest
	if err := c.Bind().Body(&request); err != nil {
		return fiber.NewError(400, "El cuerpo JSON no es válido")
	}
	if len(request.Instituciones) == 0 || len(request.Instituciones) > 300 {
		return fiber.NewError(400, "Envíe entre 1 y 300 instituciones")
	}
	for i := range request.Instituciones {
		request.Instituciones[i] = cleanInstitutionInput(request.Instituciones[i])
		if request.Instituciones[i].Nombre == "" && request.Instituciones[i].CodigoModular == "" && request.Instituciones[i].CodigoInstitucion == "" && request.Instituciones[i].CodigoLocal == "" {
			return fiber.NewError(400, fmt.Sprintf("Institución %d: indique un nombre o un código", i+1))
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	catalog, links, err := s.matchCatalog(ctx)
	if err != nil {
		return err
	}
	results := make([]institutionMatch, 0, len(request.Instituciones))
	for _, institution := range request.Instituciones {
		results = append(results, matchOne(institution, catalog, links))
	}

	now := time.Now().UTC()
	session := matchSession{Results: results, CreatedAt: now, ExpiresAt: now.Add(matchSessionLifetime)}
	payload, err := json.Marshal(session)
	if err != nil {
		return err
	}
	id, err := newSessionID()
	if err != nil {
		return err
	}
	// Removing expired snapshots during a new request keeps this table bounded
	// without requiring a scheduler on Dokploy.
	if _, err = s.db.Exec(ctx, "DELETE FROM match_sessions WHERE expires_at <= now()"); err != nil {
		return err
	}
	if _, err = s.db.Exec(ctx, "INSERT INTO match_sessions(id,data,expires_at) VALUES($1,$2,$3)", id, payload, session.ExpiresAt); err != nil {
		return err
	}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"sessionId": id,
		"mapUrl":    publicMapURL + "/?match=" + id,
		"expiresAt": session.ExpiresAt,
		"summary":   summarizeMatches(results),
		"results":   results,
	})
}

func (s *server) getMatchSession(c fiber.Ctx) error {
	id := strings.TrimSpace(c.Params("id"))
	if len(id) != 48 {
		return fiber.NewError(404, "Sesión no encontrada")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	var data []byte
	err := s.db.QueryRow(ctx, "SELECT data FROM match_sessions WHERE id=$1 AND expires_at > now()", id).Scan(&data)
	if err != nil {
		return fiber.NewError(404, "Sesión no encontrada o vencida")
	}
	return c.Type("json").Send(data)
}

func (s *server) saveInstitutionLink(c fiber.Ctx) error {
	var request institutionLinkRequest
	if err := c.Bind().Body(&request); err != nil {
		return fiber.NewError(400, "El cuerpo JSON no es válido")
	}
	request.ExternalID = strings.TrimSpace(request.ExternalID)
	request.SchoolID = strings.TrimSpace(request.SchoolID)
	if request.ExternalID == "" || request.SchoolID == "" || len(request.ExternalID) > 160 || len(request.SchoolID) > 100 {
		return fiber.NewError(400, "externalId y schoolId son obligatorios")
	}
	aliases, err := json.Marshal(request.Aliases)
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	var exists bool
	if err = s.db.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM schools WHERE id=$1)", request.SchoolID).Scan(&exists); err != nil {
		return err
	}
	if !exists {
		return fiber.NewError(404, "El servicio educativo seleccionado no existe")
	}
	_, err = s.db.Exec(ctx, `INSERT INTO institution_links(external_id,school_id,external_name,external_place,aliases)
		VALUES($1,$2,$3,$4,$5)
		ON CONFLICT(external_id) DO UPDATE SET school_id=EXCLUDED.school_id, external_name=EXCLUDED.external_name,
		external_place=EXCLUDED.external_place, aliases=EXCLUDED.aliases, updated_at=now()`,
		request.ExternalID, request.SchoolID, strings.TrimSpace(request.ExternalName), strings.TrimSpace(request.ExternalPlace), aliases)
	if err != nil {
		return err
	}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"externalId": request.ExternalID, "schoolId": request.SchoolID})
}

func (s *server) matchCatalog(ctx context.Context) ([]School, map[string]knownInstitutionLink, error) {
	rows, err := s.db.Query(ctx, "SELECT id,data FROM schools")
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()
	catalog := make([]School, 0)
	for rows.Next() {
		var id string
		var data []byte
		if err = rows.Scan(&id, &data); err != nil {
			return nil, nil, err
		}
		var school School
		if err = json.Unmarshal(data, &school); err != nil {
			return nil, nil, err
		}
		school.MapID = id
		catalog = append(catalog, school)
	}
	if err = rows.Err(); err != nil {
		return nil, nil, err
	}
	links := make(map[string]knownInstitutionLink)
	linkRows, err := s.db.Query(ctx, "SELECT external_id,school_id,external_name,aliases FROM institution_links")
	if err != nil {
		return nil, nil, err
	}
	defer linkRows.Close()
	for linkRows.Next() {
		var externalID, schoolID, externalName string
		var aliasesJSON []byte
		if err = linkRows.Scan(&externalID, &schoolID, &externalName, &aliasesJSON); err != nil {
			return nil, nil, err
		}
		var aliases []string
		if err = json.Unmarshal(aliasesJSON, &aliases); err != nil {
			return nil, nil, err
		}
		if strings.TrimSpace(externalName) != "" {
			aliases = append(aliases, externalName)
		}
		links[externalID] = knownInstitutionLink{SchoolID: schoolID, Aliases: aliases}
	}
	return catalog, links, linkRows.Err()
}

func matchOne(institution InstitutionInput, catalog []School, links map[string]knownInstitutionLink) institutionMatch {
	byID := make(map[string]School, len(catalog))
	for _, school := range catalog {
		byID[school.MapID] = school
	}
	if institution.ID != "" {
		if link, ok := links[institution.ID]; ok {
			if school, present := byID[link.SchoolID]; present {
				return institutionMatch{Institution: institution, Status: "matched", Reason: "Vínculo confirmado", School: &school}
			}
		}
	}

	codeCandidates := make([]matchCandidate, 0)
	for _, school := range catalog {
		if matchesAnExplicitCode(institution, school) {
			codeCandidates = append(codeCandidates, matchCandidate{School: school, Score: 100, Reason: "Código exacto"})
		}
	}
	if len(codeCandidates) == 1 {
		school := codeCandidates[0].School
		return institutionMatch{Institution: institution, Status: "matched", Reason: codeCandidates[0].Reason, School: &school}
	}
	if len(codeCandidates) > 1 {
		return institutionMatch{Institution: institution, Status: "needs_review", Reason: "El código corresponde a más de un servicio", Candidates: codeCandidates}
	}

	name := canonicalInstitutionName(institution.Nombre)
	if name == "" {
		return institutionMatch{Institution: institution, Status: "unmatched", Reason: "No existe un vínculo confirmado para esta institución"}
	}
	linkedCandidates := make([]matchCandidate, 0)
	linkedIDs := make(map[string]bool)
	for _, link := range links {
		for _, alias := range link.Aliases {
			if canonicalInstitutionName(alias) != name || linkedIDs[link.SchoolID] {
				continue
			}
			if school, present := byID[link.SchoolID]; present {
				linkedCandidates = append(linkedCandidates, matchCandidate{School: school, Score: 100, Reason: "Alias confirmado"})
				linkedIDs[link.SchoolID] = true
			}
		}
	}
	if len(linkedCandidates) == 1 {
		school := linkedCandidates[0].School
		return institutionMatch{Institution: institution, Status: "matched", Reason: linkedCandidates[0].Reason, School: &school}
	}
	if len(linkedCandidates) > 1 {
		return institutionMatch{Institution: institution, Status: "needs_review", Reason: "El alias confirmado corresponde a más de un servicio", Candidates: linkedCandidates}
	}
	exact := make([]matchCandidate, 0)
	for _, school := range catalog {
		if canonicalInstitutionName(school.Nombre) == name {
			score := 90
			reason := "Nombre exacto"
			if locationCompatible(institution.Lugar, school) {
				score = 100
				reason = "Nombre y lugar exactos"
			}
			exact = append(exact, matchCandidate{School: school, Score: score, Reason: reason})
		}
	}
	if len(exact) == 1 {
		school := exact[0].School
		return institutionMatch{Institution: institution, Status: "matched", Reason: exact[0].Reason, School: &school}
	}
	if len(exact) > 1 {
		return institutionMatch{Institution: institution, Status: "needs_review", Reason: "Hay varias instituciones con el mismo nombre", Candidates: rankCandidates(exact)}
	}

	// Suggestions are intentionally never selected automatically. A wrong map
	// point is more harmful than asking an administrator to confirm it once.
	suggestions := make([]matchCandidate, 0)
	for _, school := range catalog {
		score := nameSimilarity(name, canonicalInstitutionName(school.Nombre))
		if score >= 55 {
			if locationCompatible(institution.Lugar, school) {
				score += 15
			}
			suggestions = append(suggestions, matchCandidate{School: school, Score: score, Reason: "Nombre similar; requiere confirmación"})
		}
	}
	if len(suggestions) > 0 {
		return institutionMatch{Institution: institution, Status: "needs_review", Reason: "No hay una coincidencia exacta", Candidates: rankCandidates(suggestions)}
	}
	return institutionMatch{Institution: institution, Status: "unmatched", Reason: "No se encontró una institución compatible"}
}

func cleanInstitutionInput(input InstitutionInput) InstitutionInput {
	input.ID = strings.TrimSpace(input.ID)
	input.Nombre = strings.TrimSpace(input.Nombre)
	input.Lugar = strings.TrimSpace(input.Lugar)
	input.CodigoModular = strings.TrimSpace(input.CodigoModular)
	input.CodigoInstitucion = strings.TrimSpace(input.CodigoInstitucion)
	input.CodigoLocal = strings.TrimSpace(input.CodigoLocal)
	return input
}

func matchesAnExplicitCode(input InstitutionInput, school School) bool {
	return (input.CodigoModular != "" && matchNormalize(input.CodigoModular) == matchNormalize(school.CodigoModular)) ||
		(input.CodigoInstitucion != "" && matchNormalize(input.CodigoInstitucion) == matchNormalize(school.CodigoInstitucion)) ||
		(input.CodigoLocal != "" && matchNormalize(input.CodigoLocal) == matchNormalize(school.CodigoLocal))
}

func matchNormalize(value string) string {
	var b strings.Builder
	previousSpace := true
	for _, r := range strings.ToUpper(strings.TrimSpace(value)) {
		switch r {
		case 'Á', 'À', 'Ä', 'Â':
			r = 'A'
		case 'É', 'È', 'Ë', 'Ê':
			r = 'E'
		case 'Í', 'Ì', 'Ï', 'Î':
			r = 'I'
		case 'Ó', 'Ò', 'Ö', 'Ô':
			r = 'O'
		case 'Ú', 'Ù', 'Ü', 'Û':
			r = 'U'
		case 'Ñ':
			r = 'N'
		}
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			b.WriteRune(r)
			previousSpace = false
		} else if !previousSpace {
			b.WriteByte(' ')
			previousSpace = true
		}
	}
	return strings.TrimSpace(b.String())
}

func canonicalInstitutionName(value string) string {
	ignored := map[string]bool{"I": true, "E": true, "IE": true, "IEI": true, "NRO": true, "NUMERO": true, "N": true, "INSTITUCION": true, "EDUCATIVA": true}
	kept := make([]string, 0)
	for _, token := range strings.Fields(matchNormalize(value)) {
		if !ignored[token] {
			kept = append(kept, token)
		}
	}
	return strings.Join(kept, " ")
}

func locationCompatible(place string, school School) bool {
	place = matchNormalize(place)
	if len(place) < 4 {
		return false
	}
	for _, candidate := range []string{school.DreUgel, school.Departamento, school.Provincia, school.Distrito, school.CentroPoblado} {
		candidate = matchNormalize(candidate)
		if len(candidate) >= 4 && (strings.Contains(place, candidate) || strings.Contains(candidate, place)) {
			return true
		}
	}
	return false
}

func nameSimilarity(left, right string) int {
	if left == "" || right == "" {
		return 0
	}
	leftTokens, rightTokens := strings.Fields(left), strings.Fields(right)
	seen := make(map[string]bool, len(leftTokens))
	for _, token := range leftTokens {
		seen[token] = true
	}
	shared := 0
	for _, token := range rightTokens {
		if seen[token] {
			shared++
		}
	}
	denominator := len(leftTokens) + len(rightTokens) - shared
	if denominator == 0 {
		return 100
	}
	return shared * 100 / denominator
}

func rankCandidates(candidates []matchCandidate) []matchCandidate {
	sort.Slice(candidates, func(i, j int) bool {
		if candidates[i].Score == candidates[j].Score {
			return candidates[i].School.Nombre < candidates[j].School.Nombre
		}
		return candidates[i].Score > candidates[j].Score
	})
	if len(candidates) > 5 {
		return candidates[:5]
	}
	return candidates
}

func newSessionID() (string, error) {
	bytes := make([]byte, 24)
	if _, err := rand.Read(bytes); err != nil {
		return "", errors.New("no se pudo crear la sesión de coincidencias")
	}
	return hex.EncodeToString(bytes), nil
}

func summarizeMatches(results []institutionMatch) map[string]int {
	summary := map[string]int{"matched": 0, "needs_review": 0, "unmatched": 0}
	for _, result := range results {
		summary[result.Status]++
	}
	return summary
}
