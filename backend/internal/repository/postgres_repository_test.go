package repository

import (
	"testing"
	"time"

	"github.com/vamosdalian/sports-calendar/backend/internal/domain"
)

func TestDeduplicateMatchesIgnoresRoundWhenFixtureMatches(t *testing.T) {
	venueID := int64(10)
	matches := []domain.Match{
		{
			ID:         "manual",
			Round:      domain.LocalizedText{"en": "Round 1"},
			StartsAt:   "2026-06-01T12:00:00Z",
			VenueID:    &venueID,
			HomeTeamID: 1001,
			AwayTeamID: 1002,
			UpdatedAt:  "2026-06-01T10:00:00Z",
		},
		{
			ID:         "api",
			Round:      domain.LocalizedText{"en": "Round 2"},
			StartsAt:   "2026-06-01T12:00:00Z",
			VenueID:    &venueID,
			HomeTeamID: 1001,
			AwayTeamID: 1002,
			UpdatedAt:  "2026-06-01T11:00:00Z",
		},
	}

	got := deduplicateMatches(matches)
	if len(got) != 1 {
		t.Fatalf("expected 1 match after deduplication, got %d", len(got))
	}
	if got[0].ID != "api" {
		t.Fatalf("expected latest updated match to win, got %q", got[0].ID)
	}
}

func TestDeduplicateMatchesIgnoresTeamsWhenTimeAndVenueMatch(t *testing.T) {
	venueID := int64(10)
	matches := []domain.Match{
		{
			ID:         "match-a",
			Round:      domain.LocalizedText{"en": "Round 1"},
			StartsAt:   "2026-06-01T12:00:00Z",
			VenueID:    &venueID,
			HomeTeamID: 1001,
			AwayTeamID: 1002,
			UpdatedAt:  "2026-06-01T10:00:00Z",
		},
		{
			ID:         "match-b",
			Round:      domain.LocalizedText{"en": "Round 2"},
			StartsAt:   "2026-06-01T12:00:00Z",
			VenueID:    &venueID,
			HomeTeamID: 1003,
			AwayTeamID: 1004,
			UpdatedAt:  "2026-06-01T11:00:00Z",
		},
	}

	got := deduplicateMatches(matches)
	if len(got) != 1 {
		t.Fatalf("expected same time and venue to deduplicate, got %d matches", len(got))
	}
	if got[0].ID != "match-b" {
		t.Fatalf("expected latest updated match to win, got %q", got[0].ID)
	}
}

func TestDeduplicateMatchesKeepsVenuelessDifferentTeamsAtSameTime(t *testing.T) {
	// Spider/Transfermarkt fixtures carry no venue; distinct matchups kicking
	// off at the same minute must not be collapsed.
	matches := []domain.Match{
		{
			ID:         "tm:1",
			StartsAt:   "2026-06-01T12:00:00Z",
			VenueID:    nil,
			HomeTeamID: 1001,
			AwayTeamID: 1002,
			UpdatedAt:  "2026-06-01T10:00:00Z",
		},
		{
			ID:         "tm:2",
			StartsAt:   "2026-06-01T12:00:00Z",
			VenueID:    nil,
			HomeTeamID: 1003,
			AwayTeamID: 1004,
			UpdatedAt:  "2026-06-01T11:00:00Z",
		},
	}

	got := deduplicateMatches(matches)
	if len(got) != 2 {
		t.Fatalf("expected venue-less distinct teams to remain visible, got %d matches", len(got))
	}
}

func TestDeduplicateMatchesMergesVenuelessSameTeamsAtSameTime(t *testing.T) {
	// The same venue-less fixture synced twice should still collapse to one.
	matches := []domain.Match{
		{
			ID:         "tm:1",
			StartsAt:   "2026-06-01T12:00:00Z",
			VenueID:    nil,
			HomeTeamID: 1001,
			AwayTeamID: 1002,
			UpdatedAt:  "2026-06-01T10:00:00Z",
		},
		{
			ID:         "tm:1-dup",
			StartsAt:   "2026-06-01T12:00:00Z",
			VenueID:    nil,
			HomeTeamID: 1002, // order-insensitive
			AwayTeamID: 1001,
			UpdatedAt:  "2026-06-01T11:00:00Z",
		},
	}

	got := deduplicateMatches(matches)
	if len(got) != 1 {
		t.Fatalf("expected same venue-less fixture to deduplicate, got %d matches", len(got))
	}
	if got[0].ID != "tm:1-dup" {
		t.Fatalf("expected latest updated match to win, got %q", got[0].ID)
	}
}

func TestDeduplicateMatchesKeepsDifferentVenuesAtSameTime(t *testing.T) {
	venueA := int64(10)
	venueB := int64(20)
	matches := []domain.Match{
		{
			ID:         "match-a",
			Round:      domain.LocalizedText{"en": "Round 1"},
			StartsAt:   "2026-06-01T12:00:00Z",
			VenueID:    &venueA,
			HomeTeamID: 1001,
			AwayTeamID: 1002,
			UpdatedAt:  "2026-06-01T10:00:00Z",
		},
		{
			ID:         "match-b",
			Round:      domain.LocalizedText{"en": "Round 2"},
			StartsAt:   "2026-06-01T12:00:00Z",
			VenueID:    &venueB,
			HomeTeamID: 1003,
			AwayTeamID: 1004,
			UpdatedAt:  "2026-06-01T11:00:00Z",
		},
	}

	got := deduplicateMatches(matches)
	if len(got) != 2 {
		t.Fatalf("expected different venues to remain visible, got %d matches", len(got))
	}
	if got[0].ID != "match-a" || got[1].ID != "match-b" {
		t.Fatalf("expected original order to remain for distinct venues, got %q then %q", got[0].ID, got[1].ID)
	}
}

func TestDeduplicateMatchesKeepsNilAndSetVenueSeparate(t *testing.T) {
	venueID := int64(10)
	matches := []domain.Match{
		{
			ID:         "match-a",
			Round:      domain.LocalizedText{"en": "Round 1"},
			StartsAt:   "2026-06-01T12:00:00Z",
			VenueID:    nil,
			HomeTeamID: 1001,
			AwayTeamID: 1002,
			UpdatedAt:  "2026-06-01T10:00:00Z",
		},
		{
			ID:         "match-b",
			Round:      domain.LocalizedText{"en": "Round 2"},
			StartsAt:   "2026-06-01T12:00:00Z",
			VenueID:    &venueID,
			HomeTeamID: 1003,
			AwayTeamID: 1004,
			UpdatedAt:  "2026-06-01T11:00:00Z",
		},
	}

	got := deduplicateMatches(matches)
	if len(got) != 2 {
		t.Fatalf("expected nil and set venue to remain visible, got %d matches", len(got))
	}
	if got[0].ID != "match-a" || got[1].ID != "match-b" {
		t.Fatalf("expected original order to remain for nil/set venue mismatch, got %q then %q", got[0].ID, got[1].ID)
	}
}

// A fixture whose kickoff time is still pending is stored at midnight in the
// source's zone. Read as a raw instant that midnight belongs to the previous
// day, so the published date has to be recovered in the source zone -- getting
// this wrong silently files a Saturday match under Sunday for every viewer east
// of Berlin, which is most of the audience.
func TestPublishedMatchDateRecoversTheSourceDay(t *testing.T) {
	for _, tc := range []struct {
		name     string
		startsAt string
		want     string
	}{
		// CEST (UTC+2): local midnight on 5 Sep is 22:00Z on 4 Sep.
		{"summer", "2026-09-04T22:00:00Z", "2026-09-05"},
		// CET (UTC+1): local midnight on 12 Dec is 23:00Z on 11 Dec.
		{"winter", "2026-12-11T23:00:00Z", "2026-12-12"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			startsAt, err := time.Parse(time.RFC3339, tc.startsAt)
			if err != nil {
				t.Fatalf("parse %s: %v", tc.startsAt, err)
			}
			if got := publishedMatchDate(startsAt); got != tc.want {
				t.Fatalf("publishedMatchDate(%s) = %s, want %s", tc.startsAt, got, tc.want)
			}
		})
	}
}
