package syncer

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sort"
	"strconv"
	"testing"
	"time"

	"github.com/sirupsen/logrus"

	"github.com/vamosdalian/sports-calendar/backend/internal/domain"
)

func newTestSpiderFetcher(t *testing.T, baseURL string) *SpiderFetcher {
	t.Helper()
	logger := logrus.New()
	logger.SetOutput(nil)
	fetcher, err := NewSpiderFetcher(baseURL, 5*time.Second, logger)
	if err != nil {
		t.Fatalf("new spider fetcher: %v", err)
	}
	return fetcher
}

func TestSpiderFetcherFetchLeagueSnapshot(t *testing.T) {
	var crawlTriggered bool
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		switch {
		case request.Method == http.MethodPost && request.URL.Path == "/api/crawl":
			crawlTriggered = true
			var payload map[string]any
			_ = json.NewDecoder(request.Body).Decode(&payload)
			if payload["target_id"] != "CSL" {
				t.Fatalf("unexpected crawl target_id: %v", payload["target_id"])
			}
			writer.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(writer).Encode(map[string]any{"enqueued": 1})
		case request.Method == http.MethodGet && request.URL.Path == "/api/data/fixtures":
			if got := request.URL.Query().Get("competition_id"); got != "CSL" {
				t.Fatalf("unexpected competition_id: %q", got)
			}
			if got := request.URL.Query().Get("season_id"); got != "2025" {
				t.Fatalf("unexpected season_id: %q", got)
			}
			writer.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(writer).Encode([]map[string]any{
				{
					"match_id":       4809001,
					"competition_id": "CSL",
					"season_id":      2025,
					"matchday":       "1. Matchday",
					"kickoff":        "2025-03-15T13:35:00",
					"home_team_id":   26773,
					"away_team_id":   4166,
					"home_name":      "Shanghai Port",
					"away_name":      "Shandong Taishan",
					"home_score":     2,
					"away_score":     1,
				},
				{
					// Unplayed fixture: no match_id, no scores.
					"match_id":       nil,
					"competition_id": "CSL",
					"season_id":      2025,
					"matchday":       "2. Matchday",
					"kickoff":        "2025-03-22T12:00:00",
					"home_team_id":   4166,
					"away_team_id":   26773,
					"home_name":      "Shandong Taishan",
					"away_name":      "Shanghai Port",
					"home_score":     nil,
					"away_score":     nil,
				},
				{
					// TBD fixture with no kickoff: must be skipped.
					"match_id":       nil,
					"competition_id": "CSL",
					"season_id":      2025,
					"matchday":       "3. Matchday",
					"kickoff":        nil,
					"home_team_id":   26773,
					"away_team_id":   4166,
					"home_name":      "Shanghai Port",
					"away_name":      "Shandong Taishan",
				},
			})
		default:
			t.Fatalf("unexpected request: %s %s", request.Method, request.URL.Path)
		}
	}))
	defer server.Close()

	fetcher := newTestSpiderFetcher(t, server.URL)
	target := domain.LeagueSyncTarget{
		LeagueID:        99,
		LeagueSlug:      "csl",
		Provider:        ProviderSpider,
		ExternalRef:     "CSL",
		SeasonSlug:      "2025",
		SeasonStartYear: 2025,
	}

	snapshot, err := fetcher.FetchLeagueSnapshot(context.Background(), target)
	if err != nil {
		t.Fatalf("fetch snapshot: %v", err)
	}
	if !crawlTriggered {
		t.Fatalf("expected crawl to be triggered")
	}

	// Two schedulable matches (the TBD one is dropped).
	if len(snapshot.Matches) != 2 {
		t.Fatalf("expected 2 matches, got %d", len(snapshot.Matches))
	}
	if len(snapshot.Teams) != 2 {
		t.Fatalf("expected 2 teams, got %d", len(snapshot.Teams))
	}

	first := snapshot.Matches[0]
	if first.ExternalID != "tm:4809001" {
		t.Fatalf("unexpected external id: %q", first.ExternalID)
	}
	// Team ids are namespaced by the offset.
	wantHome := int64(26773) + spiderTeamIDOffset
	wantAway := int64(4166) + spiderTeamIDOffset
	if first.Teams[0] != wantHome || first.Teams[1] != wantAway {
		t.Fatalf("unexpected team ids: %v (want %d,%d)", first.Teams, wantHome, wantAway)
	}
	// 13:35 Europe/Berlin (CET, UTC+1 in March) -> 12:35 UTC.
	if got := first.StartsAt.UTC().Format(time.RFC3339); got != "2025-03-15T12:35:00Z" {
		t.Fatalf("unexpected kickoff utc: %q", got)
	}
	if first.Status != "finished" {
		t.Fatalf("expected finished status, got %q", first.Status)
	}
	if len(first.Result) != 2 || first.Result[0] != "2" || first.Result[1] != "1" {
		t.Fatalf("unexpected result: %v", first.Result)
	}
	if first.VenueID != nil {
		t.Fatalf("expected nil venue id, got %v", *first.VenueID)
	}

	second := snapshot.Matches[1]
	if second.Status != "scheduled" {
		t.Fatalf("expected scheduled status, got %q", second.Status)
	}
	if len(second.Result) != 0 {
		t.Fatalf("expected empty result, got %v", second.Result)
	}
	// Deterministic synthetic id for the match without a Transfermarkt match_id.
	// The synthetic id uses source-native team ids (no offset) for stability.
	wantSynthetic := "tm:CSL:2025:2. Matchday:" +
		strconv.Itoa(4166) + "-" + strconv.Itoa(26773) + ":20250322"
	if second.ExternalID != wantSynthetic {
		t.Fatalf("unexpected synthetic id: %q (want %q)", second.ExternalID, wantSynthetic)
	}

	teamIDs := []int64{snapshot.Teams[0].ID, snapshot.Teams[1].ID}
	sort.Slice(teamIDs, func(i, j int) bool { return teamIDs[i] < teamIDs[j] })
	if teamIDs[0] != wantAway || teamIDs[1] != wantHome {
		t.Fatalf("unexpected team id set: %v", teamIDs)
	}
}

func TestSpiderTranslationsOverlay(t *testing.T) {
	tr, err := loadSpiderTranslations()
	if err != nil {
		t.Fatalf("load translations: %v", err)
	}

	// Known CSL team (Shanghai Port, Transfermarkt id 27190) gets a zh overlay
	// merged onto the English name from the crawler.
	names := tr.teamNames(27190, "Shanghai Port")
	if names["en"] != "Shanghai Port" {
		t.Fatalf("expected english name preserved, got %q", names["en"])
	}
	if names["zh"] != "上海海港" {
		t.Fatalf("expected zh overlay, got %q", names["zh"])
	}

	// Unknown id: English only, no crash.
	plain := tr.teamNames(999999999, "Some Club")
	if plain["en"] != "Some Club" || len(plain) != 1 {
		t.Fatalf("expected english-only names for unknown id, got %v", plain)
	}
}

func TestSpiderFetcherAppliesTeamTranslations(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.Method == http.MethodPost {
			writer.WriteHeader(http.StatusOK)
			_, _ = writer.Write([]byte(`{"enqueued":1}`))
			return
		}
		writer.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(writer).Encode([]map[string]any{
			{
				"match_id":       1,
				"competition_id": "CSL",
				"season_id":      2025,
				"kickoff":        "2026-03-15T19:35:00",
				"home_team_id":   27190, // Shanghai Port -> 上海海港
				"away_team_id":   3183,  // Shanghai Shenhua -> 上海申花
				"home_name":      "Shanghai Port",
				"away_name":      "Shanghai Shenhua",
			},
		})
	}))
	defer server.Close()

	fetcher := newTestSpiderFetcher(t, server.URL)
	snapshot, err := fetcher.FetchLeagueSnapshot(context.Background(), domain.LeagueSyncTarget{
		LeagueSlug:      "csl",
		Provider:        ProviderSpider,
		ExternalRef:     "CSL@-1",
		SeasonStartYear: 2026,
	})
	if err != nil {
		t.Fatalf("fetch: %v", err)
	}

	byID := map[int64]domain.LocalizedText{}
	for _, tm := range snapshot.Teams {
		byID[tm.ID] = tm.Names
	}
	if got := byID[27190+spiderTeamIDOffset]["zh"]; got != "上海海港" {
		t.Fatalf("expected home zh name, got %q", got)
	}
	if got := byID[3183+spiderTeamIDOffset]["zh"]; got != "上海申花" {
		t.Fatalf("expected away zh name, got %q", got)
	}
}

func TestParseSpiderRef(t *testing.T) {
	cases := []struct {
		ref       string
		startYear int
		wantCode  string
		wantSaiso int
		wantErr   bool
	}{
		{"GB1", 2025, "GB1", 2025, false},
		{"CSL@-1", 2026, "CSL", 2025, false},
		{"MLS@0", 2026, "MLS", 2026, false},
		{"", 2026, "", 0, true},
		{"CSL@x", 2026, "", 0, true},
	}
	for _, tc := range cases {
		code, saiso, err := parseSpiderRef(tc.ref, tc.startYear)
		if tc.wantErr {
			if err == nil {
				t.Fatalf("parseSpiderRef(%q): expected error", tc.ref)
			}
			continue
		}
		if err != nil {
			t.Fatalf("parseSpiderRef(%q): %v", tc.ref, err)
		}
		if code != tc.wantCode || saiso != tc.wantSaiso {
			t.Fatalf("parseSpiderRef(%q) = %q,%d; want %q,%d", tc.ref, code, saiso, tc.wantCode, tc.wantSaiso)
		}
	}
}

func TestSpiderFetcherRequiresExternalRef(t *testing.T) {
	fetcher := newTestSpiderFetcher(t, "http://127.0.0.1:1")
	_, err := fetcher.FetchLeagueSnapshot(context.Background(), domain.LeagueSyncTarget{
		LeagueSlug:      "csl",
		Provider:        ProviderSpider,
		SeasonStartYear: 2025,
	})
	if err == nil {
		t.Fatalf("expected error for missing external_ref")
	}
}

type stubFetcher struct {
	name   string
	called bool
}

func (s *stubFetcher) FetchLeagueSnapshot(context.Context, domain.LeagueSyncTarget) (domain.LeagueSnapshot, error) {
	s.called = true
	return domain.LeagueSnapshot{DataSourceNote: domain.LocalizedText{"en": s.name}}, nil
}

func TestRoutingFetcherDispatch(t *testing.T) {
	def := &stubFetcher{name: "default"}
	spider := &stubFetcher{name: "spider"}
	router, err := NewRoutingFetcher(def, map[string]SnapshotFetcher{ProviderSpider: spider})
	if err != nil {
		t.Fatalf("new routing fetcher: %v", err)
	}

	if _, err := router.FetchLeagueSnapshot(context.Background(), domain.LeagueSyncTarget{Provider: ProviderSpider}); err != nil {
		t.Fatalf("route spider: %v", err)
	}
	if !spider.called || def.called {
		t.Fatalf("expected spider fetcher to be used")
	}

	def.called, spider.called = false, false
	if _, err := router.FetchLeagueSnapshot(context.Background(), domain.LeagueSyncTarget{Provider: "thesportsdb"}); err != nil {
		t.Fatalf("route default: %v", err)
	}
	if !def.called || spider.called {
		t.Fatalf("expected default fetcher to be used")
	}
}
