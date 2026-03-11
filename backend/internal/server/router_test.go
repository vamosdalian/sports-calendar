package server

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"runtime"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
	"golang.org/x/time/rate"

	"github.com/vamosdalian/sports-calendar/backend/internal/repository"
	"github.com/vamosdalian/sports-calendar/backend/internal/service"
)

func testRouter(t *testing.T) *gin.Engine {
	t.Helper()
	_, currentFile, _, _ := runtime.Caller(0)
	catalogPath := filepath.Join(filepath.Dir(currentFile), "..", "..", "..", "shared", "mock", "catalog.json")
	repo, err := repository.NewMockRepository(filepath.Clean(catalogPath))
	if err != nil {
		t.Fatalf("load repository: %v", err)
	}
	logger := logrus.New()
	logger.SetOutput(io.Discard)
	return NewRouter(logger, service.New(repo), rate.NewLimiter(rate.Limit(100), 100))
}

func TestYears(t *testing.T) {
	router := testRouter(t)
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/years", nil)

	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("unexpected status: %d", recorder.Code)
	}

	var payload map[string]any
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode payload: %v", err)
	}
	years, ok := payload["years"].([]any)
	if !ok || len(years) == 0 {
		t.Fatalf("expected years in response")
	}
}

func TestLeaguesDefaultLocale(t *testing.T) {
	router := testRouter(t)
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/leagues?year=2026", nil)

	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("unexpected status: %d", recorder.Code)
	}

	var payload map[string]any
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode payload: %v", err)
	}
	items, ok := payload["items"].([]any)
	if !ok || len(items) == 0 {
		t.Fatalf("expected sports items in response")
	}
	firstItem, ok := items[0].(map[string]any)
	if !ok {
		t.Fatalf("expected first item object")
	}
	if _, exists := firstItem["sportNames"]; exists {
		t.Fatalf("expected localized field sportName, got sportNames")
	}
	if _, exists := firstItem["sportName"]; !exists {
		t.Fatalf("expected sportName in default response")
	}
}

func TestLeaguesLocalized(t *testing.T) {
	router := testRouter(t)
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/leagues?year=2026&lang=zh", nil)

	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("unexpected status: %d", recorder.Code)
	}

	var payload map[string]any
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode payload: %v", err)
	}
	items, ok := payload["items"].([]any)
	if !ok || len(items) == 0 {
		t.Fatalf("expected sports items in response")
	}
	firstItem, ok := items[0].(map[string]any)
	if !ok {
		t.Fatalf("expected first item object")
	}
	if _, exists := firstItem["sportNames"]; exists {
		t.Fatalf("expected localized field sportName, got sportNames")
	}
	if _, exists := firstItem["sportName"]; !exists {
		t.Fatalf("expected sportName in localized response")
	}
}

func TestSeasonDetailLocalized(t *testing.T) {
	router := testRouter(t)
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/sports/csl/2026?lang=zh", nil)

	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("unexpected status: %d", recorder.Code)
	}

	var payload map[string]any
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode payload: %v", err)
	}
	if _, exists := payload["leagueNames"]; exists {
		t.Fatalf("expected localized field leagueName, got leagueNames")
	}
	if _, exists := payload["leagueName"]; !exists {
		t.Fatalf("expected leagueName in localized response")
	}
}

func TestSeasonDetailDefaultLocaleWhenEmptyLang(t *testing.T) {
	router := testRouter(t)
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/sports/csl/2026?lang=", nil)

	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("unexpected status: %d", recorder.Code)
	}

	var payload map[string]any
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode payload: %v", err)
	}
	if _, exists := payload["leagueNames"]; exists {
		t.Fatalf("expected single-field response, got leagueNames")
	}
	if _, exists := payload["leagueName"]; !exists {
		t.Fatalf("expected leagueName in default response")
	}
}

func TestICSFeed(t *testing.T) {
	router := testRouter(t)
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/ics/football/csl/2026/matches.ics", nil)

	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("unexpected status: %d", recorder.Code)
	}
	if got := recorder.Header().Get("Content-Type"); got == "" {
		t.Fatalf("expected content type")
	}
	if len(recorder.Body.Bytes()) == 0 {
		t.Fatalf("expected calendar body")
	}
}
