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
		Locale:                      "en",
		SeasonLabel:                 "2026",
		UpdatedAt:                   "2026-03-08T00:00:00Z",
		DefaultMatchDurationMinutes: 120,
		Matches: []domain.Match{
			{
				ID:        "csl-2026-r1-guoan-shenhua",
				Round:     domain.LocalizedText{"en": "Round 1"},
				StartsAt:  "2026-03-14T11:35:00Z",
				Status:    "scheduled",
				Venue:     domain.LocalizedText{"en": "Workers Stadium"},
				City:      domain.LocalizedText{"en": "Beijing"},
				HomeTeam:  &domain.Team{Slug: "beijing-guoan", Names: domain.LocalizedText{"en": "Beijing Guoan"}},
				AwayTeam:  &domain.Team{Slug: "shanghai-shenhua", Names: domain.LocalizedText{"en": "Shanghai Shenhua"}},
				UpdatedAt: "2026-03-09T00:00:00Z",
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
	if got, want := len(decoded.Events()[0].Children), 1; got != want {
		t.Fatalf("alarm count = %d, want %d", got, want)
	}
	body := string(content)
	if !strings.Contains(body, "CALSCALE:GREGORIAN") || !strings.Contains(body, "METHOD:PUBLISH") {
		t.Fatalf("expected publish calendar metadata body=%s", body)
	}
	if !strings.Contains(body, "LAST-MODIFIED:20260309T000000Z") || !strings.Contains(body, "SEQUENCE:1773014400") {
		t.Fatalf("expected event update metadata body=%s", body)
	}
	if !strings.Contains(body, "TRANSP:OPAQUE") {
		t.Fatalf("expected opaque event transparency body=%s", body)
	}
	if !strings.Contains(body, "BEGIN:VALARM") || !strings.Contains(body, "ACTION:DISPLAY") || !strings.Contains(body, "TRIGGER:-PT1800S") || !strings.Contains(body, "END:VALARM") {
		t.Fatalf("expected 30-minute display reminder body=%s", body)
	}
}

func TestBuildCalendarTeamScopedName(t *testing.T) {
	content, err := backendics.BuildCalendar(backendics.CalendarPayload{
		SportSlug:                   "football",
		LeagueSlug:                  "csl",
		LeagueNames:                 domain.LocalizedText{"en": "Chinese Super League", "zh": "中超"},
		Locale:                      "en",
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
	if body := string(content); !strings.Contains(body, "NAME:Chinese Super League 2026 - Beijing Guoan") || !strings.Contains(body, "X-WR-CALNAME;VALUE=TEXT:Chinese Super League 2026 - Beijing Guoan") || !strings.Contains(body, "CATEGORIES:football,csl,beijing-guoan") {
		t.Fatalf("expected team-scoped calendar metadata body=%s", body)
	}
}

func TestBuildCalendarLocalizedChinese(t *testing.T) {
	content, err := backendics.BuildCalendar(backendics.CalendarPayload{
		SportSlug:                   "football",
		LeagueSlug:                  "csl",
		LeagueNames:                 domain.LocalizedText{"en": "Chinese Super League", "zh": "中超"},
		Locale:                      "zh",
		SeasonLabel:                 "2026",
		DefaultMatchDurationMinutes: 120,
		TeamSlug:                    "beijing-guoan",
		TeamNames:                   domain.LocalizedText{"en": "Beijing Guoan", "zh": "北京国安"},
		Matches: []domain.Match{
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
		},
	}, time.Date(2026, 3, 10, 0, 0, 0, 0, time.UTC))
	if err != nil {
		t.Fatalf("build calendar: %v", err)
	}

	body := string(content)
	if !strings.Contains(body, "NAME:中超 2026 - 北京国安") {
		t.Fatalf("expected localized calendar name body=%s", body)
	}
	if !strings.Contains(body, "PRODID:-//sports-calendar//season-feed//ZH") {
		t.Fatalf("expected localized product id body=%s", body)
	}
	if !strings.Contains(body, "X-WR-CALNAME;VALUE=TEXT:中超 2026 - 北京国安") {
		t.Fatalf("expected localized calendar display name body=%s", body)
	}
	if !strings.Contains(body, "SUMMARY:北京国安 对阵 上海申花") {
		t.Fatalf("expected localized summary body=%s", body)
	}
	if !strings.Contains(body, "轮次: 第1轮") || !strings.Contains(body, "状态: 已安排") || !strings.Contains(body, "场地: 工人体育场\\, 北京\\, 中国") || strings.Contains(body, "城市: 北京") {
		t.Fatalf("expected localized description body=%s", body)
	}
	if !strings.Contains(body, "LOCATION:工人体育场") || strings.Contains(body, "LOCATION:工人体育场\\,") {
		t.Fatalf("expected localized location with venue only body=%s", body)
	}
}

func TestBuildCalendarPreservesMatchStatus(t *testing.T) {
	content, err := backendics.BuildCalendar(backendics.CalendarPayload{
		SportSlug:                   "football",
		LeagueSlug:                  "csl",
		LeagueNames:                 domain.LocalizedText{"en": "Chinese Super League"},
		Locale:                      "en",
		SeasonLabel:                 "2026",
		DefaultMatchDurationMinutes: 120,
		Matches: []domain.Match{
			{
				ID:       "scheduled-match",
				Round:    domain.LocalizedText{"en": "Round 1"},
				StartsAt: "2026-03-14T11:35:00Z",
				Status:   "scheduled",
			},
			{
				ID:       "cancelled-match",
				Round:    domain.LocalizedText{"en": "Round 2"},
				StartsAt: "2026-03-21T11:35:00Z",
				Status:   "cancelled",
			},
			{
				ID:       "postponed-match",
				Round:    domain.LocalizedText{"en": "Round 3"},
				StartsAt: "2026-03-28T11:35:00Z",
				Status:   "postponed",
			},
		},
	}, time.Date(2026, 3, 10, 0, 0, 0, 0, time.UTC))
	if err != nil {
		t.Fatalf("build calendar: %v", err)
	}

	body := string(content)
	if strings.Count(body, "STATUS:CONFIRMED") != 1 || !strings.Contains(body, "STATUS:CANCELLED") || !strings.Contains(body, "STATUS:TENTATIVE") {
		t.Fatalf("expected ICS status mapping to follow match data body=%s", body)
	}
	for _, status := range []string{"scheduled", "cancelled", "postponed"} {
		if !strings.Contains(body, "X-SC-MATCH-STATUS;VALUE=TEXT:"+status) {
			t.Fatalf("expected raw match status %q body=%s", status, body)
		}
	}
}

func TestBuildCalendarFinishedMatchSummaryIncludesScore(t *testing.T) {
	content, err := backendics.BuildCalendar(backendics.CalendarPayload{
		SportSlug:                   "football",
		LeagueSlug:                  "csl",
		LeagueNames:                 domain.LocalizedText{"en": "Chinese Super League", "zh": "中超"},
		Locale:                      "zh",
		SeasonLabel:                 "2026",
		DefaultMatchDurationMinutes: 120,
		Matches: []domain.Match{
			{
				ID:       "finished-match",
				Round:    domain.LocalizedText{"en": "Round 1", "zh": "第1轮"},
				StartsAt: "2026-03-14T11:35:00Z",
				Status:   "finished",
				Result:   []string{"2", "1"},
				HomeTeam: &domain.Team{Slug: "beijing-guoan", Names: domain.LocalizedText{"en": "Beijing Guoan", "zh": "北京国安"}},
				AwayTeam: &domain.Team{Slug: "shanghai-shenhua", Names: domain.LocalizedText{"en": "Shanghai Shenhua", "zh": "上海申花"}},
			},
			{
				ID:       "scheduled-match",
				Round:    domain.LocalizedText{"en": "Round 2", "zh": "第2轮"},
				StartsAt: "2026-03-21T11:35:00Z",
				Status:   "scheduled",
				Result:   []string{"0", "0"},
				HomeTeam: &domain.Team{Slug: "beijing-guoan", Names: domain.LocalizedText{"en": "Beijing Guoan", "zh": "北京国安"}},
				AwayTeam: &domain.Team{Slug: "shanghai-shenhua", Names: domain.LocalizedText{"en": "Shanghai Shenhua", "zh": "上海申花"}},
			},
		},
	}, time.Date(2026, 3, 10, 0, 0, 0, 0, time.UTC))
	if err != nil {
		t.Fatalf("build calendar: %v", err)
	}

	body := string(content)
	if !strings.Contains(body, "SUMMARY:北京国安 2:1 上海申花") {
		t.Fatalf("expected finished match summary with score body=%s", body)
	}
	if !strings.Contains(body, "DESCRIPTION:北京国安 2:1 上海申花") {
		t.Fatalf("expected reminder description with score body=%s", body)
	}
	if !strings.Contains(body, "SUMMARY:北京国安 对阵 上海申花") {
		t.Fatalf("expected scheduled match summary without score body=%s", body)
	}
}
