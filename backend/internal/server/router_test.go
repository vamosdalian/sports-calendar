package server

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
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
	teamsByLeague map[string][]domain.AdminTeamItem
	manualMatches map[string][]domain.Match
	seasonMatches map[string]int
	usersByEmail  map[string]fakeUser
	syncedTargets []domain.LeagueSyncTarget
}

type fakeSyncRunner struct {
	repo *fakeRepository
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
				Show:         true,
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
				Show:                        true,
				StartYear:                   2026,
				EndYear:                     2026,
				DefaultMatchDurationMinutes: 120,
				CreatedAt:                   now,
				UpdatedAt:                   now,
			},
		},
		teamsByLeague: map[string][]domain.AdminTeamItem{
			"football/csl": {
				{ID: 10001, Slug: "beijing-guoan", Name: domain.LocalizedText{"en": "Beijing Guoan", "zh": "北京国安"}},
				{ID: 10002, Slug: "shanghai-shenhua", Name: domain.LocalizedText{"en": "Shanghai Shenhua", "zh": "上海申花"}},
			},
		},
		manualMatches: map[string][]domain.Match{},
		seasonMatches: map[string]int{
			"football/csl/2026": 2,
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
	svc.SetSyncRunner(&fakeSyncRunner{repo: repo})
	manager, err := auth.NewManager("test-secret", 30*time.Minute)
	if err != nil {
		t.Fatalf("create test token manager: %v", err)
	}
	svc.SetTokenManager(manager)
	return NewRouter(logger, svc, rate.NewLimiter(rate.Limit(100), 100)), repo, manager
}

func (r *fakeRepository) GetSeasonSyncTarget(_ context.Context, sportSlug, leagueSlug, seasonSlug string) (domain.LeagueSyncTarget, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	league, exists := r.leaguesBySlug[leagueSlug]
	if !exists || league.SportSlug != sportSlug {
		return domain.LeagueSyncTarget{}, domain.ErrNotFound
	}
	season, exists := r.seasonsByKey[seasonKey(sportSlug, leagueSlug, seasonSlug)]
	if !exists {
		return domain.LeagueSyncTarget{}, domain.ErrNotFound
	}
	return domain.LeagueSyncTarget{
		LeagueID:     league.ID,
		LeagueSlug:   league.Slug,
		SyncInterval: league.SyncInterval,
		SeasonID:     season.ID,
		SeasonSlug:   season.Slug,
		SeasonLabel:  season.Label,
	}, nil
}

func (r *fakeSyncRunner) SyncLeague(_ context.Context, target domain.LeagueSyncTarget) error {
	r.repo.mu.Lock()
	defer r.repo.mu.Unlock()
	r.repo.syncedTargets = append(r.repo.syncedTargets, target)
	key := seasonKey("football", target.LeagueSlug, target.SeasonSlug)
	r.repo.seasonMatches[key] = 2
	return nil
}

func (r *fakeRepository) ListLeagues(_ context.Context) ([]domain.SportDirectoryItem, string, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	league, exists := r.leaguesBySlug["csl"]
	if !exists || !league.Show {
		return nil, "2026-03-10T00:00:00Z", nil
	}
	season, exists := r.seasonsByKey[seasonKey("football", "csl", "2026")]
	if !exists || !season.Show {
		return nil, "2026-03-10T00:00:00Z", nil
	}
	return []domain.SportDirectoryItem{
		{
			SportSlug:  "football",
			SportNames: domain.LocalizedText{"en": "Football", "zh": "足球"},
			Leagues: []domain.LeagueReference{
				{
					LeagueSlug:    "csl",
					LeagueNames:   domain.LocalizedText{"en": "Chinese Super League", "zh": "中超"},
					Show:          true,
					DefaultSeason: domain.SeasonReference{Slug: "2026", Label: "2026"},
				},
			},
		},
	}, "2026-03-10T00:00:00Z", nil
}

func (r *fakeRepository) ListLeagueSeasons(_ context.Context, sportSlug, leagueSlug string) (domain.LeagueSeasons, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	league, exists := r.leaguesBySlug[leagueSlug]
	if !exists || league.SportSlug != sportSlug || !league.Show {
		return domain.LeagueSeasons{}, domain.ErrNotFound
	}
	season, exists := r.seasonsByKey[seasonKey(sportSlug, leagueSlug, "2026")]
	if !exists || !season.Show {
		return domain.LeagueSeasons{}, domain.ErrNotFound
	}
	return domain.LeagueSeasons{
		SportSlug:   "football",
		SportNames:  domain.LocalizedText{"en": "Football", "zh": "足球"},
		LeagueSlug:  "csl",
		LeagueNames: domain.LocalizedText{"en": "Chinese Super League", "zh": "中超"},
		Seasons:     []domain.SeasonReference{{Slug: "2026", Label: "2026"}},
		UpdatedAt:   "2026-03-10T00:00:00Z",
	}, nil
}

func (r *fakeRepository) GetLeagueSeason(_ context.Context, sportSlug, leagueSlug, seasonSlug string) (domain.SeasonDetail, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	league, exists := r.leaguesBySlug[leagueSlug]
	if !exists || league.SportSlug != sportSlug || !league.Show || seasonSlug != "2026" {
		return domain.SeasonDetail{}, domain.ErrNotFound
	}
	season, exists := r.seasonsByKey[seasonKey(sportSlug, leagueSlug, seasonSlug)]
	if !exists || !season.Show {
		return domain.SeasonDetail{}, domain.ErrNotFound
	}
	matches := []domain.Match{
		{
			ID:       "csl-2026-r1-guoan-shenhua",
			Round:    domain.LocalizedText{"en": "Round 1", "zh": "第1轮"},
			StartsAt: "2026-03-14T11:35:00Z",
			Status:   "scheduled",
			Venue:    domain.LocalizedText{"en": "Workers Stadium", "zh": "工人体育场"},
			City:     domain.LocalizedText{"en": "Beijing", "zh": "北京"},
			Country:  domain.LocalizedText{"en": "China", "zh": "中国"},
			HomeTeam: &domain.Team{Slug: "beijing-guoan", Names: domain.LocalizedText{"en": "Beijing Guoan", "zh": "北京国安"}},
			AwayTeam: &domain.Team{Slug: "shanghai-shenhua", Names: domain.LocalizedText{"en": "Shanghai Shenhua", "zh": "上海申花"}},
		},
		{
			ID:       "csl-2026-r1-three-towns-haifa",
			Round:    domain.LocalizedText{"en": "Round 1", "zh": "第1轮"},
			StartsAt: "2026-03-15T11:35:00Z",
			Status:   "scheduled",
			Venue:    domain.LocalizedText{"en": "Wuhan Sports Center", "zh": "武汉体育中心"},
			City:     domain.LocalizedText{"en": "Wuhan", "zh": "武汉"},
			Country:  domain.LocalizedText{"en": "China", "zh": "中国"},
			HomeTeam: &domain.Team{Slug: "wuhan-three-towns", Names: domain.LocalizedText{"en": "Wuhan Three Towns", "zh": "武汉三镇"}},
			AwayTeam: &domain.Team{Slug: "dalian-yingbo-haifa", Names: domain.LocalizedText{"en": "Dalian Yingbo Haifa", "zh": "大连英博海发"}},
		},
	}
	matches = append(matches, r.manualMatches[seasonKey(sportSlug, leagueSlug, seasonSlug)]...)
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
		Matches:                     matches,
		UpdatedAt:                   "2026-03-10T00:00:00Z",
	}, nil
}

func (r *fakeRepository) GetAdminLeagueSeason(_ context.Context, sportSlug, leagueSlug, seasonSlug string) (domain.SeasonDetail, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	league, exists := r.leaguesBySlug[leagueSlug]
	if !exists || league.SportSlug != sportSlug || seasonSlug != "2026" {
		return domain.SeasonDetail{}, domain.ErrNotFound
	}
	season, exists := r.seasonsByKey[seasonKey(sportSlug, leagueSlug, seasonSlug)]
	if !exists {
		return domain.SeasonDetail{}, domain.ErrNotFound
	}
	matches := []domain.Match{
		{
			ID:       "csl-2026-r1-guoan-shenhua",
			Round:    domain.LocalizedText{"en": "Round 1", "zh": "第1轮"},
			StartsAt: "2026-03-14T11:35:00Z",
			Status:   "scheduled",
			Venue:    domain.LocalizedText{"en": "Workers Stadium", "zh": "工人体育场"},
			City:     domain.LocalizedText{"en": "Beijing", "zh": "北京"},
			Country:  domain.LocalizedText{"en": "China", "zh": "中国"},
			HomeTeam: &domain.Team{Slug: "beijing-guoan", Names: domain.LocalizedText{"en": "Beijing Guoan", "zh": "北京国安"}},
			AwayTeam: &domain.Team{Slug: "shanghai-shenhua", Names: domain.LocalizedText{"en": "Shanghai Shenhua", "zh": "上海申花"}},
		},
	}
	matches = append(matches, r.manualMatches[seasonKey(sportSlug, leagueSlug, seasonSlug)]...)
	return domain.SeasonDetail{
		SportSlug:                   "football",
		SportNames:                  domain.LocalizedText{"en": "Football", "zh": "足球"},
		LeagueSlug:                  leagueSlug,
		LeagueNames:                 league.Name,
		SeasonSlug:                  season.Slug,
		SeasonLabel:                 season.Label,
		DefaultMatchDurationMinutes: season.DefaultMatchDurationMinutes,
		CalendarDescription:         league.CalendarDescription,
		DataSourceNote:              league.DataSourceNote,
		Notes:                       league.Notes,
		Matches:                     matches,
		UpdatedAt:                   "2026-03-10T00:00:00Z",
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

func (r *fakeRepository) ListAdminTeams(_ context.Context, sportSlug, leagueSlug string) (domain.AdminTeamsResponse, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	key := sportSlug + "/" + leagueSlug
	items, exists := r.teamsByLeague[key]
	if !exists {
		return domain.AdminTeamsResponse{}, domain.ErrNotFound
	}
	return domain.AdminTeamsResponse{
		SportSlug:  sportSlug,
		LeagueSlug: leagueSlug,
		Items:      append([]domain.AdminTeamItem(nil), items...),
		UpdatedAt:  time.Now().UTC().Format(time.RFC3339),
	}, nil
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
			Show:                league.Show,
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

func (r *fakeRepository) ListAdminSeasons(_ context.Context, sportSlug, leagueSlug string) (domain.AdminSeasonsResponse, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if league, exists := r.leaguesBySlug[leagueSlug]; !exists || league.SportSlug != sportSlug {
		return domain.AdminSeasonsResponse{}, domain.ErrNotFound
	}
	items := make([]domain.AdminSeasonItem, 0)
	for _, season := range r.seasonsByKey {
		if season.SportSlug != sportSlug || season.LeagueSlug != leagueSlug {
			continue
		}
		items = append(items, domain.AdminSeasonItem{
			ID:                          season.ID,
			SportSlug:                   season.SportSlug,
			LeagueSlug:                  season.LeagueSlug,
			Slug:                        season.Slug,
			Label:                       season.Label,
			Show:                        season.Show,
			StartYear:                   season.StartYear,
			EndYear:                     season.EndYear,
			DefaultMatchDurationMinutes: season.DefaultMatchDurationMinutes,
			CreatedAt:                   season.CreatedAt,
			UpdatedAt:                   season.UpdatedAt,
		})
	}
	return domain.AdminSeasonsResponse{SportSlug: sportSlug, LeagueSlug: leagueSlug, Items: items, UpdatedAt: "2026-03-10T00:00:00Z"}, nil
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
		Show:                input.Show,
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

func (r *fakeRepository) UpdateSport(_ context.Context, input domain.UpdateSportInput) (domain.SportRecord, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	record, exists := r.sportsBySlug[input.CurrentSlug]
	if !exists {
		return domain.SportRecord{}, domain.ErrNotFound
	}
	if input.CurrentSlug != input.Slug {
		if _, exists := r.sportsBySlug[input.Slug]; exists {
			return domain.SportRecord{}, domain.ErrConflict
		}
		delete(r.sportsBySlug, input.CurrentSlug)
	}
	record.Slug = input.Slug
	record.Name = input.Name
	record.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	r.sportsBySlug[input.Slug] = record
	for key, league := range r.leaguesBySlug {
		if league.SportSlug != input.CurrentSlug {
			continue
		}
		league.SportSlug = input.Slug
		r.leaguesBySlug[key] = league
	}
	for key, season := range r.seasonsByKey {
		if season.SportSlug != input.CurrentSlug {
			continue
		}
		delete(r.seasonsByKey, key)
		season.SportSlug = input.Slug
		r.seasonsByKey[seasonKey(season.SportSlug, season.LeagueSlug, season.Slug)] = season
	}
	return record, nil
}

func (r *fakeRepository) DeleteSport(_ context.Context, input domain.DeleteSportInput) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, exists := r.sportsBySlug[input.SportSlug]; !exists {
		return domain.ErrNotFound
	}
	delete(r.sportsBySlug, input.SportSlug)
	for slug, league := range r.leaguesBySlug {
		if league.SportSlug != input.SportSlug {
			continue
		}
		delete(r.leaguesBySlug, slug)
	}
	for key, season := range r.seasonsByKey {
		if season.SportSlug != input.SportSlug {
			continue
		}
		delete(r.seasonsByKey, key)
		delete(r.seasonMatches, key)
		delete(r.manualMatches, key)
	}
	return nil
}

func (r *fakeRepository) UpdateLeague(_ context.Context, input domain.UpdateLeagueInput) (domain.LeagueRecord, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	record, exists := r.leaguesBySlug[input.CurrentSlug]
	if !exists || record.SportSlug != input.SportSlug {
		return domain.LeagueRecord{}, domain.ErrNotFound
	}
	if input.CurrentSlug != input.Slug {
		if _, exists := r.leaguesBySlug[input.Slug]; exists {
			return domain.LeagueRecord{}, domain.ErrConflict
		}
		delete(r.leaguesBySlug, input.CurrentSlug)
	}
	record.Slug = input.Slug
	record.Name = input.Name
	record.Show = input.Show
	record.SyncInterval = input.SyncInterval
	record.CalendarDescription = input.CalendarDescription
	record.DataSourceNote = input.DataSourceNote
	record.Notes = input.Notes
	record.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	r.leaguesBySlug[input.Slug] = record
	for key, season := range r.seasonsByKey {
		if season.SportSlug != input.SportSlug || season.LeagueSlug != input.CurrentSlug {
			continue
		}
		delete(r.seasonsByKey, key)
		season.LeagueSlug = input.Slug
		r.seasonsByKey[seasonKey(season.SportSlug, season.LeagueSlug, season.Slug)] = season
	}
	return record, nil
}

func (r *fakeRepository) UpdateTeam(_ context.Context, input domain.UpdateTeamInput) (domain.AdminTeamItem, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	key := input.SportSlug + "/" + input.LeagueSlug
	teams, exists := r.teamsByLeague[key]
	if !exists {
		return domain.AdminTeamItem{}, domain.ErrNotFound
	}
	for index, team := range teams {
		if team.ID != input.TeamID {
			continue
		}
		team.Name = input.Name
		teams[index] = team
		r.teamsByLeague[key] = teams
		return team, nil
	}
	return domain.AdminTeamItem{}, domain.ErrNotFound
}

func (r *fakeRepository) DeleteLeague(_ context.Context, input domain.DeleteLeagueInput) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	record, exists := r.leaguesBySlug[input.LeagueSlug]
	if !exists || record.SportSlug != input.SportSlug {
		return domain.ErrNotFound
	}
	delete(r.leaguesBySlug, input.LeagueSlug)
	for key, season := range r.seasonsByKey {
		if season.SportSlug != input.SportSlug || season.LeagueSlug != input.LeagueSlug {
			continue
		}
		delete(r.seasonsByKey, key)
		delete(r.seasonMatches, key)
		delete(r.manualMatches, key)
	}
	return nil
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
		Show:                        input.Show,
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

func (r *fakeRepository) UpdateSeason(_ context.Context, input domain.UpdateSeasonInput) (domain.SeasonRecord, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	key := seasonKey(input.SportSlug, input.LeagueSlug, input.CurrentSlug)
	record, exists := r.seasonsByKey[key]
	if !exists {
		return domain.SeasonRecord{}, domain.ErrNotFound
	}
	nextKey := seasonKey(input.SportSlug, input.LeagueSlug, input.Slug)
	if nextKey != key {
		if _, exists := r.seasonsByKey[nextKey]; exists {
			return domain.SeasonRecord{}, domain.ErrConflict
		}
		delete(r.seasonsByKey, key)
	}
	record.Label = input.Label
	record.Show = input.Show
	record.StartYear = input.StartYear
	record.EndYear = input.EndYear
	record.DefaultMatchDurationMinutes = input.DefaultMatchDurationMinutes
	record.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	r.seasonsByKey[nextKey] = record
	if matches, exists := r.seasonMatches[key]; exists {
		delete(r.seasonMatches, key)
		r.seasonMatches[nextKey] = matches
	}
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
	delete(r.manualMatches, key)
	return nil
}

func (r *fakeRepository) CreateMatch(_ context.Context, input domain.CreateMatchInput) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	key := seasonKey(input.SportSlug, input.LeagueSlug, input.SeasonSlug)
	if _, exists := r.seasonsByKey[key]; !exists {
		return domain.ErrNotFound
	}
	match := domain.Match{
		ID:         input.ExternalID,
		Round:      input.Round,
		StartsAt:   input.StartsAt,
		Status:     input.Status,
		Venue:      input.Venue,
		City:       input.City,
		Country:    input.Country,
		HomeTeamID: input.HomeTeamID,
		AwayTeamID: input.AwayTeamID,
		HomeTeam:   fakeMatchTeam(r.teamsByLeague[input.SportSlug+"/"+input.LeagueSlug], input.HomeTeamID),
		AwayTeam:   fakeMatchTeam(r.teamsByLeague[input.SportSlug+"/"+input.LeagueSlug], input.AwayTeamID),
	}
	r.manualMatches[key] = append(r.manualMatches[key], match)
	r.seasonMatches[key] = r.seasonMatches[key] + 1
	return nil
}

func (r *fakeRepository) UpdateMatch(_ context.Context, input domain.UpdateMatchInput) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	key := seasonKey(input.SportSlug, input.LeagueSlug, input.SeasonSlug)
	matches, exists := r.manualMatches[key]
	if !exists {
		return domain.ErrNotFound
	}
	for index, match := range matches {
		if match.ID != input.ExternalID {
			continue
		}
		matches[index] = domain.Match{
			ID:         input.ExternalID,
			Round:      input.Round,
			StartsAt:   input.StartsAt,
			Status:     input.Status,
			Venue:      input.Venue,
			City:       input.City,
			Country:    input.Country,
			HomeTeamID: input.HomeTeamID,
			AwayTeamID: input.AwayTeamID,
			HomeTeam:   fakeMatchTeam(r.teamsByLeague[input.SportSlug+"/"+input.LeagueSlug], input.HomeTeamID),
			AwayTeam:   fakeMatchTeam(r.teamsByLeague[input.SportSlug+"/"+input.LeagueSlug], input.AwayTeamID),
		}
		r.manualMatches[key] = matches
		return nil
	}
	return domain.ErrNotFound
}

func (r *fakeRepository) DeleteMatch(_ context.Context, input domain.DeleteMatchInput) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	key := seasonKey(input.SportSlug, input.LeagueSlug, input.SeasonSlug)
	matches, exists := r.manualMatches[key]
	if !exists {
		return domain.ErrNotFound
	}
	filtered := matches[:0]
	deleted := false
	for _, match := range matches {
		if match.ID == input.ExternalID {
			deleted = true
			continue
		}
		filtered = append(filtered, match)
	}
	if !deleted {
		return domain.ErrNotFound
	}
	r.manualMatches[key] = append([]domain.Match(nil), filtered...)
	if r.seasonMatches[key] > 0 {
		r.seasonMatches[key]--
	}
	return nil
}

func fakeMatchTeam(teams []domain.AdminTeamItem, teamID int64) *domain.Team {
	if teamID == domain.UnknownTeamID {
		team := domain.UnknownTeam()
		return &team
	}
	for _, team := range teams {
		if team.ID != teamID {
			continue
		}
		resolved := domain.Team{Slug: team.Slug, Names: team.Name}
		return &resolved
	}
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
	if !ok || len(seasons) != 1 {
		t.Fatalf("expected seasons in response")
	}
}

func TestHiddenLeagueNotListedPublicly(t *testing.T) {
	router, repo, _ := testRouter(t)
	repo.mu.Lock()
	league := repo.leaguesBySlug["csl"]
	league.Show = false
	repo.leaguesBySlug["csl"] = league
	repo.mu.Unlock()

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
	if !ok {
		t.Fatalf("expected items array")
	}
	if len(items) != 0 {
		t.Fatalf("expected hidden league to be omitted, got %#v", items)
	}
}

func TestHiddenSeasonReturnsNotFoundPublicly(t *testing.T) {
	router, repo, _ := testRouter(t)
	repo.mu.Lock()
	season := repo.seasonsByKey[seasonKey("football", "csl", "2026")]
	season.Show = false
	repo.seasonsByKey[seasonKey("football", "csl", "2026")] = season
	repo.mu.Unlock()

	seasonsRecorder := httptest.NewRecorder()
	seasonsRequest := httptest.NewRequest(http.MethodGet, "/api/football/csl/seasons", nil)
	router.ServeHTTP(seasonsRecorder, seasonsRequest)
	if seasonsRecorder.Code != http.StatusNotFound {
		t.Fatalf("unexpected seasons status: %d body=%s", seasonsRecorder.Code, seasonsRecorder.Body.String())
	}

	detailRecorder := httptest.NewRecorder()
	detailRequest := httptest.NewRequest(http.MethodGet, "/api/football/csl/2026", nil)
	router.ServeHTTP(detailRecorder, detailRequest)
	if detailRecorder.Code != http.StatusNotFound {
		t.Fatalf("unexpected season detail status: %d body=%s", detailRecorder.Code, detailRecorder.Body.String())
	}
}

func TestHiddenSeasonReturnsDetailForAdmin(t *testing.T) {
	router, repo, manager := testRouter(t)
	repo.mu.Lock()
	season := repo.seasonsByKey[seasonKey("football", "csl", "2026")]
	season.Show = false
	repo.seasonsByKey[seasonKey("football", "csl", "2026")] = season
	repo.mu.Unlock()

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/admin/football/csl/seasons/2026", nil)
	request.Header.Set("Authorization", adminAuthorization(t, manager, "admin@example.com"))

	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("unexpected admin season detail status: %d body=%s", recorder.Code, recorder.Body.String())
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
	if body := recorder.Body.String(); !strings.Contains(body, "csl-2026-r1-guoan-shenhua@sports-calendar.com") || !strings.Contains(body, "csl-2026-r1-three-towns-haifa@sports-calendar.com") {
		t.Fatalf("expected all season matches in feed body=%s", body)
	}
}

func TestICSFeedByTeam(t *testing.T) {
	router, _, _ := testRouter(t)
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/ics/football/csl/2026/matches.ics?team=beijing-guoan", nil)

	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("unexpected status: %d body=%s", recorder.Code, recorder.Body.String())
	}
	if got := recorder.Header().Get("Content-Disposition"); !strings.Contains(got, "csl-2026-beijing-guoan.ics") {
		t.Fatalf("expected team-specific filename, got %q", got)
	}
	if body := recorder.Body.String(); !strings.Contains(body, "csl-2026-r1-guoan-shenhua@sports-calendar.com") || strings.Contains(body, "csl-2026-r1-three-towns-haifa@sports-calendar.com") {
		t.Fatalf("expected filtered team feed body=%s", body)
	}
}

func TestICSFeedByLocale(t *testing.T) {
	router, _, _ := testRouter(t)
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/ics/football/csl/2026/matches.ics?lang=zh", nil)

	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("unexpected status: %d body=%s", recorder.Code, recorder.Body.String())
	}
	body := recorder.Body.String()
	if !strings.Contains(body, "NAME:中超 2026") {
		t.Fatalf("expected localized calendar name body=%s", body)
	}
	if !strings.Contains(body, "SUMMARY:北京国安 对阵 上海申花") {
		t.Fatalf("expected localized summary body=%s", body)
	}
	if !strings.Contains(body, "轮次: 第1轮") || !strings.Contains(body, "状态: 已安排") {
		t.Fatalf("expected localized description body=%s", body)
	}
	if !strings.Contains(body, "csl-2026-r1-three-towns-haifa@sports-calendar.com") {
		t.Fatalf("expected non-team locale feed to keep all matches body=%s", body)
	}
}

func TestICSFeedByLocaleAndTeam(t *testing.T) {
	router, _, _ := testRouter(t)
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/ics/football/csl/2026/matches.ics?lang=zh&team=beijing-guoan", nil)

	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("unexpected status: %d body=%s", recorder.Code, recorder.Body.String())
	}
	if got := recorder.Header().Get("Content-Disposition"); !strings.Contains(got, "csl-2026-beijing-guoan.ics") {
		t.Fatalf("expected team-specific filename, got %q", got)
	}
	body := recorder.Body.String()
	if !strings.Contains(body, "NAME:中超 2026 - 北京国安") {
		t.Fatalf("expected localized team calendar name body=%s", body)
	}
	if !strings.Contains(body, "SUMMARY:北京国安 对阵 上海申花") {
		t.Fatalf("expected localized team summary body=%s", body)
	}
	if strings.Contains(body, "csl-2026-r1-three-towns-haifa@sports-calendar.com") {
		t.Fatalf("expected team+locale feed to stay filtered body=%s", body)
	}
}

func TestICSFeedByTeamNotFound(t *testing.T) {
	router, _, _ := testRouter(t)
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/ics/football/csl/2026/matches.ics?team=unknown-team", nil)

	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusNotFound {
		t.Fatalf("unexpected status: %d body=%s", recorder.Code, recorder.Body.String())
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

func TestListAdminTeams(t *testing.T) {
	router, _, manager := testRouter(t)
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/admin/football/csl/teams", nil)
	request.Header.Set("Authorization", adminAuthorization(t, manager, "admin@example.com"))

	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("unexpected status: %d body=%s", recorder.Code, recorder.Body.String())
	}

	var payload map[string]any
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode payload: %v", err)
	}
	items, ok := payload["items"].([]any)
	if !ok || len(items) != 2 {
		t.Fatalf("expected 2 teams, got %#v", payload["items"])
	}
}

func TestUpdateTeam(t *testing.T) {
	router, repo, manager := testRouter(t)
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPut, "/api/admin/football/csl/teams/10001", bytes.NewBufferString(`{"name":{"en":"Beijing FC","zh":"北京队"}}`))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", adminAuthorization(t, manager, "admin@example.com"))

	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("unexpected status: %d body=%s", recorder.Code, recorder.Body.String())
	}

	var payload map[string]any
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode payload: %v", err)
	}
	if payload["id"] != float64(10001) {
		t.Fatalf("expected team id=10001, got %#v", payload["id"])
	}
	name, ok := payload["name"].(map[string]any)
	if !ok || name["zh"] != "北京队" {
		t.Fatalf("expected updated localized name, got %#v", payload["name"])
	}

	repo.mu.Lock()
	defer repo.mu.Unlock()
	teams := repo.teamsByLeague["football/csl"]
	if teams[0].Name["en"] != "Beijing FC" {
		t.Fatalf("expected stored english name update, got %#v", teams[0].Name)
	}
}

func TestUpdateTeamInvalidID(t *testing.T) {
	router, _, manager := testRouter(t)
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPut, "/api/admin/football/csl/teams/not-a-number", bytes.NewBufferString(`{"name":{"en":"Beijing FC"}}`))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", adminAuthorization(t, manager, "admin@example.com"))

	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("unexpected status: %d body=%s", recorder.Code, recorder.Body.String())
	}
}

func TestUpdateTeamNotFound(t *testing.T) {
	router, _, manager := testRouter(t)
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPut, "/api/admin/football/csl/teams/99999", bytes.NewBufferString(`{"name":{"en":"Missing Team"}}`))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", adminAuthorization(t, manager, "admin@example.com"))

	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusNotFound {
		t.Fatalf("unexpected status: %d body=%s", recorder.Code, recorder.Body.String())
	}
}

func TestCreateMatch(t *testing.T) {
	router, repo, manager := testRouter(t)
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/api/admin/matches", bytes.NewBufferString(`{"sportSlug":"football","leagueSlug":"csl","seasonSlug":"2026","homeTeamID":-1,"awayTeamID":10002,"round":{"en":"Round of 16"},"startsAt":"2026-06-29T12:00:00Z","status":"scheduled","venue":{"en":"Workers Stadium"},"city":{"en":"Beijing"}}`))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", adminAuthorization(t, manager, "admin@example.com"))

	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusNoContent {
		t.Fatalf("unexpected status: %d body=%s", recorder.Code, recorder.Body.String())
	}

	detailRecorder := httptest.NewRecorder()
	detailRequest := httptest.NewRequest(http.MethodGet, "/api/football/csl/2026", nil)
	router.ServeHTTP(detailRecorder, detailRequest)

	if detailRecorder.Code != http.StatusOK {
		t.Fatalf("unexpected season detail status: %d body=%s", detailRecorder.Code, detailRecorder.Body.String())
	}

	var payload map[string]any
	if err := json.Unmarshal(detailRecorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode payload: %v", err)
	}
	groups, ok := payload["groups"].([]any)
	if !ok || len(groups) == 0 {
		t.Fatalf("expected groups in response")
	}
	lastGroup, ok := groups[len(groups)-1].(map[string]any)
	if !ok {
		t.Fatalf("expected last group object")
	}
	matches, ok := lastGroup["matches"].([]any)
	if !ok || len(matches) == 0 {
		t.Fatalf("expected matches in last group")
	}
	lastMatch, ok := matches[len(matches)-1].(map[string]any)
	if !ok {
		t.Fatalf("expected last match object")
	}
	homeTeam, ok := lastMatch["homeTeam"].(map[string]any)
	if !ok || homeTeam["name"] != "Unknown team" {
		t.Fatalf("expected unknown home team, got %#v", lastMatch["homeTeam"])
	}

	repo.mu.Lock()
	defer repo.mu.Unlock()
	if len(repo.manualMatches[seasonKey("football", "csl", "2026")]) != 1 {
		t.Fatalf("expected one manual match, got %d", len(repo.manualMatches[seasonKey("football", "csl", "2026")]))
	}
}

func TestUpdateMatch(t *testing.T) {
	router, repo, manager := testRouter(t)
	matchID := "manual:2026:20260629t120000:1"
	repo.mu.Lock()
	repo.manualMatches[seasonKey("football", "csl", "2026")] = []domain.Match{{
		ID:         matchID,
		Round:      domain.LocalizedText{"en": "Round of 16"},
		StartsAt:   "2026-06-29T12:00:00Z",
		Status:     "scheduled",
		Venue:      domain.LocalizedText{"en": "Workers Stadium"},
		City:       domain.LocalizedText{"en": "Beijing"},
		Country:    domain.LocalizedText{"en": "United States"},
		HomeTeamID: domain.UnknownTeamID,
		AwayTeamID: 10002,
		HomeTeam:   fakeMatchTeam(repo.teamsByLeague["football/csl"], domain.UnknownTeamID),
		AwayTeam:   fakeMatchTeam(repo.teamsByLeague["football/csl"], 10002),
	}}
	repo.seasonMatches[seasonKey("football", "csl", "2026")] = 3
	repo.mu.Unlock()

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPut, "/api/admin/matches/"+url.PathEscape(matchID), bytes.NewBufferString(`{"sportSlug":"football","leagueSlug":"csl","seasonSlug":"2026","homeTeamID":10001,"awayTeamID":-1,"round":{"en":"Quarter-finals"},"startsAt":"2026-07-03T16:00:00Z","status":"scheduled","venue":{"en":"MetLife Stadium"},"city":{"en":"New York"},"country":{"en":"United States"}}`))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", adminAuthorization(t, manager, "admin@example.com"))

	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusNoContent {
		t.Fatalf("unexpected status: %d body=%s", recorder.Code, recorder.Body.String())
	}

	detailRecorder := httptest.NewRecorder()
	detailRequest := httptest.NewRequest(http.MethodGet, "/api/football/csl/2026", nil)
	router.ServeHTTP(detailRecorder, detailRequest)

	if detailRecorder.Code != http.StatusOK {
		t.Fatalf("unexpected season detail status: %d body=%s", detailRecorder.Code, detailRecorder.Body.String())
	}

	var payload map[string]any
	if err := json.Unmarshal(detailRecorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode payload: %v", err)
	}
	groups, ok := payload["groups"].([]any)
	if !ok || len(groups) == 0 {
		t.Fatalf("expected groups in response")
	}
	lastGroup, ok := groups[len(groups)-1].(map[string]any)
	if !ok {
		t.Fatalf("expected last group object")
	}
	matches, ok := lastGroup["matches"].([]any)
	if !ok || len(matches) == 0 {
		t.Fatalf("expected matches in last group")
	}
	lastMatch, ok := matches[len(matches)-1].(map[string]any)
	if !ok {
		t.Fatalf("expected last match object")
	}
	if lastMatch["homeTeamID"] != float64(10001) {
		t.Fatalf("expected homeTeamID 10001, got %#v", lastMatch["homeTeamID"])
	}
	if lastMatch["awayTeamID"] != float64(-1) {
		t.Fatalf("expected awayTeamID -1, got %#v", lastMatch["awayTeamID"])
	}
	if lastMatch["round"] != "Quarter-finals" {
		t.Fatalf("expected updated round, got %#v", lastMatch["round"])
	}
	if lastMatch["country"] != "United States" {
		t.Fatalf("expected updated country, got %#v", lastMatch["country"])
	}
	awayTeam, ok := lastMatch["awayTeam"].(map[string]any)
	if !ok || awayTeam["name"] != "Unknown team" {
		t.Fatalf("expected unknown away team, got %#v", lastMatch["awayTeam"])
	}

	repo.mu.Lock()
	defer repo.mu.Unlock()
	stored := repo.manualMatches[seasonKey("football", "csl", "2026")]
	if len(stored) != 1 {
		t.Fatalf("expected one manual match, got %d", len(stored))
	}
	if stored[0].Venue["en"] != "MetLife Stadium" {
		t.Fatalf("expected updated venue, got %#v", stored[0].Venue)
	}
}

func TestDeleteMatch(t *testing.T) {
	router, repo, manager := testRouter(t)
	matchID := "manual:2026:20260629t120000:1"
	repo.mu.Lock()
	repo.manualMatches[seasonKey("football", "csl", "2026")] = []domain.Match{{
		ID:         matchID,
		Round:      domain.LocalizedText{"en": "Round of 16"},
		StartsAt:   "2026-06-29T12:00:00Z",
		Status:     "scheduled",
		Country:    domain.LocalizedText{"en": "United States"},
		HomeTeamID: domain.UnknownTeamID,
		AwayTeamID: 10002,
		HomeTeam:   fakeMatchTeam(repo.teamsByLeague["football/csl"], domain.UnknownTeamID),
		AwayTeam:   fakeMatchTeam(repo.teamsByLeague["football/csl"], 10002),
	}}
	repo.seasonMatches[seasonKey("football", "csl", "2026")] = 3
	repo.mu.Unlock()

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodDelete, "/api/admin/matches/"+url.PathEscape(matchID)+"?sport=football&league=csl&season=2026", nil)
	request.Header.Set("Authorization", adminAuthorization(t, manager, "admin@example.com"))

	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusNoContent {
		t.Fatalf("unexpected status: %d body=%s", recorder.Code, recorder.Body.String())
	}

	repo.mu.Lock()
	if len(repo.manualMatches[seasonKey("football", "csl", "2026")]) != 0 {
		repo.mu.Unlock()
		t.Fatalf("expected manual matches to be deleted")
	}
	if repo.seasonMatches[seasonKey("football", "csl", "2026")] != 2 {
		repo.mu.Unlock()
		t.Fatalf("expected season match count decremented to 2, got %d", repo.seasonMatches[seasonKey("football", "csl", "2026")])
	}
	repo.mu.Unlock()

	detailRecorder := httptest.NewRecorder()
	detailRequest := httptest.NewRequest(http.MethodGet, "/api/football/csl/2026", nil)
	router.ServeHTTP(detailRecorder, detailRequest)

	if detailRecorder.Code != http.StatusOK {
		t.Fatalf("unexpected season detail status: %d body=%s", detailRecorder.Code, detailRecorder.Body.String())
	}

	var payload map[string]any
	if err := json.Unmarshal(detailRecorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode payload: %v", err)
	}
	groups, ok := payload["groups"].([]any)
	if !ok || len(groups) != 1 {
		t.Fatalf("expected one group after delete, got %#v", payload["groups"])
	}
	firstGroup, ok := groups[0].(map[string]any)
	if !ok {
		t.Fatalf("expected group object")
	}
	matches, ok := firstGroup["matches"].([]any)
	if !ok || len(matches) != 2 {
		t.Fatalf("expected only synced matches to remain, got %#v", firstGroup["matches"])
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

func TestRefreshSeasonNow(t *testing.T) {
	router, repo, manager := testRouter(t)
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/api/admin/football/csl/seasons/2026/refresh", nil)
	request.Header.Set("Authorization", adminAuthorization(t, manager, "admin@example.com"))

	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusNoContent {
		t.Fatalf("unexpected status: %d body=%s", recorder.Code, recorder.Body.String())
	}

	repo.mu.Lock()
	defer repo.mu.Unlock()
	if len(repo.syncedTargets) != 1 {
		t.Fatalf("expected one synced target, got %d", len(repo.syncedTargets))
	}
	if repo.syncedTargets[0].SeasonSlug != "2026" {
		t.Fatalf("expected synced season 2026, got %s", repo.syncedTargets[0].SeasonSlug)
	}
}

func TestRefreshSeasonNowNotFound(t *testing.T) {
	router, _, manager := testRouter(t)
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/api/admin/football/csl/seasons/unknown/refresh", nil)
	request.Header.Set("Authorization", adminAuthorization(t, manager, "admin@example.com"))

	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusNotFound {
		t.Fatalf("unexpected status: %d body=%s", recorder.Code, recorder.Body.String())
	}
}

func TestDeleteLeague(t *testing.T) {
	router, repo, manager := testRouter(t)
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodDelete, "/api/admin/football/leagues/csl", nil)
	request.Header.Set("Authorization", adminAuthorization(t, manager, "admin@example.com"))

	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusNoContent {
		t.Fatalf("unexpected status: %d body=%s", recorder.Code, recorder.Body.String())
	}

	repo.mu.Lock()
	defer repo.mu.Unlock()
	if _, exists := repo.leaguesBySlug["csl"]; exists {
		t.Fatalf("expected league to be deleted")
	}
	if _, exists := repo.seasonsByKey[seasonKey("football", "csl", "2026")]; exists {
		t.Fatalf("expected league seasons to be deleted")
	}
}

func TestDeleteSport(t *testing.T) {
	router, repo, manager := testRouter(t)
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodDelete, "/api/admin/sports/football", nil)
	request.Header.Set("Authorization", adminAuthorization(t, manager, "admin@example.com"))

	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusNoContent {
		t.Fatalf("unexpected status: %d body=%s", recorder.Code, recorder.Body.String())
	}

	repo.mu.Lock()
	defer repo.mu.Unlock()
	if _, exists := repo.sportsBySlug["football"]; exists {
		t.Fatalf("expected sport to be deleted")
	}
	if _, exists := repo.leaguesBySlug["csl"]; exists {
		t.Fatalf("expected sport leagues to be deleted")
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
