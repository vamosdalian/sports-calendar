package syncer

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/vamosdalian/sports-calendar/backend/internal/domain"
)

func TestFetchLeagueSnapshot(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.Header.Get("X-API-KEY") != "test-key" {
			t.Fatalf("unexpected api key header: %q", request.Header.Get("X-API-KEY"))
		}

		writer.Header().Set("Content-Type", "application/json")
		switch request.URL.Path {
		case "/api/v2/json/lookup/league/4328":
			_ = json.NewEncoder(writer).Encode(map[string]any{
				"lookup": []map[string]any{{
					"idLeague":         "4328",
					"strLeague":        "English Premier League",
					"strDescriptionEN": "Premier League description",
				}},
			})
		case "/api/v2/json/list/teams/4328":
			_ = json.NewEncoder(writer).Encode(map[string]any{
				"list": []map[string]any{
					{"idTeam": "133602", "strTeam": "Liverpool", "strTeamShort": "LIV"},
					{"idTeam": "134301", "strTeam": "Bournemouth", "strTeamShort": "BOU"},
				},
			})
		case "/api/v2/json/schedule/league/4328/2025-2026":
			_ = json.NewEncoder(writer).Encode(map[string]any{
				"schedule": []map[string]any{
					{
						"idEvent":      "2267073",
						"idHomeTeam":   "133602",
						"idAwayTeam":   "134301",
						"intRound":     "1",
						"strTimestamp": "2025-08-15T19:00:00",
						"strVenue":     "Anfield",
						"strCountry":   "England",
						"strStatus":    "Match Finished",
						"strPostponed": "no",
					},
					{
						"idEvent":      "2267999",
						"idHomeTeam":   "133602",
						"idAwayTeam":   "134301",
						"intRound":     "2",
						"dateEvent":    "2025-08-22",
						"strTime":      "15:00:00",
						"strVenue":     "Anfield",
						"strCountry":   "England",
						"strStatus":    "Not Started",
						"strPostponed": "yes",
					},
				},
			})
		default:
			t.Fatalf("unexpected request path: %s", request.URL.Path)
		}
	}))
	defer server.Close()

	client, err := NewTheSportsDBClient(server.URL, "test-key", 5*time.Second)
	if err != nil {
		t.Fatalf("create client: %v", err)
	}

	snapshot, err := client.FetchLeagueSnapshot(context.Background(), domain.LeagueSyncTarget{
		LeagueID:     4328,
		LeagueSlug:   "pl",
		Provider:     "thesportsdb",
		SyncInterval: "@daily",
		SeasonID:     2,
		SeasonSlug:   "2025-2026",
		SeasonLabel:  "2025-2026",
	})
	if err != nil {
		t.Fatalf("fetch snapshot: %v", err)
	}

	if got := snapshot.LeagueNames["en"]; got != "English Premier League" {
		t.Fatalf("unexpected league name: %q", got)
	}
	if len(snapshot.Teams) != 2 {
		t.Fatalf("unexpected team count: %d", len(snapshot.Teams))
	}
	if got := snapshot.Teams[0].ID; got != 133602 {
		t.Fatalf("unexpected first team id: %d", got)
	}
	if len(snapshot.Matches) != 2 {
		t.Fatalf("unexpected match count: %d", len(snapshot.Matches))
	}
	if len(snapshot.Matches[0].Teams) != 2 || snapshot.Matches[0].Teams[0] != 133602 || snapshot.Matches[0].Teams[1] != 134301 {
		t.Fatalf("unexpected first match teams: %#v", snapshot.Matches[0].Teams)
	}
	if got := snapshot.Matches[0].Status; got != "finished" {
		t.Fatalf("unexpected first match status: %q", got)
	}
	if got := snapshot.Matches[1].Status; got != "postponed" {
		t.Fatalf("unexpected second match status: %q", got)
	}
	if got := snapshot.Matches[0].StartsAt.UTC().Format(time.RFC3339); got != "2025-08-15T19:00:00Z" {
		t.Fatalf("unexpected parsed start time: %q", got)
	}
}

func TestMapMatchStatus(t *testing.T) {
	testCases := []struct {
		name      string
		status    string
		postponed string
		expected  string
	}{
		{name: "default scheduled", status: "Not Started", postponed: "no", expected: "scheduled"},
		{name: "finished", status: "Match Finished", postponed: "no", expected: "finished"},
		{name: "cancelled", status: "Cancelled", postponed: "no", expected: "cancelled"},
		{name: "postponed flag", status: "Not Started", postponed: "yes", expected: "postponed"},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			if got := mapMatchStatus(testCase.status, testCase.postponed); got != testCase.expected {
				t.Fatalf("unexpected status mapping: got %q want %q", got, testCase.expected)
			}
		})
	}
}
