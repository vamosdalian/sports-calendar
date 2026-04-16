package ics_test

import (
	"bytes"
	"strings"
	"testing"
	"time"

	ical "github.com/emersion/go-ical"

	"github.com/vamosdalian/sports-calendar/backend/internal/domain"
	backendics "github.com/vamosdalian/sports-calendar/backend/internal/ics"
)

func TestBuildCalendar(t *testing.T) {
	content, err := backendics.BuildCalendar(backendics.CalendarPayload{
		SportSlug:                   "football",
		LeagueSlug:                  "csl",
		LeagueNames:                 domain.LocalizedText{"en": "Chinese Super League", "zh": "中超"},
		SeasonLabel:                 "2026",
		DefaultMatchDurationMinutes: 120,
		Matches: []domain.Match{
			{
				ID:       "csl-2026-r1-guoan-shenhua",
				Round:    domain.LocalizedText{"en": "Round 1"},
				StartsAt: "2026-03-14T11:35:00Z",
				Status:   "scheduled",
				Venue:    domain.LocalizedText{"en": "Workers Stadium"},
				City:     domain.LocalizedText{"en": "Beijing"},
				HomeTeam: &domain.Team{Slug: "beijing-guoan", Names: domain.LocalizedText{"en": "Beijing Guoan"}},
				AwayTeam: &domain.Team{Slug: "shanghai-shenhua", Names: domain.LocalizedText{"en": "Shanghai Shenhua"}},
			},
		},
	}, time.Date(2026, 3, 10, 0, 0, 0, 0, time.UTC))
	if err != nil {
		t.Fatalf("build calendar: %v", err)
	}

	decoded, err := ical.NewDecoder(bytes.NewReader(content)).Decode()
	if err != nil {
		t.Fatalf("decode calendar: %v", err)
	}
	if got, want := len(decoded.Events()), 1; got != want {
		t.Fatalf("event count = %d, want %d", got, want)
	}
}

func TestBuildCalendarTeamScopedName(t *testing.T) {
	content, err := backendics.BuildCalendar(backendics.CalendarPayload{
		SportSlug:                   "football",
		LeagueSlug:                  "csl",
		LeagueNames:                 domain.LocalizedText{"en": "Chinese Super League", "zh": "中超"},
		SeasonLabel:                 "2026",
		DefaultMatchDurationMinutes: 120,
		TeamSlug:                    "beijing-guoan",
		TeamNames:                   domain.LocalizedText{"en": "Beijing Guoan", "zh": "北京国安"},
		Matches: []domain.Match{
			{
				ID:       "csl-2026-r1-guoan-shenhua",
				Round:    domain.LocalizedText{"en": "Round 1"},
				StartsAt: "2026-03-14T11:35:00Z",
				Status:   "scheduled",
				Venue:    domain.LocalizedText{"en": "Workers Stadium"},
				City:     domain.LocalizedText{"en": "Beijing"},
				HomeTeam: &domain.Team{Slug: "beijing-guoan", Names: domain.LocalizedText{"en": "Beijing Guoan"}},
				AwayTeam: &domain.Team{Slug: "shanghai-shenhua", Names: domain.LocalizedText{"en": "Shanghai Shenhua"}},
			},
		},
	}, time.Date(2026, 3, 10, 0, 0, 0, 0, time.UTC))
	if err != nil {
		t.Fatalf("build calendar: %v", err)
	}
	if body := string(content); !strings.Contains(body, "NAME:Chinese Super League 2026 - Beijing Guoan") || !strings.Contains(body, "CATEGORIES:football,csl,beijing-guoan") {
		t.Fatalf("expected team-scoped calendar metadata body=%s", body)
	}
}
