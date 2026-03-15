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

func (fakeRepository) ListLeagues(_ context.Context) ([]domain.SportDirectoryItem, string, error) {
	return []domain.SportDirectoryItem{
		{
			SportSlug:  "football",
			SportNames: domain.LocalizedText{"en": "Football", "zh": "足球"},
			Leagues: []domain.LeagueReference{
				{
					LeagueSlug:    "csl",
					LeagueNames:   domain.LocalizedText{"en": "Chinese Super League", "zh": "中超"},
					DefaultSeason: domain.SeasonReference{Slug: "2026", Label: "2026"},
				},
			},
		},
	}, "2026-03-10T00:00:00Z", nil
}

func (fakeRepository) ListLeagueSeasons(_ context.Context, sportSlug, leagueSlug string) (domain.LeagueSeasons, error) {
	if sportSlug != "football" || leagueSlug != "csl" {
		return domain.LeagueSeasons{}, domain.ErrNotFound
	}
	return domain.LeagueSeasons{
		SportSlug:   "football",
		SportNames:  domain.LocalizedText{"en": "Football", "zh": "足球"},
		LeagueSlug:  "csl",
		LeagueNames: domain.LocalizedText{"en": "Chinese Super League", "zh": "中超"},
		Seasons:     []domain.SeasonReference{{Slug: "2026", Label: "2026"}, {Slug: "2025", Label: "2025"}},
		UpdatedAt:   "2026-03-10T00:00:00Z",
	}, nil
}

func (fakeRepository) GetLeagueSeason(_ context.Context, sportSlug, leagueSlug, seasonSlug string) (domain.SeasonDetail, error) {
	if sportSlug != "football" || leagueSlug != "csl" || seasonSlug != "2026" {
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

func TestLeaguesDefaultLocale(t *testing.T) {
	router := testRouter(t)
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/leagues", nil)

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
	request := httptest.NewRequest(http.MethodGet, "/api/leagues?lang=zh", nil)

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

func TestLeagueSeasonsLocalized(t *testing.T) {
	router := testRouter(t)
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/football/csl/seasons?lang=zh", nil)

	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("unexpected status: %d", recorder.Code)
	}

	var payload map[string]any
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode payload: %v", err)
	}
	if _, exists := payload["leagueName"]; !exists {
		t.Fatalf("expected leagueName in localized response")
	}
	seasons, ok := payload["seasons"].([]any)
	if !ok || len(seasons) != 2 {
		t.Fatalf("expected seasons in response")
	}
}

func TestSeasonDetailLocalized(t *testing.T) {
	router := testRouter(t)
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/football/csl/2026?lang=zh", nil)

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
	groups, ok := payload["groups"].([]any)
	if !ok || len(groups) != 1 {
		t.Fatalf("expected grouped matches in response")
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
