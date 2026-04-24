package ics

import "github.com/vamosdalian/sports-calendar/backend/internal/domain"

type CalendarPayload struct {
	SportSlug                   string
	LeagueSlug                  string
	LeagueNames                 domain.LocalizedText
	Locale                      string
	SeasonLabel                 string
	UpdatedAt                   string
	DefaultMatchDurationMinutes int
	TeamSlug                    string
	TeamNames                   domain.LocalizedText
	Matches                     []domain.Match
}
