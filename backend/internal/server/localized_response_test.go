package server

import (
	"testing"

	"github.com/vamosdalian/sports-calendar/backend/internal/domain"
)

// localizedMatch is a hand-copied DTO, so any field added to domain.Match is
// silently dropped from the public JSON unless it is copied here too. That is
// exactly what happened when the pending-kickoff fields shipped: the ICS feed
// reads domain.Match directly and behaved correctly, while the JSON API served
// kickoffTimeTBD=false for every match and the site had nothing to render from.
func TestLocalizeSeasonDetailKeepsPendingKickoffFields(t *testing.T) {
	payload := domain.SeasonDetail{
		Groups: []domain.MatchGroup{
			{
				Key:   "4.Matchday",
				Label: domain.LocalizedText{"en": "4.Matchday"},
				Matches: []domain.Match{
					{
						ID:             "tm:4909496",
						StartsAt:       "2026-09-05T22:00:00Z",
						KickoffTimeTBD: true,
						MatchDate:      "2026-09-05",
						Status:         "scheduled",
					},
					{
						ID:       "tm:4909440",
						StartsAt: "2026-08-15T17:30:00Z",
						Status:   "scheduled",
					},
				},
			},
		},
	}

	got := localizeSeasonDetail(payload, "zh")
	if len(got.Groups) != 1 || len(got.Groups[0].Matches) != 2 {
		t.Fatalf("unexpected shape: %+v", got.Groups)
	}

	pending := got.Groups[0].Matches[0]
	if !pending.KickoffTimeTBD {
		t.Errorf("KickoffTimeTBD was dropped in localization")
	}
	if pending.MatchDate != "2026-09-05" {
		t.Errorf("MatchDate = %q, want 2026-09-05", pending.MatchDate)
	}
	if pending.StartsAt != "2026-09-05T22:00:00Z" {
		t.Errorf("StartsAt = %q, want the placeholder to survive untouched", pending.StartsAt)
	}

	// A confirmed kickoff must stay unmarked, so clients keep converting it.
	confirmed := got.Groups[0].Matches[1]
	if confirmed.KickoffTimeTBD || confirmed.MatchDate != "" {
		t.Errorf("confirmed match was marked pending: %+v", confirmed)
	}
}
