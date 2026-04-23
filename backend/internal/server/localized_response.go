package server

import "github.com/vamosdalian/sports-calendar/backend/internal/service"

type localizedLeaguesResponse struct {
	Items     []localizedSportDirectoryItem `json:"items"`
	UpdatedAt string                        `json:"updatedAt"`
}

type localizedSportDirectoryItem struct {
	SportSlug string                     `json:"sportSlug"`
	SportName string                     `json:"sportName"`
	Leagues   []localizedLeagueReference `json:"leagues"`
}

type localizedLeagueReference struct {
	LeagueSlug    string                  `json:"leagueSlug"`
	LeagueName    string                  `json:"leagueName"`
	Show          bool                    `json:"show"`
	DefaultSeason service.SeasonReference `json:"defaultSeason"`
}

type localizedLeagueSeasons struct {
	SportSlug  string                    `json:"sportSlug"`
	SportName  string                    `json:"sportName"`
	LeagueSlug string                    `json:"leagueSlug"`
	LeagueName string                    `json:"leagueName"`
	Seasons    []service.SeasonReference `json:"seasons"`
	UpdatedAt  string                    `json:"updatedAt"`
}

type localizedSeasonDetail struct {
	SportSlug                   string                `json:"sportSlug"`
	SportName                   string                `json:"sportName"`
	LeagueSlug                  string                `json:"leagueSlug"`
	LeagueName                  string                `json:"leagueName"`
	SeasonSlug                  string                `json:"seasonSlug"`
	SeasonLabel                 string                `json:"seasonLabel"`
	DefaultMatchDurationMinutes int                   `json:"defaultMatchDurationMinutes"`
	CalendarDescription         string                `json:"calendarDescription"`
	DataSourceNote              string                `json:"dataSourceNote"`
	Notes                       string                `json:"notes"`
	Groups                      []localizedMatchGroup `json:"groups"`
	UpdatedAt                   string                `json:"updatedAt"`
}

type localizedMatchGroup struct {
	Key     string           `json:"key"`
	Label   string           `json:"label"`
	Matches []localizedMatch `json:"matches"`
}

type localizedMatch struct {
	ID         string         `json:"id"`
	Round      string         `json:"round"`
	Title      string         `json:"title"`
	StartsAt   string         `json:"startsAt"`
	Status     string         `json:"status"`
	VenueID    *int64         `json:"venueId,omitempty"`
	Venue      string         `json:"venue"`
	City       string         `json:"city"`
	Country    string         `json:"country"`
	HomeTeamID int64          `json:"homeTeamID,omitempty"`
	AwayTeamID int64          `json:"awayTeamID,omitempty"`
	HomeTeam   *localizedTeam `json:"homeTeam,omitempty"`
	AwayTeam   *localizedTeam `json:"awayTeam,omitempty"`
}

type localizedTeam struct {
	Slug string `json:"slug"`
	Name string `json:"name"`
}

func localizeLeaguesResponse(payload service.LeaguesResponse, locale string) localizedLeaguesResponse {
	items := make([]localizedSportDirectoryItem, 0, len(payload.Items))
	for _, item := range payload.Items {
		leagues := make([]localizedLeagueReference, 0, len(item.Leagues))
		for _, league := range item.Leagues {
			leagues = append(leagues, localizedLeagueReference{
				LeagueSlug:    league.LeagueSlug,
				LeagueName:    pickLocalizedText(league.LeagueNames, locale),
				Show:          league.Show,
				DefaultSeason: league.DefaultSeason,
			})
		}

		items = append(items, localizedSportDirectoryItem{
			SportSlug: item.SportSlug,
			SportName: pickLocalizedText(item.SportNames, locale),
			Leagues:   leagues,
		})
	}

	return localizedLeaguesResponse{
		Items:     items,
		UpdatedAt: payload.UpdatedAt,
	}
}

func localizeLeagueSeasons(payload service.LeagueSeasons, locale string) localizedLeagueSeasons {
	return localizedLeagueSeasons{
		SportSlug:  payload.SportSlug,
		SportName:  pickLocalizedText(payload.SportNames, locale),
		LeagueSlug: payload.LeagueSlug,
		LeagueName: pickLocalizedText(payload.LeagueNames, locale),
		Seasons:    payload.Seasons,
		UpdatedAt:  payload.UpdatedAt,
	}
}

func localizeSeasonDetail(payload service.SeasonDetail, locale string) localizedSeasonDetail {
	groups := make([]localizedMatchGroup, 0, len(payload.Groups))
	for _, group := range payload.Groups {
		matches := make([]localizedMatch, 0, len(group.Matches))
		for _, match := range group.Matches {
			localized := localizedMatch{
				ID:         match.ID,
				Round:      pickLocalizedText(match.Round, locale),
				Title:      match.DisplayTitle(locale),
				StartsAt:   match.StartsAt,
				Status:     match.Status,
				VenueID:    match.VenueID,
				Venue:      pickLocalizedText(match.Venue, locale),
				City:       pickLocalizedText(match.City, locale),
				Country:    pickLocalizedText(match.Country, locale),
				HomeTeamID: match.HomeTeamID,
				AwayTeamID: match.AwayTeamID,
			}

			if match.HomeTeam != nil {
				localized.HomeTeam = &localizedTeam{
					Slug: match.HomeTeam.Slug,
					Name: pickLocalizedText(match.HomeTeam.Names, locale),
				}
			}

			if match.AwayTeam != nil {
				localized.AwayTeam = &localizedTeam{
					Slug: match.AwayTeam.Slug,
					Name: pickLocalizedText(match.AwayTeam.Names, locale),
				}
			}

			matches = append(matches, localized)
		}

		groups = append(groups, localizedMatchGroup{
			Key:     group.Key,
			Label:   pickLocalizedText(group.Label, locale),
			Matches: matches,
		})
	}

	return localizedSeasonDetail{
		SportSlug:                   payload.SportSlug,
		SportName:                   pickLocalizedText(payload.SportNames, locale),
		LeagueSlug:                  payload.LeagueSlug,
		LeagueName:                  pickLocalizedText(payload.LeagueNames, locale),
		SeasonSlug:                  payload.SeasonSlug,
		SeasonLabel:                 payload.SeasonLabel,
		DefaultMatchDurationMinutes: payload.DefaultMatchDurationMinutes,
		CalendarDescription:         pickLocalizedText(payload.CalendarDescription, locale),
		DataSourceNote:              pickLocalizedText(payload.DataSourceNote, locale),
		Notes:                       pickLocalizedText(payload.Notes, locale),
		Groups:                      groups,
		UpdatedAt:                   payload.UpdatedAt,
	}
}

func pickLocalizedText(value map[string]string, locale string) string {
	if value == nil {
		return ""
	}
	if text := value[locale]; text != "" {
		return text
	}
	if text := value["en"]; text != "" {
		return text
	}
	for _, text := range value {
		return text
	}
	return ""
}
