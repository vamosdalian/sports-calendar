package ics

import "github.com/vamosdalian/sports-calendar/backend/internal/mockdata"

type CalendarPayload struct {
	SportSlug                   string
	LeagueSlug                  string
	LeagueNames                 mockdata.LocalizedText
	SeasonLabel                 string
	DefaultMatchDurationMinutes int
	Matches                     []mockdata.Match
}
