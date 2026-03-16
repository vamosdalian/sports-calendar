package server

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
	"golang.org/x/crypto/bcrypt"
	"golang.org/x/time/rate"

	"github.com/vamosdalian/sports-calendar/backend/internal/auth"
	"github.com/vamosdalian/sports-calendar/backend/internal/domain"
	"github.com/vamosdalian/sports-calendar/backend/internal/service"
)

type fakeRepository struct {
	mu            sync.Mutex
	nextSeasonID  int64
	nextUserID    int64
	sportsBySlug  map[string]domain.SportRecord
	leaguesBySlug map[string]domain.LeagueRecord
	seasonsByKey  map[string]domain.SeasonRecord
	seasonMatches map[string]int
	usersByEmail  map[string]fakeUser
}

type fakeUser struct {
	record       domain.UserRecord
	passwordHash string
}

func newFakeRepository() *fakeRepository {
	now := "2026-03-10T00:00:00Z"
	return &fakeRepository{
		nextSeasonID: 2,
		nextUserID:   1,
		sportsBySlug: map[string]domain.SportRecord{
			"football": {
				ID:        1,
				Slug:      "football",
				Name:      domain.LocalizedText{"en": "Football", "zh": "足球"},
				CreatedAt: now,
				UpdatedAt: now,
			},
		},
		leaguesBySlug: map[string]domain.LeagueRecord{
			"csl": {
				ID:           1001,
				SportSlug:    "football",
				Slug:         "csl",
				Name:         domain.LocalizedText{"en": "Chinese Super League", "zh": "中超"},
				SyncInterval: "@daily",
				CreatedAt:    now,
				UpdatedAt:    now,
			},
		},
		seasonsByKey: map[string]domain.SeasonRecord{
			"football/csl/2026": {
				ID:                          1,
				SportSlug:                   "football",
				LeagueSlug:                  "csl",
				Slug:                        "2026",
				Label:                       "2026",
				StartYear:                   2026,
				EndYear:                     2026,
				DefaultMatchDurationMinutes: 120,
				CreatedAt:                   now,
				UpdatedAt:                   now,
			},
		},
		seasonMatches: map[string]int{
			"football/csl/2026": 1,
		},
		usersByEmail: map[string]fakeUser{},
	}
}

func testRouter(t *testing.T) (*gin.Engine, *fakeRepository, *auth.Manager) {
	t.Helper()
	logger := logrus.New()
	logger.SetOutput(io.Discard)
	repo := newFakeRepository()
	svc := service.New(repo)
	manager, err := auth.NewManager("test-secret", 30*time.Minute)
	if err != nil {
		t.Fatalf("create test token manager: %v", err)
	}
	svc.SetTokenManager(manager)
	return NewRouter(logger, svc, rate.NewLimiter(rate.Limit(100), 100)), repo, manager
}

func (r *fakeRepository) ListLeagues(_ context.Context) ([]domain.SportDirectoryItem, string, error) {
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

func (r *fakeRepository) ListLeagueSeasons(_ context.Context, sportSlug, leagueSlug string) (domain.LeagueSeasons, error) {
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

func (r *fakeRepository) GetLeagueSeason(_ context.Context, sportSlug, leagueSlug, seasonSlug string) (domain.SeasonDetail, error) {
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

func (r *fakeRepository) CreateSport(_ context.Context, input domain.CreateSportInput) (domain.SportRecord, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, exists := r.sportsBySlug[input.Slug]; exists {
		return domain.SportRecord{}, domain.ErrConflict
	}
	for _, sport := range r.sportsBySlug {
		if sport.ID == input.ID {
			return domain.SportRecord{}, domain.ErrConflict
		}
	}
	now := time.Now().UTC().Format(time.RFC3339)
	record := domain.SportRecord{
		ID:        input.ID,
		Slug:      input.Slug,
		Name:      input.Name,
		CreatedAt: now,
		UpdatedAt: now,
	}
	r.sportsBySlug[input.Slug] = record
	return record, nil
}

func (r *fakeRepository) ListAdminSports(_ context.Context) (domain.AdminSportsResponse, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	items := make([]domain.AdminSportItem, 0, len(r.sportsBySlug))
	for _, sport := range r.sportsBySlug {
		items = append(items, domain.AdminSportItem{
			ID:        sport.ID,
			Slug:      sport.Slug,
			Name:      sport.Name,
			CreatedAt: sport.CreatedAt,
			UpdatedAt: sport.UpdatedAt,
		})
	}
	return domain.AdminSportsResponse{Items: items, UpdatedAt: "2026-03-10T00:00:00Z"}, nil
}

func (r *fakeRepository) ListAdminLeagues(_ context.Context, sportSlug string) (domain.AdminLeaguesResponse, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, exists := r.sportsBySlug[sportSlug]; !exists {
		return domain.AdminLeaguesResponse{}, domain.ErrNotFound
	}
	items := make([]domain.AdminLeagueItem, 0)
	for _, league := range r.leaguesBySlug {
		if league.SportSlug != sportSlug {
			continue
		}
		items = append(items, domain.AdminLeagueItem{
			ID:                  league.ID,
			SportSlug:           league.SportSlug,
			Slug:                league.Slug,
			Name:                league.Name,
			SyncInterval:        league.SyncInterval,
			CalendarDescription: league.CalendarDescription,
			DataSourceNote:      league.DataSourceNote,
			Notes:               league.Notes,
			CreatedAt:           league.CreatedAt,
			UpdatedAt:           league.UpdatedAt,
		})
	}
	return domain.AdminLeaguesResponse{SportSlug: sportSlug, Items: items, UpdatedAt: "2026-03-10T00:00:00Z"}, nil
}

func (r *fakeRepository) CountUsers(_ context.Context) (int64, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	return int64(len(r.usersByEmail)), nil
}

func (r *fakeRepository) CreateUser(_ context.Context, email, passwordHash string) (domain.UserRecord, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, exists := r.usersByEmail[email]; exists {
		return domain.UserRecord{}, domain.ErrConflict
	}
	now := time.Now().UTC().Format(time.RFC3339)
	record := domain.UserRecord{ID: r.nextUserID, Email: email, CreatedAt: now, UpdatedAt: now}
	r.nextUserID++
	r.usersByEmail[email] = fakeUser{record: record, passwordHash: passwordHash}
	return record, nil
}

func (r *fakeRepository) GetUserByEmail(_ context.Context, email string) (domain.UserRecord, string, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	user, exists := r.usersByEmail[email]
	if !exists {
		return domain.UserRecord{}, "", domain.ErrNotFound
	}
	return user.record, user.passwordHash, nil
}

func (r *fakeRepository) CreateLeague(_ context.Context, input domain.CreateLeagueInput) (domain.LeagueRecord, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, exists := r.sportsBySlug[input.SportSlug]; !exists {
		return domain.LeagueRecord{}, domain.ErrNotFound
	}
	if _, exists := r.leaguesBySlug[input.Slug]; exists {
		return domain.LeagueRecord{}, domain.ErrConflict
	}
	for _, league := range r.leaguesBySlug {
		if league.ID == input.ID {
			return domain.LeagueRecord{}, domain.ErrConflict
		}
	}
	now := time.Now().UTC().Format(time.RFC3339)
	record := domain.LeagueRecord{
		ID:                  input.ID,
		SportSlug:           input.SportSlug,
		Slug:                input.Slug,
		Name:                input.Name,
		SyncInterval:        input.SyncInterval,
		CalendarDescription: input.CalendarDescription,
		DataSourceNote:      input.DataSourceNote,
		Notes:               input.Notes,
		CreatedAt:           now,
		UpdatedAt:           now,
	}
	r.leaguesBySlug[input.Slug] = record
	return record, nil
}

func (r *fakeRepository) CreateSeason(_ context.Context, input domain.CreateSeasonInput) (domain.SeasonRecord, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	league, exists := r.leaguesBySlug[input.LeagueSlug]
	if !exists || league.SportSlug != input.SportSlug {
		return domain.SeasonRecord{}, domain.ErrNotFound
	}
	key := seasonKey(input.SportSlug, input.LeagueSlug, input.Slug)
	if _, exists := r.seasonsByKey[key]; exists {
		return domain.SeasonRecord{}, domain.ErrConflict
	}
	now := time.Now().UTC().Format(time.RFC3339)
	record := domain.SeasonRecord{
		ID:                          r.nextSeasonID,
		SportSlug:                   input.SportSlug,
		LeagueSlug:                  input.LeagueSlug,
		Slug:                        input.Slug,
		Label:                       input.Label,
		StartYear:                   input.StartYear,
		EndYear:                     input.EndYear,
		DefaultMatchDurationMinutes: input.DefaultMatchDurationMinutes,
		CreatedAt:                   now,
		UpdatedAt:                   now,
	}
	r.nextSeasonID++
	r.seasonsByKey[key] = record
	return record, nil
}

func (r *fakeRepository) DeleteSeason(_ context.Context, input domain.DeleteSeasonInput) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	key := seasonKey(input.SportSlug, input.LeagueSlug, input.SeasonSlug)
	if _, exists := r.seasonsByKey[key]; !exists {
		return domain.ErrNotFound
	}
	delete(r.seasonsByKey, key)
	delete(r.seasonMatches, key)
	return nil
}

func TestLeaguesDefaultLocale(t *testing.T) {
	router, _, _ := testRouter(t)
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
	leagues, ok := firstItem["leagues"].([]any)
	if !ok || len(leagues) == 0 {
		t.Fatalf("expected leagues in default response")
	}
	firstLeague, ok := leagues[0].(map[string]any)
	if !ok {
		t.Fatalf("expected first league object")
	}
	defaultSeason, ok := firstLeague["defaultSeason"].(map[string]any)
	if !ok {
		t.Fatalf("expected defaultSeason in league response")
	}
	if defaultSeason["slug"] != "2026" {
		t.Fatalf("expected defaultSeason.slug=2026, got %#v", defaultSeason["slug"])
	}
}

func TestLeaguesLocalized(t *testing.T) {
	router, _, _ := testRouter(t)
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
	router, _, _ := testRouter(t)
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
	router, _, _ := testRouter(t)
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
	router, _, _ := testRouter(t)
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

func TestCreateSport(t *testing.T) {
	router, _, manager := testRouter(t)
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/api/admin/sports", bytes.NewBufferString(`{"id":2,"slug":"basketball","name":{"en":"Basketball","zh":"篮球"}}`))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", adminAuthorization(t, manager, "admin@example.com"))

	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusCreated {
		t.Fatalf("unexpected status: %d body=%s", recorder.Code, recorder.Body.String())
	}

	var payload map[string]any
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode payload: %v", err)
	}
	if payload["slug"] != "basketball" {
		t.Fatalf("expected created sport slug, got %#v", payload["slug"])
	}
	if payload["id"] != float64(2) {
		t.Fatalf("expected created sport id=2, got %#v", payload["id"])
	}
}

func TestCreateLeagueRequiresExistingSport(t *testing.T) {
	router, _, manager := testRouter(t)
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/api/admin/leagues", bytes.NewBufferString(`{"id":4328,"sportSlug":"basketball","slug":"nba","name":{"en":"NBA"}}`))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", adminAuthorization(t, manager, "admin@example.com"))

	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusNotFound {
		t.Fatalf("unexpected status: %d body=%s", recorder.Code, recorder.Body.String())
	}
}

func TestCreateSeasonConflict(t *testing.T) {
	router, _, manager := testRouter(t)
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/api/admin/seasons", bytes.NewBufferString(`{"sportSlug":"football","leagueSlug":"csl","slug":"2026","label":"2026","startYear":2026,"endYear":2026}`))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", adminAuthorization(t, manager, "admin@example.com"))

	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusConflict {
		t.Fatalf("unexpected status: %d body=%s", recorder.Code, recorder.Body.String())
	}
}

func TestDeleteSeason(t *testing.T) {
	router, repo, manager := testRouter(t)
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodDelete, "/api/admin/football/csl/seasons/2026", nil)
	request.Header.Set("Authorization", adminAuthorization(t, manager, "admin@example.com"))

	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusNoContent {
		t.Fatalf("unexpected status: %d body=%s", recorder.Code, recorder.Body.String())
	}

	repo.mu.Lock()
	defer repo.mu.Unlock()
	if _, exists := repo.seasonsByKey[seasonKey("football", "csl", "2026")]; exists {
		t.Fatalf("expected season to be deleted")
	}
	if _, exists := repo.seasonMatches[seasonKey("football", "csl", "2026")]; exists {
		t.Fatalf("expected season matches to be deleted")
	}
}

func TestCreateSeasonInvalidYears(t *testing.T) {
	router, _, manager := testRouter(t)
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/api/admin/seasons", bytes.NewBufferString(`{"sportSlug":"football","leagueSlug":"csl","slug":"2027","label":"2027","startYear":2028,"endYear":2027}`))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", adminAuthorization(t, manager, "admin@example.com"))

	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("unexpected status: %d body=%s", recorder.Code, recorder.Body.String())
	}
}

func seasonKey(sportSlug, leagueSlug, seasonSlug string) string {
	return sportSlug + "/" + leagueSlug + "/" + seasonSlug
}

func adminAuthorization(t *testing.T, manager *auth.Manager, email string) string {
	t.Helper()
	token, err := manager.Sign(email, time.Now().UTC())
	if err != nil {
		t.Fatalf("sign admin token: %v", err)
	}
	return "Bearer " + token.Token
}

func TestRegisterLoginAndRefresh(t *testing.T) {
	router, repo, _ := testRouter(t)
	registerRecorder := httptest.NewRecorder()
	registerRequest := httptest.NewRequest(http.MethodPost, "/api/auth/register", bytes.NewBufferString(`{"email":"admin@example.com","password":"secret123"}`))
	registerRequest.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(registerRecorder, registerRequest)
	if registerRecorder.Code != http.StatusCreated {
		t.Fatalf("unexpected register status: %d body=%s", registerRecorder.Code, registerRecorder.Body.String())
	}

	repo.mu.Lock()
	createdUser, exists := repo.usersByEmail["admin@example.com"]
	repo.mu.Unlock()
	if !exists {
		t.Fatalf("expected registered user to exist")
	}
	if err := bcrypt.CompareHashAndPassword([]byte(createdUser.passwordHash), []byte("secret123")); err != nil {
		t.Fatalf("expected stored password hash to match")
	}

	loginRecorder := httptest.NewRecorder()
	loginRequest := httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewBufferString(`{"email":"admin@example.com","password":"secret123"}`))
	loginRequest.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(loginRecorder, loginRequest)
	if loginRecorder.Code != http.StatusOK {
		t.Fatalf("unexpected login status: %d body=%s", loginRecorder.Code, loginRecorder.Body.String())
	}
	var loginPayload map[string]any
	if err := json.Unmarshal(loginRecorder.Body.Bytes(), &loginPayload); err != nil {
		t.Fatalf("decode login payload: %v", err)
	}
	token, _ := loginPayload["token"].(string)
	if token == "" {
		t.Fatalf("expected login token")
	}

	refreshRecorder := httptest.NewRecorder()
	refreshRequest := httptest.NewRequest(http.MethodPost, "/api/auth/refresh", nil)
	refreshRequest.Header.Set("Authorization", "Bearer "+token)
	router.ServeHTTP(refreshRecorder, refreshRequest)
	if refreshRecorder.Code != http.StatusOK {
		t.Fatalf("unexpected refresh status: %d body=%s", refreshRecorder.Code, refreshRecorder.Body.String())
	}
}

func TestAdminRouteRequiresToken(t *testing.T) {
	router, _, _ := testRouter(t)
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/admin/sports", nil)
	router.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("unexpected status: %d body=%s", recorder.Code, recorder.Body.String())
	}
}

func TestAuthRegisterOptionsPreflight(t *testing.T) {
	router, _, _ := testRouter(t)
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodOptions, "/api/auth/register", nil)
	request.Header.Set("Origin", "http://localhost:5174")
	request.Header.Set("Access-Control-Request-Method", http.MethodPost)
	request.Header.Set("Access-Control-Request-Headers", "authorization, content-type")

	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusNoContent {
		t.Fatalf("unexpected status: %d body=%s", recorder.Code, recorder.Body.String())
	}
	if got := recorder.Header().Get("Access-Control-Allow-Origin"); got != "http://localhost:5174" {
		t.Fatalf("unexpected allow origin: %q", got)
	}
	if got := recorder.Header().Get("Access-Control-Allow-Methods"); got == "" {
		t.Fatalf("expected allow methods header")
	}
	if got := recorder.Header().Get("Access-Control-Allow-Headers"); got == "" {
		t.Fatalf("expected allow headers header")
	}
}
