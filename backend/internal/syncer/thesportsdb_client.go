package syncer

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"
	"unicode"

	"github.com/vamosdalian/sports-calendar/backend/internal/domain"
)

type SnapshotFetcher interface {
	FetchLeagueSnapshot(ctx context.Context, target domain.LeagueSyncTarget) (domain.LeagueSnapshot, error)
}

type TheSportsDBClient struct {
	baseURL    string
	apiKey     string
	httpClient *http.Client
}

type leagueLookupResponse struct {
	Lookup []leagueLookupItem `json:"lookup"`
}

type leagueLookupItem struct {
	LeagueID         string `json:"idLeague"`
	LeagueName       string `json:"strLeague"`
	DescriptionEN    string `json:"strDescriptionEN"`
	CurrentSeason    string `json:"strCurrentSeason"`
	Country          string `json:"strCountry"`
	Website          string `json:"strWebsite"`
	LeagueAlternate  string `json:"strLeagueAlternate"`
	Sport            string `json:"strSport"`
	Naming           string `json:"strNaming"`
	Complete         string `json:"strComplete"`
	Locked           string `json:"strLocked"`
	Banner           string `json:"strBanner"`
	Badge            string `json:"strBadge"`
	Logo             string `json:"strLogo"`
	Poster           string `json:"strPoster"`
	Trophy           string `json:"strTrophy"`
	Fanart1          string `json:"strFanart1"`
	Fanart2          string `json:"strFanart2"`
	Fanart3          string `json:"strFanart3"`
	Fanart4          string `json:"strFanart4"`
	Youtube          string `json:"strYoutube"`
	Instagram        string `json:"strInstagram"`
	Twitter          string `json:"strTwitter"`
	Facebook         string `json:"strFacebook"`
	RSS              string `json:"strRSS"`
	DateFirstEvent   string `json:"dateFirstEvent"`
	FormedYear       string `json:"intFormedYear"`
	Division         string `json:"intDivision"`
	Gender           string `json:"strGender"`
	LeagueAlternate2 string `json:"strLeagueAlternate2"`
}

type teamListResponse struct {
	List []teamListItem `json:"list"`
}

type allSportsResponse struct {
	All []allSportsItem `json:"all"`
}

type allSportsItem struct {
	SportID string `json:"idSport"`
	Name    string `json:"strSport"`
}

type allLeaguesResponse struct {
	All []allLeaguesItem `json:"all"`
}

type allLeaguesItem struct {
	LeagueID string `json:"idLeague"`
	Name     string `json:"strLeague"`
	Sport    string `json:"strSport"`
}

type seasonsListResponse struct {
	List []seasonsListItem `json:"list"`
}

type seasonsListItem struct {
	Season string `json:"strSeason"`
}

type teamListItem struct {
	TeamID    string `json:"idTeam"`
	TeamName  string `json:"strTeam"`
	ShortName string `json:"strTeamShort"`
}

type scheduleResponse struct {
	Schedule []scheduleItem `json:"schedule"`
}

type scheduleItem struct {
	EventID      string `json:"idEvent"`
	HomeTeamID   string `json:"idHomeTeam"`
	AwayTeamID   string `json:"idAwayTeam"`
	Round        string `json:"intRound"`
	Timestamp    string `json:"strTimestamp"`
	DateEvent    string `json:"dateEvent"`
	TimeEvent    string `json:"strTime"`
	Venue        string `json:"strVenue"`
	Country      string `json:"strCountry"`
	Status       string `json:"strStatus"`
	Postponed    string `json:"strPostponed"`
	EventName    string `json:"strEvent"`
	HomeTeamName string `json:"strHomeTeam"`
	AwayTeamName string `json:"strAwayTeam"`
	LeagueName   string `json:"strLeague"`
	Sport        string `json:"strSport"`
	HomeScore    string `json:"intHomeScore"`
	AwayScore    string `json:"intAwayScore"`
}

func NewTheSportsDBClient(baseURL, apiKey string, timeout time.Duration) (*TheSportsDBClient, error) {
	trimmedBaseURL := strings.TrimRight(baseURL, "/")
	if trimmedBaseURL == "" {
		return nil, fmt.Errorf("theSportsDB baseURL is required")
	}
	if apiKey == "" {
		return nil, fmt.Errorf("theSportsDB apiKey is required")
	}
	if timeout <= 0 {
		timeout = 15 * time.Second
	}

	return &TheSportsDBClient{
		baseURL: trimmedBaseURL,
		apiKey:  apiKey,
		httpClient: &http.Client{
			Timeout: timeout,
		},
	}, nil
}

func (c *TheSportsDBClient) FetchLeagueSnapshot(ctx context.Context, target domain.LeagueSyncTarget) (domain.LeagueSnapshot, error) {
	leagueID := strconv.FormatInt(target.LeagueID, 10)

	var leaguePayload leagueLookupResponse
	if err := c.getJSON(ctx, "/api/v2/json/lookup/league/"+url.PathEscape(leagueID), &leaguePayload); err != nil {
		return domain.LeagueSnapshot{}, err
	}
	if len(leaguePayload.Lookup) == 0 {
		return domain.LeagueSnapshot{}, fmt.Errorf("theSportsDB league %s not found", leagueID)
	}
	league := leaguePayload.Lookup[0]

	var teamsPayload teamListResponse
	if err := c.getJSON(ctx, "/api/v2/json/list/teams/"+url.PathEscape(leagueID), &teamsPayload); err != nil {
		return domain.LeagueSnapshot{}, err
	}

	var schedulePayload scheduleResponse
	if err := c.getJSON(ctx, "/api/v2/json/schedule/league/"+url.PathEscape(leagueID)+"/"+url.PathEscape(target.SeasonSlug), &schedulePayload); err != nil {
		return domain.LeagueSnapshot{}, err
	}

	teams := make([]domain.TeamSyncRecord, 0, len(teamsPayload.List))
	for _, team := range teamsPayload.List {
		if team.TeamID == "" || team.TeamName == "" {
			continue
		}
		teamID, err := strconv.ParseInt(strings.TrimSpace(team.TeamID), 10, 64)
		if err != nil {
			return domain.LeagueSnapshot{}, fmt.Errorf("parse team id %q: %w", team.TeamID, err)
		}
		teams = append(teams, domain.TeamSyncRecord{
			ID:        teamID,
			Slug:      slugify(team.TeamName, team.TeamID),
			Names:     englishText(team.TeamName),
			ShortName: englishText(team.ShortName),
		})
	}

	matches := make([]domain.MatchSyncRecord, 0, len(schedulePayload.Schedule))
	for _, event := range schedulePayload.Schedule {
		if event.EventID == "" || event.HomeTeamID == "" || event.AwayTeamID == "" {
			continue
		}
		homeTeamID, err := strconv.ParseInt(strings.TrimSpace(event.HomeTeamID), 10, 64)
		if err != nil {
			return domain.LeagueSnapshot{}, fmt.Errorf("parse event %s home team id %q: %w", event.EventID, event.HomeTeamID, err)
		}
		awayTeamID, err := strconv.ParseInt(strings.TrimSpace(event.AwayTeamID), 10, 64)
		if err != nil {
			return domain.LeagueSnapshot{}, fmt.Errorf("parse event %s away team id %q: %w", event.EventID, event.AwayTeamID, err)
		}
		startsAt, err := parseEventStart(event.Timestamp, event.DateEvent, event.TimeEvent)
		if err != nil {
			return domain.LeagueSnapshot{}, fmt.Errorf("parse event %s start time: %w", event.EventID, err)
		}
		matches = append(matches, domain.MatchSyncRecord{
			ExternalID: event.EventID,
			Teams:      []int64{homeTeamID, awayTeamID},
			TeamNames: []domain.LocalizedText{
				englishText(event.HomeTeamName),
				englishText(event.AwayTeamName),
			},
			Round:    roundText(event.Round),
			Venue:    englishText(event.Venue),
			City:     emptyLocalizedText(),
			Country:  englishText(event.Country),
			StartsAt: startsAt,
			Status:   mapMatchStatus(event.Status, event.Postponed),
		})
	}

	dataSourceNote := englishText(fmt.Sprintf("Synced from TheSportsDB league %d for season %s", target.LeagueID, target.SeasonSlug))

	return domain.LeagueSnapshot{
		Target:              target,
		LeagueNames:         englishText(league.LeagueName),
		CalendarDescription: englishText(league.DescriptionEN),
		DataSourceNote:      dataSourceNote,
		Teams:               teams,
		Matches:             matches,
	}, nil
}

func (c *TheSportsDBClient) ListSports(ctx context.Context) ([]domain.AdminExternalSportOption, error) {
	var payload allSportsResponse
	if err := c.getJSON(ctx, "/api/v2/json/all/sports", &payload); err != nil {
		return nil, err
	}
	items := make([]domain.AdminExternalSportOption, 0, len(payload.All))
	for _, item := range payload.All {
		name := strings.TrimSpace(item.Name)
		if name == "" {
			continue
		}
		id, err := strconv.ParseInt(strings.TrimSpace(item.SportID), 10, 64)
		if err != nil {
			continue
		}
		items = append(items, domain.AdminExternalSportOption{
			ID:            id,
			Name:          name,
			SuggestedSlug: slugify(name, item.SportID),
		})
	}
	sort.Slice(items, func(i, j int) bool {
		return items[i].Name < items[j].Name
	})
	return items, nil
}

func (c *TheSportsDBClient) ListLeaguesBySport(ctx context.Context, sportName string) ([]domain.AdminExternalLeagueOption, error) {
	var payload allLeaguesResponse
	if err := c.getJSON(ctx, "/api/v2/json/all/leagues", &payload); err != nil {
		return nil, err
	}
	normalizedSport := normalizeExternalName(sportName)
	items := make([]domain.AdminExternalLeagueOption, 0, len(payload.All))
	for _, item := range payload.All {
		name := strings.TrimSpace(item.Name)
		itemSport := strings.TrimSpace(item.Sport)
		if name == "" || itemSport == "" {
			continue
		}
		if normalizedSport != "" && normalizeExternalName(itemSport) != normalizedSport {
			continue
		}
		id, err := strconv.ParseInt(strings.TrimSpace(item.LeagueID), 10, 64)
		if err != nil {
			continue
		}
		items = append(items, domain.AdminExternalLeagueOption{
			ID:            id,
			Name:          name,
			Sport:         itemSport,
			SuggestedSlug: slugify(name, item.LeagueID),
		})
	}
	sort.Slice(items, func(i, j int) bool {
		return items[i].Name < items[j].Name
	})
	return items, nil
}

func (c *TheSportsDBClient) LookupLeague(ctx context.Context, leagueID int64) (domain.AdminExternalLeagueLookup, error) {
	var payload leagueLookupResponse
	path := "/api/v2/json/lookup/league/" + url.PathEscape(strconv.FormatInt(leagueID, 10))
	if err := c.getJSON(ctx, path, &payload); err != nil {
		return domain.AdminExternalLeagueLookup{}, err
	}
	if len(payload.Lookup) == 0 {
		return domain.AdminExternalLeagueLookup{}, fmt.Errorf("theSportsDB league %d not found", leagueID)
	}
	item := payload.Lookup[0]
	return domain.AdminExternalLeagueLookup{
		ID:                  leagueID,
		Name:                strings.TrimSpace(item.LeagueName),
		Sport:               strings.TrimSpace(item.Sport),
		Country:             strings.TrimSpace(item.Country),
		CurrentSeason:       strings.TrimSpace(item.CurrentSeason),
		SuggestedSlug:       slugify(item.LeagueName, strconv.FormatInt(leagueID, 10)),
		CalendarDescription: strings.TrimSpace(item.DescriptionEN),
		DataSourceNote:      strings.TrimSpace(fmt.Sprintf("Synced from TheSportsDB league %d", leagueID)),
		SyncInterval:        "@daily",
	}, nil
}

func (c *TheSportsDBClient) ListSeasons(ctx context.Context, leagueID int64) ([]domain.AdminExternalSeasonOption, error) {
	var payload seasonsListResponse
	path := "/api/v2/json/list/seasons/" + url.PathEscape(strconv.FormatInt(leagueID, 10))
	if err := c.getJSON(ctx, path, &payload); err != nil {
		return nil, err
	}
	items := make([]domain.AdminExternalSeasonOption, 0, len(payload.List))
	for _, item := range payload.List {
		value := strings.TrimSpace(item.Season)
		if value == "" {
			continue
		}
		startYear, endYear := parseSeasonYears(value)
		items = append(items, domain.AdminExternalSeasonOption{
			SeasonValue:   value,
			Label:         value,
			SuggestedSlug: value,
			StartYear:     startYear,
			EndYear:       endYear,
		})
	}
	sort.Slice(items, func(i, j int) bool {
		return items[i].SeasonValue > items[j].SeasonValue
	})
	return items, nil
}

func (c *TheSportsDBClient) getJSON(ctx context.Context, path string, destination any) error {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+path, nil)
	if err != nil {
		return fmt.Errorf("build request %s: %w", path, err)
	}
	request.Header.Set("Accept", "application/json")
	request.Header.Set("X-API-KEY", c.apiKey)

	response, err := c.httpClient.Do(request)
	if err != nil {
		return fmt.Errorf("request %s: %w", path, err)
	}
	defer response.Body.Close()

	if response.StatusCode != http.StatusOK {
		return fmt.Errorf("request %s: unexpected status %d", path, response.StatusCode)
	}

	if err := json.NewDecoder(response.Body).Decode(destination); err != nil {
		return fmt.Errorf("decode response %s: %w", path, err)
	}
	return nil
}

func englishText(value string) domain.LocalizedText {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return emptyLocalizedText()
	}
	return domain.LocalizedText{"en": trimmed}
}

func emptyLocalizedText() domain.LocalizedText {
	return domain.LocalizedText{}
}

func roundText(value string) domain.LocalizedText {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return emptyLocalizedText()
	}
	return domain.LocalizedText{"en": fmt.Sprintf("Round %s", trimmed)}
}

func parseEventStart(timestamp, dateText, timeText string) (time.Time, error) {
	trimmedTimestamp := strings.TrimSpace(timestamp)
	if trimmedTimestamp != "" {
		for _, layout := range []string{time.RFC3339, "2006-01-02T15:04:05", "2006-01-02 15:04:05"} {
			if parsed, err := time.Parse(layout, trimmedTimestamp); err == nil {
				return parsed.UTC(), nil
			}
			if parsed, err := time.ParseInLocation(layout, trimmedTimestamp, time.UTC); err == nil {
				return parsed.UTC(), nil
			}
		}
	}

	trimmedDate := strings.TrimSpace(dateText)
	trimmedTime := strings.TrimSpace(timeText)
	if trimmedDate == "" {
		return time.Time{}, fmt.Errorf("missing event date")
	}
	if trimmedTime == "" {
		trimmedTime = "00:00:00"
	}
	parsed, err := time.ParseInLocation("2006-01-02T15:04:05", trimmedDate+"T"+trimmedTime, time.UTC)
	if err != nil {
		return time.Time{}, err
	}
	return parsed.UTC(), nil
}

func mapMatchStatus(status, postponed string) string {
	if strings.EqualFold(strings.TrimSpace(postponed), "yes") {
		return "postponed"
	}

	normalized := strings.ToLower(strings.TrimSpace(status))
	switch {
	case normalized == "":
		return "scheduled"
	case strings.Contains(normalized, "cancel"):
		return "cancelled"
	case strings.Contains(normalized, "postpon"):
		return "postponed"
	case strings.Contains(normalized, "finish") || strings.Contains(normalized, "ft"):
		return "finished"
	default:
		return "scheduled"
	}
}

func normalizeExternalName(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}

func parseSeasonYears(value string) (int, int) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return 0, 0
	}
	parts := strings.Split(trimmed, "-")
	if len(parts) == 1 {
		year, err := strconv.Atoi(strings.TrimSpace(parts[0]))
		if err != nil {
			return 0, 0
		}
		return year, year
	}
	startYear, err := strconv.Atoi(strings.TrimSpace(parts[0]))
	if err != nil {
		return 0, 0
	}
	endText := strings.TrimSpace(parts[len(parts)-1])
	if len(endText) == 2 && len(parts[0]) >= 2 {
		prefix := parts[0][:len(parts[0])-2]
		endText = prefix + endText
	}
	endYear, err := strconv.Atoi(endText)
	if err != nil {
		return startYear, startYear
	}
	return startYear, endYear
}

func slugify(value, fallback string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return strings.ToLower(strings.TrimSpace(fallback))
	}

	var builder strings.Builder
	lastDash := false
	for _, char := range strings.ToLower(trimmed) {
		switch {
		case unicode.IsLetter(char) || unicode.IsDigit(char):
			builder.WriteRune(char)
			lastDash = false
		case !lastDash:
			builder.WriteByte('-')
			lastDash = true
		}
	}

	slug := strings.Trim(builder.String(), "-")
	if slug != "" {
		return slug
	}
	return strings.ToLower(strings.TrimSpace(fallback))
}
