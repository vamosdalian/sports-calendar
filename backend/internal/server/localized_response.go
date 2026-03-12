package server

import "github.com/vamosdalian/sports-calendar/backend/internal/service"

type localizedSportsYearResponse struct {
	Year      int                       `json:"year"`
	Items     []localizedSportsYearItem `json:"items"`
	UpdatedAt string                    `json:"updatedAt"`
}

type localizedSportsYearItem struct {
	SportSlug string                           `json:"sportSlug"`
	SportName string                           `json:"sportName"`
	Leagues   []localizedLeagueSeasonReference `json:"leagues"`
}

type localizedLeagueSeasonReference struct {
	LeagueSlug string                    `json:"leagueSlug"`
	LeagueName string                    `json:"leagueName"`
	Seasons    []service.SeasonReference `json:"seasons"`
}

type localizedSeasonDetail struct {
	SportSlug                   string                    `json:"sportSlug"`
	SportName                   string                    `json:"sportName"`
	LeagueSlug                  string                    `json:"leagueSlug"`
	LeagueName                  string                    `json:"leagueName"`
	SeasonSlug                  string                    `json:"seasonSlug"`
	SeasonLabel                 string                    `json:"seasonLabel"`
	DefaultMatchDurationMinutes int                       `json:"defaultMatchDurationMinutes"`
	AvailableSeasons            []service.SeasonReference `json:"availableSeasons"`
	CalendarDescription         string                    `json:"calendarDescription"`
	DataSourceNote              string                    `json:"dataSourceNote"`
	Notes                       string                    `json:"notes"`
	Matches                     []localizedMatch          `json:"matches"`
	UpdatedAt                   string                    `json:"updatedAt"`
}

type localizedMatch struct {
	ID       string         `json:"id"`
	Round    string         `json:"round"`
	Title    string         `json:"title"`
	StartsAt string         `json:"startsAt"`
	Status   string         `json:"status"`
	Venue    string         `json:"venue"`
	City     string         `json:"city"`
	HomeTeam *localizedTeam `json:"homeTeam,omitempty"`
	AwayTeam *localizedTeam `json:"awayTeam,omitempty"`
}

type localizedTeam struct {
	Slug string `json:"slug"`
	Name string `json:"name"`
}

func localizeSportsYearResponse(payload service.SportsYearResponse, locale string) localizedSportsYearResponse {
	items := make([]localizedSportsYearItem, 0, len(payload.Items))
	for _, item := range payload.Items {
		leagues := make([]localizedLeagueSeasonReference, 0, len(item.Leagues))
		for _, league := range item.Leagues {
			leagues = append(leagues, localizedLeagueSeasonReference{
				LeagueSlug: league.LeagueSlug,
				LeagueName: pickLocalizedText(league.LeagueNames, locale),
				Seasons:    league.Seasons,
			})
		}

		items = append(items, localizedSportsYearItem{
			SportSlug: item.SportSlug,
			SportName: pickLocalizedText(item.SportNames, locale),
			Leagues:   leagues,
		})
	}

	return localizedSportsYearResponse{
		Year:      payload.Year,
		Items:     items,
		UpdatedAt: payload.UpdatedAt,
	}
}

func localizeSeasonDetail(payload service.SeasonDetail, locale string) localizedSeasonDetail {
	matches := make([]localizedMatch, 0, len(payload.Matches))
	for _, match := range payload.Matches {
		localized := localizedMatch{
			ID:       match.ID,
			Round:    pickLocalizedText(match.Round, locale),
			Title:    match.DisplayTitle(locale),
			StartsAt: match.StartsAt,
			Status:   match.Status,
			Venue:    pickLocalizedText(match.Venue, locale),
			City:     pickLocalizedText(match.City, locale),
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

	return localizedSeasonDetail{
		SportSlug:                   payload.SportSlug,
		SportName:                   pickLocalizedText(payload.SportNames, locale),
		LeagueSlug:                  payload.LeagueSlug,
		LeagueName:                  pickLocalizedText(payload.LeagueNames, locale),
		SeasonSlug:                  payload.SeasonSlug,
		SeasonLabel:                 payload.SeasonLabel,
		DefaultMatchDurationMinutes: payload.DefaultMatchDurationMinutes,
		AvailableSeasons:            payload.AvailableSeasons,
		CalendarDescription:         pickLocalizedText(payload.CalendarDescription, locale),
		DataSourceNote:              pickLocalizedText(payload.DataSourceNote, locale),
		Notes:                       pickLocalizedText(payload.Notes, locale),
		Matches:                     matches,
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
