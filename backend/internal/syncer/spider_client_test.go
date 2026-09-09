package syncer

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sort"
	"strconv"
	"strings"
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
	// Keep polling snappy in tests; the production defaults are seconds/minutes.
	fetcher.pollInterval = time.Millisecond
	fetcher.pollTimeout = 2 * time.Second
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
			_ = json.NewEncoder(writer).Encode(map[string]any{
				"enqueued": 1, "task_ids": []string{"task-1"},
			})
		case request.Method == http.MethodGet && request.URL.Path == "/api/crawl/tasks/task-1":
			writer.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(writer).Encode(map[string]any{
				"id": "task-1", "status": "done", "message": "240 场比赛",
			})
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

// A crawl that fails (Transfermarkt 502s, WAF unsolved, ...) must abort the
// sync *before* fixtures are read. Otherwise the caller would ingest whatever
// the failed run left behind — which is how a bad crawl once wiped a season.
func TestSpiderFetcherFailedCrawlAbortsSync(t *testing.T) {
	var fixturesRead bool
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		switch {
		case request.Method == http.MethodPost && request.URL.Path == "/api/crawl":
			writer.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(writer).Encode(map[string]any{
				"enqueued": 1, "task_ids": []string{"task-1"},
			})
		case request.Method == http.MethodGet && request.URL.Path == "/api/crawl/tasks/task-1":
			writer.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(writer).Encode(map[string]any{
				"id": "task-1", "status": "failed",
				"last_error": "FetchError: upstream returned HTTP 502",
			})
		case request.Method == http.MethodGet && request.URL.Path == "/api/data/fixtures":
			fixturesRead = true
			writer.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(writer).Encode([]map[string]any{})
		default:
			t.Fatalf("unexpected request: %s %s", request.Method, request.URL.Path)
		}
	}))
	defer server.Close()

	fetcher := newTestSpiderFetcher(t, server.URL)
	_, err := fetcher.FetchLeagueSnapshot(context.Background(), domain.LeagueSyncTarget{
		LeagueSlug: "csl", Provider: ProviderSpider,
		ExternalRef: "CSL", SeasonSlug: "2025", SeasonStartYear: 2025,
	})
	if err == nil {
		t.Fatalf("expected sync to fail when the crawl failed")
	}
	if !strings.Contains(err.Error(), "502") {
		t.Fatalf("expected the upstream error to surface, got: %v", err)
	}
	if fixturesRead {
		t.Fatalf("fixtures must not be read after a failed crawl")
	}
}

// The crawler is asynchronous: the fetcher must wait for the run it triggered
// rather than reading the previous run's data.
func TestSpiderFetcherWaitsForRunningCrawl(t *testing.T) {
	var polls int
	var fixturesReadAt int
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		switch {
		case request.Method == http.MethodPost && request.URL.Path == "/api/crawl":
			writer.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(writer).Encode(map[string]any{
				"enqueued": 1, "task_ids": []string{"task-1"},
			})
		case request.Method == http.MethodGet && request.URL.Path == "/api/crawl/tasks/task-1":
			polls++
			status := "running"
			if polls >= 3 {
				status = "done"
			}
			writer.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(writer).Encode(map[string]any{"id": "task-1", "status": status})
		case request.Method == http.MethodGet && request.URL.Path == "/api/data/fixtures":
			fixturesReadAt = polls
			writer.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(writer).Encode([]map[string]any{})
		default:
			t.Fatalf("unexpected request: %s %s", request.Method, request.URL.Path)
		}
	}))
	defer server.Close()

	fetcher := newTestSpiderFetcher(t, server.URL)
	if _, err := fetcher.FetchLeagueSnapshot(context.Background(), domain.LeagueSyncTarget{
		LeagueSlug: "csl", Provider: ProviderSpider,
		ExternalRef: "CSL", SeasonSlug: "2025", SeasonStartYear: 2025,
	}); err != nil {
		t.Fatalf("fetch snapshot: %v", err)
	}
	if polls < 3 {
		t.Fatalf("expected to poll until done, polled %d times", polls)
	}
	if fixturesReadAt != 3 {
		t.Fatalf("fixtures were read after %d polls; want only once the task was done (3)", fixturesReadAt)
	}
}

// A crawl that never finishes must time out rather than hang the sync forever.
func TestSpiderFetcherCrawlTimeout(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		switch {
		case request.Method == http.MethodPost && request.URL.Path == "/api/crawl":
			writer.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(writer).Encode(map[string]any{
				"enqueued": 1, "task_ids": []string{"task-1"},
			})
		case request.Method == http.MethodGet && request.URL.Path == "/api/crawl/tasks/task-1":
			writer.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(writer).Encode(map[string]any{"id": "task-1", "status": "pending"})
		default:
			t.Fatalf("unexpected request: %s %s", request.Method, request.URL.Path)
		}
	}))
	defer server.Close()

	fetcher := newTestSpiderFetcher(t, server.URL)
	fetcher.pollTimeout = 50 * time.Millisecond
	_, err := fetcher.FetchLeagueSnapshot(context.Background(), domain.LeagueSyncTarget{
		LeagueSlug: "csl", Provider: ProviderSpider,
		ExternalRef: "CSL", SeasonSlug: "2025", SeasonStartYear: 2025,
	})
	if err == nil {
		t.Fatalf("expected a timeout error for a crawl that never finishes")
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

// A venue reaches the calendar only through this mapping, and the failure is
// silent: get it wrong and matches simply lose their LOCATION line.
func TestSpiderFetcherMapsVenues(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		switch {
		case request.Method == http.MethodPost && request.URL.Path == "/api/crawl":
			writer.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(writer).Encode(map[string]any{
				"enqueued": 1, "task_ids": []string{"task-1"},
			})
		case request.Method == http.MethodGet && request.URL.Path == "/api/crawl/tasks/task-1":
			writer.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(writer).Encode(map[string]any{
				"id": "task-1", "status": "done",
			})
		case request.Method == http.MethodGet && request.URL.Path == "/api/data/fixtures":
			writer.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(writer).Encode([]map[string]any{
				{
					"match_id": 4625774, "competition_id": "GB1", "season_id": 2025,
					"kickoff": "2025-08-15T21:00:00", "home_team_id": 31, "away_team_id": 989,
					"home_name": "Liverpool FC", "away_name": "AFC Bournemouth",
					"venue":        map[string]any{"id": 31, "name": "Anfield", "city": "Liverpool"},
					"venue_source": "match_page",
				},
				{
					// Same ground, second fixture: must not produce a duplicate
					// venue record in the snapshot.
					"match_id": 4625999, "competition_id": "GB1", "season_id": 2025,
					"kickoff": "2025-08-23T14:00:00", "home_team_id": 31, "away_team_id": 985,
					"home_name": "Liverpool FC", "away_name": "Manchester United",
					"venue":        map[string]any{"id": 31, "name": "Anfield", "city": "Liverpool"},
					"venue_source": "club_home",
				},
				{
					// The venue crawl has not reached this one yet.
					"match_id": 4626000, "competition_id": "GB1", "season_id": 2025,
					"kickoff": "2025-08-24T14:00:00", "home_team_id": 985, "away_team_id": 31,
					"home_name": "Manchester United", "away_name": "Liverpool FC",
					"venue": nil,
				},
			})
		default:
			writer.WriteHeader(http.StatusNotFound)
		}
	}))
	defer server.Close()

	fetcher := newTestSpiderFetcher(t, server.URL)
	snapshot, err := fetcher.FetchLeagueSnapshot(context.Background(), domain.LeagueSyncTarget{
		LeagueSlug: "premier-league", SeasonSlug: "2025-2026",
		SeasonStartYear: 2025, ExternalRef: "GB1",
	})
	if err != nil {
		t.Fatalf("FetchLeagueSnapshot: %v", err)
	}

	if len(snapshot.Venues) != 1 {
		t.Fatalf("expected 1 distinct venue, got %d", len(snapshot.Venues))
	}
	venue := snapshot.Venues[0]
	// The crawler keys a venue by the club that owns the ground, which shares
	// its numeric space with team ids -- hence the offset.
	if venue.ID != 31+spiderVenueIDOffset {
		t.Fatalf("venue id = %d, want %d", venue.ID, 31+spiderVenueIDOffset)
	}
	if got := domain.PickLocalized(venue.Name, "en"); got != "Anfield" {
		t.Fatalf("venue name = %q", got)
	}
	if got := domain.PickLocalized(venue.City, "en"); got != "Liverpool" {
		t.Fatalf("venue city = %q", got)
	}

	if len(snapshot.Matches) != 3 {
		t.Fatalf("expected 3 matches, got %d", len(snapshot.Matches))
	}
	for _, match := range snapshot.Matches[:2] {
		if match.VenueID == nil || *match.VenueID != 31+spiderVenueIDOffset {
			t.Fatalf("match %s venue = %v, want the Anfield id", match.ExternalID, match.VenueID)
		}
	}
	// A match with no venue yet must carry nil, not zero: the repository
	// COALESCEs on it to keep whatever venue is already stored.
	if snapshot.Matches[2].VenueID != nil {
		t.Fatalf("unlocated match got venue %v, want nil", snapshot.Matches[2].VenueID)
	}
}
