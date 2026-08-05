package ics

import "github.com/vamosdalian/sports-calendar/backend/internal/domain"

// ExpiredFeedPayload describes a team feed whose slug no longer matches any team
// in the season — typically because a provider switch renamed the team. The
// subscriber's saved URL is dead and only they can replace it, so instead of a
// 404 their client silently retries forever, we hand back a calendar carrying a
// single notice event pointing at the season page.
type ExpiredFeedPayload struct {
	SportSlug      string
	LeagueSlug     string
	LeagueNames    domain.LocalizedText
	Locale         string
	SeasonLabel    string
	TeamSlug       string
	ResubscribeURL string
}

type CalendarPayload struct {
	SportSlug                   string
	LeagueSlug                  string
	LeagueNames                 domain.LocalizedText
	Locale                      string
	SeasonLabel                 string
	UpdatedAt                   string
	DefaultMatchDurationMinutes int
	MoreMatchesURL              string
	TeamSlug                    string
	TeamNames                   domain.LocalizedText
	Matches                     []domain.Match
}
