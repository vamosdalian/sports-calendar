package ics_test

import (
	"bytes"
	"path/filepath"
	"runtime"
	"testing"
	"time"

	ical "github.com/emersion/go-ical"

	backendics "github.com/vamosdalian/sports-calendar/backend/internal/ics"
	"github.com/vamosdalian/sports-calendar/backend/internal/repository"
	"github.com/vamosdalian/sports-calendar/backend/internal/service"
)

func TestBuildCalendar(t *testing.T) {
	_, currentFile, _, _ := runtime.Caller(0)
	catalogPath := filepath.Join(filepath.Dir(currentFile), "..", "..", "..", "shared", "mock", "catalog.json")
	repo, err := repository.NewMockRepository(filepath.Clean(catalogPath))
	if err != nil {
		t.Fatalf("load repository: %v", err)
	}
	svc := service.New(repo)
	detail, err := svc.GetLeagueSeason(t.Context(), "csl", "2026")
	if err != nil {
		t.Fatalf("get detail: %v", err)
	}

	content, err := backendics.BuildCalendar(backendics.CalendarPayload{
		SportSlug:                   detail.SportSlug,
		LeagueSlug:                  detail.LeagueSlug,
		LeagueNames:                 detail.LeagueNames,
		SeasonLabel:                 detail.SeasonLabel,
		DefaultMatchDurationMinutes: detail.DefaultMatchDurationMinutes,
		Matches:                     detail.Matches,
	}, time.Date(2026, 3, 10, 0, 0, 0, 0, time.UTC))
	if err != nil {
		t.Fatalf("build calendar: %v", err)
	}

	decoded, err := ical.NewDecoder(bytes.NewReader(content)).Decode()
	if err != nil {
		t.Fatalf("decode calendar: %v", err)
	}
	if got, want := len(decoded.Events()), len(detail.Matches); got != want {
		t.Fatalf("event count = %d, want %d", got, want)
	}
}
