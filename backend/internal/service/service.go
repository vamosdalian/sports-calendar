package service

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/vamosdalian/sports-calendar/backend/internal/domain"
	"github.com/vamosdalian/sports-calendar/backend/internal/ics"
)

var ErrNotFound = domain.ErrNotFound
var ErrConflict = domain.ErrConflict
var ErrInvalidArgument = domain.ErrInvalidArgument
var ErrUnauthorized = domain.ErrUnauthorized

// ErrFeedEmpty means the current season resolved but carries no fixtures, so
// rendering the feed would produce an empty calendar.
//
// This is never served as a 200. A subscribed calendar treats every fetch as an
// authoritative full snapshot and deletes any event missing from it, so an
// empty feed does not read as "nothing new" to a client -- it reads as "delete
// every match this user had", across every subscriber at once, with no way to
// undo it and no error the user would ever see. An upstream failure that
// empties a season has already happened once on the ingest side; this is the
// same guard on the serving side.
var ErrFeedEmpty = errors.New("feed has no fixtures")

type repository interface {
	ListLeagues(ctx context.Context) ([]domain.SportDirectoryItem, string, error)
	ListLeagueSeasons(ctx context.Context, sportSlug, leagueSlug string) (domain.LeagueSeasons, error)
	GetLeagueSeason(ctx context.Context, sportSlug, leagueSlug, seasonSlug string) (domain.SeasonDetail, error)
	GetAdminLeagueSeason(ctx context.Context, sportSlug, leagueSlug, seasonSlug string) (domain.SeasonDetail, error)
	GetSeasonSyncTarget(ctx context.Context, sportSlug, leagueSlug, seasonSlug string) (domain.LeagueSyncTarget, error)
	ListAdminSports(ctx context.Context) (domain.AdminSportsResponse, error)
	ListAdminLocales(ctx context.Context) (domain.AdminLocalesResponse, error)
	ListAdminLeagues(ctx context.Context, sportSlug string) (domain.AdminLeaguesResponse, error)
	ListAdminSeasons(ctx context.Context, sportSlug, leagueSlug string) (domain.AdminSeasonsResponse, error)
	ListAdminTeams(ctx context.Context, sportSlug, leagueSlug string) (domain.AdminTeamsResponse, error)
	ListAdminVenues(ctx context.Context) (domain.AdminVenuesResponse, error)
	CountUsers(ctx context.Context) (int64, error)
	CreateUser(ctx context.Context, email, passwordHash string) (domain.UserRecord, error)
	GetUserByEmail(ctx context.Context, email string) (domain.UserRecord, string, error)
	CreateAdminLocale(ctx context.Context, input domain.CreateAdminLocaleInput) (domain.AdminLocaleItem, error)
	UpdateAdminLocale(ctx context.Context, input domain.UpdateAdminLocaleInput) (domain.AdminLocaleItem, error)
	DeleteAdminLocale(ctx context.Context, code string) error
	CreateSport(ctx context.Context, input domain.CreateSportInput) (domain.SportRecord, error)
	UpdateSport(ctx context.Context, input domain.UpdateSportInput) (domain.SportRecord, error)
	DeleteSport(ctx context.Context, input domain.DeleteSportInput) error
	CreateLeague(ctx context.Context, input domain.CreateLeagueInput) (domain.LeagueRecord, error)
	UpdateLeague(ctx context.Context, input domain.UpdateLeagueInput) (domain.LeagueRecord, error)
	UpdateTeam(ctx context.Context, input domain.UpdateTeamInput) (domain.AdminTeamItem, error)
	CreateVenue(ctx context.Context, input domain.CreateVenueInput) (domain.VenueRecord, error)
	UpdateVenue(ctx context.Context, input domain.UpdateVenueInput) (domain.VenueRecord, error)
	DeleteVenue(ctx context.Context, venueID int64) error
	DeleteLeague(ctx context.Context, input domain.DeleteLeagueInput) error
	CreateSeason(ctx context.Context, input domain.CreateSeasonInput) (domain.SeasonRecord, error)
	UpdateSeason(ctx context.Context, input domain.UpdateSeasonInput) (domain.SeasonRecord, error)
	DeleteSeason(ctx context.Context, input domain.DeleteSeasonInput) error
	CreateMatch(ctx context.Context, input domain.CreateMatchInput) error
	UpdateMatch(ctx context.Context, input domain.UpdateMatchInput) error
	DeleteMatch(ctx context.Context, input domain.DeleteMatchInput) error
}

type syncScheduleRefresher interface {
	Refresh(ctx context.Context) error
}

type refreshExecutor interface {
	Enqueue(target domain.LeagueSyncTarget, source domain.RefreshRequestSource) domain.RefreshEnqueueResponse
	Snapshot() domain.RefreshQueueSnapshot
}

type Service struct {
	repo         repository
	tokenManager tokenManager
	refresher    syncScheduleRefresher
	executor     refreshExecutor
	analytics    analyticsStore
	webBaseURL   string
}

const defaultWebBaseURL = "https://sports-calendar.com"

type SportDirectoryItem = domain.SportDirectoryItem
type LeagueReference = domain.LeagueReference
type SeasonReference = domain.SeasonReference
type LeagueSeasons = domain.LeagueSeasons
type MatchGroup = domain.MatchGroup
type SeasonDetail = domain.SeasonDetail
type SportRecord = domain.SportRecord
type LeagueRecord = domain.LeagueRecord
type SeasonRecord = domain.SeasonRecord
type VenueRecord = domain.VenueRecord

type LeaguesResponse struct {
	Items     []domain.SportDirectoryItem `json:"items"`
	UpdatedAt string                      `json:"updatedAt"`
}

func New(repo repository) *Service {
	return &Service{repo: repo}
}

// SetWebBaseURL overrides the public web app address used when a feed needs to
// send a subscriber back to the site. Empty values keep the default.
func (s *Service) SetWebBaseURL(baseURL string) {
	baseURL = strings.TrimRight(strings.TrimSpace(baseURL), "/")
	if baseURL == "" {
		return
	}
	s.webBaseURL = baseURL
}

func (s *Service) seasonPageURL(sportSlug, leagueSlug, seasonSlug, locale string) string {
	baseURL := s.webBaseURL
	if baseURL == "" {
		baseURL = defaultWebBaseURL
	}
	if locale != "zh" {
		locale = "en"
	}
	return fmt.Sprintf("%s/%s/%s/%s/%s", baseURL, locale, sportSlug, leagueSlug, seasonSlug)
}

func (s *Service) SetSyncScheduleRefresher(refresher syncScheduleRefresher) {
	s.refresher = refresher
	if refresher == nil {
		return
	}
	refreshCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = refresher.Refresh(refreshCtx)
}

func (s *Service) SetRefreshExecutor(executor refreshExecutor) {
	s.executor = executor
}

func (s *Service) refreshSyncSchedule() {
	if s.refresher == nil {
		return
	}
	go func(refresher syncScheduleRefresher) {
		refreshCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		_ = refresher.Refresh(refreshCtx)
	}(s.refresher)
}

func (s *Service) CreateSport(ctx context.Context, input domain.CreateSportInput) (SportRecord, error) {
	input.Slug = normalizeSlug(input.Slug)
	input.Name = trimLocalizedText(input.Name)
	if input.ID <= 0 {
		return SportRecord{}, invalidArgument("sport id is required")
	}
	if input.Slug == "" {
		return SportRecord{}, invalidArgument("sport slug is required")
	}
	if err := validateLocalizedText(input.Name, "sport name"); err != nil {
		return SportRecord{}, err
	}
	return s.repo.CreateSport(ctx, input)
}

// leagueProviders are the accepted leagues.provider values. "spider" leagues
// sync from the local Transfermarkt crawler; "manual" leagues are maintained
// by administrators and are never polled automatically.
var leagueProviders = map[string]bool{"spider": true, "manual": true}

// normalizeLeagueProvider lowercases and trims the provider, defaulting blank to
// "spider" since that is the only live sync source.
func normalizeLeagueProvider(provider string) string {
	provider = strings.ToLower(strings.TrimSpace(provider))
	if provider == "" {
		return "spider"
	}
	return provider
}

// validateLeagueProviderRef checks the provider is known and that a spider
// league carries the Transfermarkt competition code it needs to sync (e.g.
// "CSL" or "CSL@-1"); without it the sync fetcher has nothing to crawl.
func validateLeagueProviderRef(provider, externalRef string) error {
	if !leagueProviders[provider] {
		return invalidArgument(fmt.Sprintf("provider must be one of spider, manual (got %q)", provider))
	}
	if provider == "spider" && strings.TrimSpace(externalRef) == "" {
		return invalidArgument("externalRef (Transfermarkt competition code) is required for a spider league")
	}
	return nil
}

func (s *Service) CreateLeague(ctx context.Context, input domain.CreateLeagueInput) (LeagueRecord, error) {
	input.SportSlug = normalizeSlug(input.SportSlug)
	input.Slug = normalizeSlug(input.Slug)
	input.Name = trimLocalizedText(input.Name)
	input.Provider = normalizeLeagueProvider(input.Provider)
	input.ExternalRef = strings.TrimSpace(input.ExternalRef)
	input.SyncInterval = strings.TrimSpace(input.SyncInterval)
	input.CalendarDescription = trimLocalizedText(input.CalendarDescription)
	input.DataSourceNote = trimLocalizedText(input.DataSourceNote)
	input.Notes = trimLocalizedText(input.Notes)

	if input.ID <= 0 {
		return LeagueRecord{}, invalidArgument("league id must be a positive integer")
	}
	if input.SportSlug == "" {
		return LeagueRecord{}, invalidArgument("sportSlug is required")
	}
	if input.Slug == "" {
		return LeagueRecord{}, invalidArgument("league slug is required")
	}
	if err := validateLocalizedText(input.Name, "league name"); err != nil {
		return LeagueRecord{}, err
	}
	if err := validateLeagueProviderRef(input.Provider, input.ExternalRef); err != nil {
		return LeagueRecord{}, err
	}
	if input.SyncInterval == "" {
		input.SyncInterval = "@daily"
	}
	record, err := s.repo.CreateLeague(ctx, input)
	if err != nil {
		return LeagueRecord{}, err
	}
	s.refreshSyncSchedule()
	return record, nil
}

func (s *Service) CreateSeason(ctx context.Context, input domain.CreateSeasonInput) (SeasonRecord, error) {
	input.SportSlug = normalizeSlug(input.SportSlug)
	input.LeagueSlug = normalizeSlug(input.LeagueSlug)
	input.Slug = strings.TrimSpace(input.Slug)
	input.Label = strings.TrimSpace(input.Label)

	if input.SportSlug == "" {
		return SeasonRecord{}, invalidArgument("sportSlug is required")
	}
	if input.LeagueSlug == "" {
		return SeasonRecord{}, invalidArgument("leagueSlug is required")
	}
	if input.Slug == "" {
		return SeasonRecord{}, invalidArgument("season slug is required")
	}
	if input.Label == "" {
		return SeasonRecord{}, invalidArgument("season label is required")
	}
	if input.StartYear <= 0 || input.EndYear <= 0 {
		return SeasonRecord{}, invalidArgument("season years must be positive")
	}
	if input.EndYear < input.StartYear {
		return SeasonRecord{}, invalidArgument("endYear must be greater than or equal to startYear")
	}
	if input.DefaultMatchDurationMinutes <= 0 {
		input.DefaultMatchDurationMinutes = 120
	}
	record, err := s.repo.CreateSeason(ctx, input)
	if err != nil {
		return SeasonRecord{}, err
	}
	s.refreshSyncSchedule()
	return record, nil
}

func (s *Service) DeleteSeason(ctx context.Context, input domain.DeleteSeasonInput) error {
	input.SportSlug = normalizeSlug(input.SportSlug)
	input.LeagueSlug = normalizeSlug(input.LeagueSlug)
	input.SeasonSlug = strings.TrimSpace(input.SeasonSlug)

	if input.SportSlug == "" {
		return invalidArgument("sport slug is required")
	}
	if input.LeagueSlug == "" {
		return invalidArgument("league slug is required")
	}
	if input.SeasonSlug == "" {
		return invalidArgument("season slug is required")
	}
	if err := s.repo.DeleteSeason(ctx, input); err != nil {
		return err
	}
	s.refreshSyncSchedule()
	return nil
}

func (s *Service) DeleteSport(ctx context.Context, input domain.DeleteSportInput) error {
	input.SportSlug = normalizeSlug(input.SportSlug)
	if input.SportSlug == "" {
		return invalidArgument("sport slug is required")
	}
	if err := s.repo.DeleteSport(ctx, input); err != nil {
		return err
	}
	s.refreshSyncSchedule()
	return nil
}

func (s *Service) DeleteLeague(ctx context.Context, input domain.DeleteLeagueInput) error {
	input.SportSlug = normalizeSlug(input.SportSlug)
	input.LeagueSlug = normalizeSlug(input.LeagueSlug)
	if input.SportSlug == "" {
		return invalidArgument("sport slug is required")
	}
	if input.LeagueSlug == "" {
		return invalidArgument("league slug is required")
	}
	if err := s.repo.DeleteLeague(ctx, input); err != nil {
		return err
	}
	s.refreshSyncSchedule()
	return nil
}

func (s *Service) ListLeagues(ctx context.Context) (LeaguesResponse, error) {
	items, updatedAt, err := s.repo.ListLeagues(ctx)
	if err != nil {
		return LeaguesResponse{}, err
	}
	filteredItems := make([]domain.SportDirectoryItem, 0, len(items))
	for _, item := range items {
		leagues := make([]domain.LeagueReference, 0, len(item.Leagues))
		for _, league := range item.Leagues {
			if !league.Show || league.DefaultSeason.Slug == "" {
				continue
			}
			leagues = append(leagues, league)
		}
		if len(leagues) == 0 {
			continue
		}
		item.Leagues = leagues
		filteredItems = append(filteredItems, item)
	}
	return LeaguesResponse{Items: filteredItems, UpdatedAt: updatedAt}, nil
}

func (s *Service) ListLeagueSeasons(ctx context.Context, sportSlug, leagueSlug string) (LeagueSeasons, error) {
	payload, err := s.repo.ListLeagueSeasons(ctx, sportSlug, leagueSlug)
	if err != nil {
		return LeagueSeasons{}, err
	}
	return payload, nil
}

func (s *Service) GetLeagueSeason(ctx context.Context, sportSlug, leagueSlug, seasonSlug string) (SeasonDetail, error) {
	detail, err := s.repo.GetLeagueSeason(ctx, sportSlug, leagueSlug, seasonSlug)
	if err != nil {
		return SeasonDetail{}, err
	}
	matches := append([]domain.Match(nil), detail.Matches...)
	sort.Slice(matches, func(i, j int) bool {
		left, _ := matches[i].StartTime()
		right, _ := matches[j].StartTime()
		return left.Before(right)
	})
	detail.Matches = matches
	detail.Groups = groupMatches(matches)
	return detail, nil
}

// CurrentSeasonSlug resolves the season a league's feed should serve right now.
//
// It reads the same ordered, show-filtered season list the public directory
// derives defaultSeason from, so the feed and the site can never disagree about
// which season is current: both are "the visible season with the highest start
// year". Adding next season's row with show=false therefore keeps it invisible
// here until it is ready.
func (s *Service) CurrentSeasonSlug(ctx context.Context, sportSlug, leagueSlug string) (string, error) {
	payload, err := s.ListLeagueSeasons(ctx, sportSlug, leagueSlug)
	if err != nil {
		return "", err
	}
	if len(payload.Seasons) == 0 {
		// The repository already treats an empty list as not-found, so this is
		// only a guard against that contract changing underneath us.
		return "", ErrNotFound
	}
	return payload.Seasons[0].Slug, nil
}

// BuildLeagueICS renders the feed for a league's *current* season.
//
// Deliberately takes no season argument. Subscriptions live in a calendar
// client for years and are never revisited by the user, so a feed pinned to one
// season silently stops delivering fixtures the day that season ends -- the
// subscriber keeps polling, keeps getting 200s, and never sees a new match
// again. Resolving the season per request instead means one subscription
// survives every season rollover.
func (s *Service) BuildLeagueICS(ctx context.Context, sportSlug, leagueSlug, locale, teamSlug string) ([]byte, error) {
	seasonSlug, err := s.CurrentSeasonSlug(ctx, sportSlug, leagueSlug)
	if err != nil {
		return nil, err
	}
	detail, err := s.GetLeagueSeason(ctx, sportSlug, leagueSlug, seasonSlug)
	if err != nil {
		return nil, err
	}
	if len(detail.Matches) == 0 {
		// Checked before the team filter on purpose. An empty season would
		// otherwise reach filterMatchesByTeam, find nothing, and be reported to
		// the subscriber as an expired team slug -- telling them to go
		// re-subscribe when the real problem is a transient gap in our data.
		return nil, ErrFeedEmpty
	}
	teamNames := domain.LocalizedText(nil)
	filteredMatches := detail.Matches
	if teamSlug != "" {
		var found bool
		filteredMatches, teamNames, found = filterMatchesByTeam(detail.Matches, teamSlug)
		if !found {
			// The season exists but this team slug does not, so the caller is a
			// client replaying a URL saved before the slug changed. Answering 404
			// leaves it retrying forever with nothing the user can see, so serve a
			// notice calendar telling them to re-subscribe instead.
			return ics.BuildExpiredFeedCalendar(ics.ExpiredFeedPayload{
				SportSlug:      detail.SportSlug,
				LeagueSlug:     detail.LeagueSlug,
				LeagueNames:    detail.LeagueNames,
				Locale:         locale,
				SeasonLabel:    detail.SeasonLabel,
				TeamSlug:       teamSlug,
				ResubscribeURL: s.seasonPageURL(detail.SportSlug, detail.LeagueSlug, seasonSlug, locale),
			}, time.Now().UTC())
		}
	}
	return ics.BuildCalendar(ics.CalendarPayload{
		SportSlug:                   detail.SportSlug,
		LeagueSlug:                  detail.LeagueSlug,
		LeagueNames:                 detail.LeagueNames,
		Locale:                      locale,
		SeasonLabel:                 detail.SeasonLabel,
		UpdatedAt:                   detail.UpdatedAt,
		DefaultMatchDurationMinutes: detail.DefaultMatchDurationMinutes,
		Matches:                     filteredMatches,
		TeamSlug:                    teamSlug,
		TeamNames:                   teamNames,
	}, time.Now().UTC())
}

func filterMatchesByTeam(matches []domain.Match, teamSlug string) ([]domain.Match, domain.LocalizedText, bool) {
	filtered := make([]domain.Match, 0, len(matches))
	var teamNames domain.LocalizedText

	for _, match := range matches {
		if match.HomeTeam != nil && match.HomeTeam.Slug == teamSlug {
			filtered = append(filtered, match)
			if teamNames == nil {
				teamNames = match.HomeTeam.Names
			}
			continue
		}
		if match.AwayTeam != nil && match.AwayTeam.Slug == teamSlug {
			filtered = append(filtered, match)
			if teamNames == nil {
				teamNames = match.AwayTeam.Names
			}
		}
	}

	return filtered, teamNames, len(filtered) > 0
}

func groupMatches(matches []domain.Match) []domain.MatchGroup {
	if len(matches) == 0 {
		return nil
	}

	type groupState struct {
		key   string
		label domain.LocalizedText
		items []domain.Match
	}

	ordered := make([]groupState, 0)
	indexByKey := make(map[string]int)

	for _, match := range matches {
		key := groupKey(match)
		index, exists := indexByKey[key]
		if !exists {
			ordered = append(ordered, groupState{
				key:   key,
				label: groupLabel(match, key),
				items: make([]domain.Match, 0, 1),
			})
			index = len(ordered) - 1
			indexByKey[key] = index
		}
		ordered[index].items = append(ordered[index].items, match)
	}

	groups := make([]domain.MatchGroup, 0, len(ordered))
	for _, state := range ordered {
		groups = append(groups, domain.MatchGroup{
			Key:     state.key,
			Label:   state.label,
			Matches: state.items,
		})
	}
	return groups
}

func groupKey(match domain.Match) string {
	if len(match.Round) > 0 {
		if text := domain.PickLocalized(match.Round, "en"); text != "" {
			return text
		}
		for _, text := range match.Round {
			if text != "" {
				return text
			}
		}
	}
	return fmt.Sprintf("match-%s", match.ID)
}

func groupLabel(match domain.Match, key string) domain.LocalizedText {
	if len(match.Round) > 0 {
		return match.Round
	}
	return domain.LocalizedText{"en": key}
}

func normalizeSlug(value string) string {
	return strings.TrimSpace(strings.ToLower(value))
}

func trimLocalizedText(value domain.LocalizedText) domain.LocalizedText {
	if len(value) == 0 {
		return domain.LocalizedText{}
	}
	trimmed := make(domain.LocalizedText, len(value))
	for key, text := range value {
		key = strings.TrimSpace(key)
		text = strings.TrimSpace(text)
		if key == "" || text == "" {
			continue
		}
		trimmed[key] = text
	}
	return trimmed
}

func normalizeLocaleCode(value string) string {
	return strings.TrimSpace(strings.ToLower(value))
}

func validateLocalizedText(value domain.LocalizedText, field string) error {
	if len(value) == 0 {
		return invalidArgument(field + " is required")
	}
	if strings.TrimSpace(value["en"]) == "" {
		return invalidArgument(field + " must include en")
	}
	return nil
}

func invalidArgument(message string) error {
	return fmt.Errorf("%w: %s", ErrInvalidArgument, message)
}

func IsInvalidArgument(err error) bool {
	return errors.Is(err, ErrInvalidArgument)
}

func IsConflict(err error) bool {
	return errors.Is(err, ErrConflict)
}
