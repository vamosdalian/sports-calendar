package ics

import "github.com/vamosdalian/sports-calendar/backend/internal/domain"

type CalendarPayload struct {
	SportSlug                   string
	LeagueSlug                  string
	LeagueNames                 domain.LocalizedText
	SeasonLabel                 string
	DefaultMatchDurationMinutes int
	Matches                     []domain.Match
}
