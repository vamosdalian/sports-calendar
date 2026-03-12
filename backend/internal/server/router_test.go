package server

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
	"golang.org/x/time/rate"

	"github.com/vamosdalian/sports-calendar/backend/internal/domain"
	"github.com/vamosdalian/sports-calendar/backend/internal/service"
)

type fakeRepository struct{}

func testRouter(t *testing.T) *gin.Engine {
	t.Helper()
	logger := logrus.New()
	logger.SetOutput(io.Discard)
	return NewRouter(logger, service.New(fakeRepository{}), rate.NewLimiter(rate.Limit(100), 100))
}

func (fakeRepository) ListYears(_ context.Context) ([]int, string, error) {
	return []int{2026, 2025}, "2026-03-10T00:00:00Z", nil
}

func (fakeRepository) ListSportsByYear(_ context.Context, year int) ([]domain.SportsYearItem, string, error) {
	if year != 2026 {
		return []domain.SportsYearItem{}, "2026-03-10T00:00:00Z", nil
	}
	return []domain.SportsYearItem{
		{
			SportSlug:  "football",
			SportNames: domain.LocalizedText{"en": "Football", "zh": "足球"},
			Leagues: []domain.LeagueSeasonReference{
				{
					LeagueSlug:  "csl",
					LeagueNames: domain.LocalizedText{"en": "Chinese Super League", "zh": "中超"},
					Seasons:     []domain.SeasonReference{{Slug: "2026", Label: "2026"}},
				},
			},
		},
	}, "2026-03-10T00:00:00Z", nil
}

func (fakeRepository) GetLeagueSeason(_ context.Context, leagueSlug, seasonSlug string) (domain.SeasonDetail, error) {
	if leagueSlug != "csl" {
		return domain.SeasonDetail{}, domain.ErrNotFound
	}
	selectedSeason := seasonSlug
	if selectedSeason == "" {
		selectedSeason = "2026"
	}
	if selectedSeason != "2026" {
		return domain.SeasonDetail{}, domain.ErrNotFound
	}
	return domain.SeasonDetail{
		SportSlug:                   "football",
		SportNames:                  domain.LocalizedText{"en": "Football", "zh": "足球"},
		LeagueSlug:                  "csl",
		LeagueNames:                 domain.LocalizedText{"en": "Chinese Super League", "zh": "中超"},
		SeasonSlug:                  "2026",
		SeasonLabel:                 "2026",
		DefaultMatchDurationMinutes: 120,
		AvailableSeasons:            []domain.SeasonReference{{Slug: "2026", Label: "2026"}},
		CalendarDescription:         domain.LocalizedText{"en": "Season calendar", "zh": "赛程日历"},
		DataSourceNote:              domain.LocalizedText{"en": "Test data", "zh": "测试数据"},
		Notes:                       domain.LocalizedText{"en": "Note", "zh": "备注"},
		Matches: []domain.Match{
			{
				ID:       "csl-2026-r1-guoan-shenhua",
				Round:    domain.LocalizedText{"en": "Round 1", "zh": "第1轮"},
				StartsAt: "2026-03-14T11:35:00Z",
				Status:   "scheduled",
				Venue:    domain.LocalizedText{"en": "Workers Stadium", "zh": "工人体育场"},
				City:     domain.LocalizedText{"en": "Beijing", "zh": "北京"},
				HomeTeam: &domain.Team{Slug: "beijing-guoan", Names: domain.LocalizedText{"en": "Beijing Guoan", "zh": "北京国安"}},
				AwayTeam: &domain.Team{Slug: "shanghai-shenhua", Names: domain.LocalizedText{"en": "Shanghai Shenhua", "zh": "上海申花"}},
			},
		},
		UpdatedAt: "2026-03-10T00:00:00Z",
	}, nil
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
	if _, exists := payload["countryName"]; exists {
		t.Fatalf("expected countryName to be removed")
	}
	if _, exists := payload["timezone"]; exists {
		t.Fatalf("expected timezone to be removed")
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
