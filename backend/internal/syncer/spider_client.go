package syncer

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/sirupsen/logrus"

	"github.com/vamosdalian/sports-calendar/backend/internal/domain"
)

// ProviderSpider is the leagues.provider value for a league synced from the
// local Transfermarkt crawler. It is the only provider ListSyncTargets returns.
const ProviderSpider = "spider"

// spiderTeamIDOffset namespaces Transfermarkt entity ids away from manually
// assigned ids in the shared `teams` table. Adding this offset to every
// spider-origin id avoids collisions and is reversible with a modulo.
const spiderTeamIDOffset int64 = 100_000_000_000

// spiderVenueIDOffset does the same for venues, in its own band so a venue id
// can never collide with a team id. Transfermarkt has no standalone stadium
// id -- a ground is addressed through the club that owns it -- so the crawler
// keys a venue by that club id, which shares the numeric space with teams.
const spiderVenueIDOffset int64 = 200_000_000_000

// spiderSourceTimeZone is the timezone Transfermarkt.com renders kickoff times
// in for an anonymous visitor (its German site default). The crawler stores the
// displayed wall-clock time as a naive datetime, so we reinterpret it in this
// zone before converting to UTC. Verify against a known fixture when onboarding
// a new competition and adjust if the source ever localizes differently.
// Shared with the read path, which needs the same zone to recover the published
// date of a fixture whose kickoff time is still pending.
const spiderSourceTimeZone = domain.SourceTimeZone

// How long to wait for a triggered crawl to reach a terminal state, and how
// often to check. A warm crawl takes ~10s; the headroom covers queue wait when
// several leagues sync at once.
const (
	spiderCrawlPollInterval = 3 * time.Second
	spiderCrawlPollTimeout  = 5 * time.Minute
)

// SpiderFetcher pulls a league snapshot from the local sports-spider crawler
// (Transfermarkt). It triggers a crawl, waits for that crawl to finish, and
// only then reads the fixtures — so a sync always reflects the run it asked
// for. If the crawl fails (e.g. Transfermarkt 502s), the sync fails too and the
// existing data is left untouched rather than being overwritten with nothing.
type SpiderFetcher struct {
	baseURL      string
	httpClient   *http.Client
	logger       *logrus.Logger
	location     *time.Location
	pollInterval time.Duration
	pollTimeout  time.Duration
}

type spiderEnqueueResponse struct {
	Enqueued int      `json:"enqueued"`
	TaskIDs  []string `json:"task_ids"`
}

type spiderTask struct {
	ID        string  `json:"id"`
	Status    string  `json:"status"`
	Message   *string `json:"message"`
	LastError *string `json:"last_error"`
}

type spiderFixture struct {
	MatchID       *int64  `json:"match_id"`
	CompetitionID string  `json:"competition_id"`
	SeasonID      int     `json:"season_id"`
	Matchday      *string `json:"matchday"`
	Kickoff       *string `json:"kickoff"`
	// KickoffTimeTBD is set by the crawler when the source published the date
	// but not the time; Kickoff is then local midnight as a placeholder.
	KickoffTimeTBD bool    `json:"kickoff_time_tbd"`
	HomeTeamID     *int64  `json:"home_team_id"`
	AwayTeamID     *int64  `json:"away_team_id"`
	HomeName       *string `json:"home_name"`
	AwayName       *string `json:"away_name"`
	HomeScore      *int    `json:"home_score"`
	AwayScore      *int    `json:"away_score"`
	// Venue is nil until the crawler's venue track has reached this match.
	// That means "not known yet", never "moved" -- see the COALESCE on the
	// match upsert, which keeps a venue we already stored.
	Venue       *spiderVenue `json:"venue"`
	VenueSource *string      `json:"venue_source"`
}

type spiderVenue struct {
	ID      int64   `json:"id"`
	Name    string  `json:"name"`
	City    *string `json:"city"`
	Country *string `json:"country"`
}

func NewSpiderFetcher(baseURL string, timeout time.Duration, logger *logrus.Logger) (*SpiderFetcher, error) {
	trimmed := strings.TrimRight(strings.TrimSpace(baseURL), "/")
	if trimmed == "" {
		return nil, fmt.Errorf("spider baseURL is required")
	}
	if logger == nil {
		return nil, fmt.Errorf("logger is required")
	}
	if timeout <= 0 {
		timeout = 30 * time.Second
	}
	location, err := time.LoadLocation(spiderSourceTimeZone)
	if err != nil {
		return nil, fmt.Errorf("load spider source timezone %q: %w", spiderSourceTimeZone, err)
	}
	return &SpiderFetcher{
		baseURL:      trimmed,
		httpClient:   &http.Client{Timeout: timeout},
		logger:       logger,
		location:     location,
		pollInterval: spiderCrawlPollInterval,
		pollTimeout:  spiderCrawlPollTimeout,
	}, nil
}

func (c *SpiderFetcher) FetchLeagueSnapshot(ctx context.Context, target domain.LeagueSyncTarget) (domain.LeagueSnapshot, error) {
	if target.SeasonStartYear <= 0 {
		return domain.LeagueSnapshot{}, fmt.Errorf("spider league %s season %s has no start year", target.LeagueSlug, target.SeasonSlug)
	}
	competition, saisonID, err := parseSpiderRef(target.ExternalRef, target.SeasonStartYear)
	if err != nil {
		return domain.LeagueSnapshot{}, fmt.Errorf("spider league %s: %w", target.LeagueSlug, err)
	}

	// Ask the spider to (re)crawl this competition/season, then wait for that
	// crawl to finish before reading. Reading straight after triggering would
	// race the crawler's async worker and return the *previous* run's fixtures,
	// which is how a single bad crawl used to propagate into the calendar.
	taskIDs, err := c.triggerCrawl(ctx, competition, saisonID)
	if err != nil {
		return domain.LeagueSnapshot{}, fmt.Errorf("spider league %s: %w", target.LeagueSlug, err)
	}
	if err := c.waitForCrawl(ctx, taskIDs); err != nil {
		return domain.LeagueSnapshot{}, fmt.Errorf("spider league %s: %w", target.LeagueSlug, err)
	}

	fixtures, err := c.fetchFixtures(ctx, competition, saisonID)
	if err != nil {
		return domain.LeagueSnapshot{}, err
	}

	teamMap := map[int64]domain.TeamSyncRecord{}
	venueMap := map[int64]domain.VenueSyncRecord{}
	matches := make([]domain.MatchSyncRecord, 0, len(fixtures))
	for _, fx := range fixtures {
		if fx.HomeTeamID == nil || fx.AwayTeamID == nil || *fx.HomeTeamID <= 0 || *fx.AwayTeamID <= 0 {
			continue
		}
		startsAt, ok := c.parseKickoff(fx.Kickoff)
		if !ok {
			// No scheduled kickoff yet (TBD fixture) — cannot place it on a
			// calendar, skip until the crawler learns the date.
			continue
		}

		homeID := *fx.HomeTeamID + spiderTeamIDOffset
		awayID := *fx.AwayTeamID + spiderTeamIDOffset
		homeName := strvalue(fx.HomeName)
		awayName := strvalue(fx.AwayName)
		registerSpiderTeam(teamMap, homeID, homeName)
		registerSpiderTeam(teamMap, awayID, awayName)

		venueID := registerSpiderVenue(venueMap, fx.Venue)

		status := spiderMatchStatus(fx, startsAt)
		matches = append(matches, domain.MatchSyncRecord{
			ExternalID: spiderExternalID(fx, competition, startsAt),
			Teams:      []int64{homeID, awayID},
			TeamNames: []domain.LocalizedText{
				englishText(homeName),
				englishText(awayName),
			},
			Round:          spiderRound(fx.Matchday),
			VenueID:        venueID,
			StartsAt:       startsAt,
			KickoffTimeTBD: fx.KickoffTimeTBD,
			Status:         status,
			Result:         spiderResult(status, fx.HomeScore, fx.AwayScore),
		})
	}

	teams := make([]domain.TeamSyncRecord, 0, len(teamMap))
	for _, team := range teamMap {
		teams = append(teams, team)
	}

	venues := make([]domain.VenueSyncRecord, 0, len(venueMap))
	for _, venue := range venueMap {
		venues = append(venues, venue)
	}

	dataSourceNote := englishText(fmt.Sprintf("Synced from Transfermarkt competition %s (saison_id %d)", competition, saisonID))
	return domain.LeagueSnapshot{
		Target:         target,
		DataSourceNote: dataSourceNote,
		Teams:          teams,
		Venues:         venues,
		Matches:        matches,
	}, nil
}

// parseSpiderRef splits a league's external_ref into a Transfermarkt
// competition code and the saison_id to crawl. The ref is "CODE" or
// "CODE@OFFSET"; the saison_id is startYear+offset. Transfermarkt's saison_id
// convention differs per competition: European split-year leagues use the
// season's start year as-is (offset 0, e.g. "GB1"), whereas single-calendar-year
// leagues like the Chinese Super League file the year-N season under saison_id
// N-1, needing "CSL@-1".
func parseSpiderRef(externalRef string, startYear int) (string, int, error) {
	trimmed := strings.TrimSpace(externalRef)
	if trimmed == "" {
		return "", 0, fmt.Errorf("has no external_ref (Transfermarkt code)")
	}
	code := trimmed
	offset := 0
	if at := strings.LastIndex(trimmed, "@"); at >= 0 {
		code = strings.TrimSpace(trimmed[:at])
		offsetText := strings.TrimSpace(trimmed[at+1:])
		parsed, err := strconv.Atoi(offsetText)
		if err != nil {
			return "", 0, fmt.Errorf("invalid season offset %q in external_ref %q", offsetText, externalRef)
		}
		offset = parsed
	}
	if code == "" {
		return "", 0, fmt.Errorf("invalid external_ref %q", externalRef)
	}
	return code, startYear + offset, nil
}

// triggerCrawl queues a fixtures crawl and returns the task ids to wait on.
func (c *SpiderFetcher) triggerCrawl(ctx context.Context, competition string, season int) ([]string, error) {
	body, err := json.Marshal(map[string]any{
		"kind":      "competition_fixtures",
		"target_id": competition,
		"seasons":   []int{season},
	})
	if err != nil {
		return nil, fmt.Errorf("marshal crawl request: %w", err)
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/api/crawl", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("build crawl request: %w", err)
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Accept", "application/json")
	response, err := c.httpClient.Do(request)
	if err != nil {
		return nil, fmt.Errorf("trigger crawl: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode >= http.StatusBadRequest {
		return nil, fmt.Errorf("trigger crawl: unexpected status %d", response.StatusCode)
	}

	var payload spiderEnqueueResponse
	if err := json.NewDecoder(response.Body).Decode(&payload); err != nil {
		return nil, fmt.Errorf("decode crawl response: %w", err)
	}
	if len(payload.TaskIDs) == 0 {
		return nil, fmt.Errorf("trigger crawl: spider returned no task ids")
	}
	return payload.TaskIDs, nil
}

// waitForCrawl polls each task until it reaches a terminal state. Any outcome
// other than "done" is an error: the crawl did not produce trustworthy data, so
// the caller must abandon the sync rather than read a half-written season.
func (c *SpiderFetcher) waitForCrawl(ctx context.Context, taskIDs []string) error {
	ctx, cancel := context.WithTimeout(ctx, c.pollTimeout)
	defer cancel()

	for _, id := range taskIDs {
		for {
			task, err := c.fetchTask(ctx, id)
			if err != nil {
				return err
			}
			switch task.Status {
			case "done":
				c.logger.WithFields(logrus.Fields{"task": id, "message": derefString(task.Message)}).Debug("spider: crawl task done")
			case "failed", "cancelled", "skipped":
				return fmt.Errorf("crawl task %s ended as %s: %s", id, task.Status, derefString(task.LastError))
			default: // pending / running
				select {
				case <-ctx.Done():
					return fmt.Errorf("crawl task %s still %s after %s: %w", id, task.Status, c.pollTimeout, ctx.Err())
				case <-time.After(c.pollInterval):
					continue
				}
			}
			break
		}
	}
	return nil
}

func (c *SpiderFetcher) fetchTask(ctx context.Context, taskID string) (spiderTask, error) {
	endpoint := c.baseURL + "/api/crawl/tasks/" + url.PathEscape(taskID)
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return spiderTask{}, fmt.Errorf("build crawl task request: %w", err)
	}
	request.Header.Set("Accept", "application/json")
	response, err := c.httpClient.Do(request)
	if err != nil {
		return spiderTask{}, fmt.Errorf("request crawl task %s: %w", taskID, err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return spiderTask{}, fmt.Errorf("request crawl task %s: unexpected status %d", taskID, response.StatusCode)
	}
	var task spiderTask
	if err := json.NewDecoder(response.Body).Decode(&task); err != nil {
		return spiderTask{}, fmt.Errorf("decode crawl task %s: %w", taskID, err)
	}
	return task, nil
}

func derefString(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func (c *SpiderFetcher) fetchFixtures(ctx context.Context, competition string, season int) ([]spiderFixture, error) {
	query := url.Values{}
	query.Set("competition_id", competition)
	query.Set("season_id", strconv.Itoa(season))
	query.Set("limit", "5000")
	endpoint := c.baseURL + "/api/data/fixtures?" + query.Encode()

	request, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("build spider fixtures request: %w", err)
	}
	request.Header.Set("Accept", "application/json")
	response, err := c.httpClient.Do(request)
	if err != nil {
		return nil, fmt.Errorf("request spider fixtures: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("request spider fixtures: unexpected status %d", response.StatusCode)
	}

	var fixtures []spiderFixture
	if err := json.NewDecoder(response.Body).Decode(&fixtures); err != nil {
		return nil, fmt.Errorf("decode spider fixtures: %w", err)
	}
	return fixtures, nil
}

func (c *SpiderFetcher) parseKickoff(value *string) (time.Time, bool) {
	if value == nil {
		return time.Time{}, false
	}
	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return time.Time{}, false
	}
	for _, layout := range []string{"2006-01-02T15:04:05", "2006-01-02T15:04:05.999999", "2006-01-02 15:04:05"} {
		if parsed, err := time.ParseInLocation(layout, trimmed, c.location); err == nil {
			return parsed.UTC(), true
		}
	}
	// A midnight-only kickoff means the crawler had a date but no time; still
	// worth surfacing at local midnight rather than dropping the fixture.
	if parsed, err := time.ParseInLocation("2006-01-02", trimmed, c.location); err == nil {
		return parsed.UTC(), true
	}
	return time.Time{}, false
}

func registerSpiderTeam(teamMap map[int64]domain.TeamSyncRecord, id int64, name string) {
	if _, exists := teamMap[id]; exists {
		return
	}
	teamMap[id] = domain.TeamSyncRecord{
		ID:        id,
		Slug:      slugify(name, strconv.FormatInt(id, 10)),
		Names:     englishText(name),
		ShortName: emptyLocalizedText(),
	}
}

// registerSpiderVenue records a fixture's ground and returns the id to store
// on the match. Returns nil when the crawler has not established a venue yet,
// which leaves the match's existing venue untouched rather than clearing it.
func registerSpiderVenue(venueMap map[int64]domain.VenueSyncRecord, venue *spiderVenue) *int64 {
	if venue == nil || venue.ID <= 0 || strings.TrimSpace(venue.Name) == "" {
		return nil
	}
	id := venue.ID + spiderVenueIDOffset
	if _, exists := venueMap[id]; !exists {
		venueMap[id] = domain.VenueSyncRecord{
			ID:   id,
			Name: englishText(strings.TrimSpace(venue.Name)),
			City: optionalEnglishText(venue.City),
			// Resolved by the crawler from the competition's country. Absent
			// for a ground only ever seen on a neutral-venue match report,
			// where there is no competition country to inherit.
			Country: optionalEnglishText(venue.Country),
		}
	}
	return &id
}

// optionalEnglishText renders a nullable upstream string as localized text,
// yielding empty text (not a blank "en" entry) when the source had no value --
// the JSONB merge on upsert would otherwise overwrite a human's translation
// with an empty string.
func optionalEnglishText(value *string) domain.LocalizedText {
	if value == nil {
		return emptyLocalizedText()
	}
	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return emptyLocalizedText()
	}
	return englishText(trimmed)
}

func spiderExternalID(fx spiderFixture, competition string, startsAt time.Time) string {
	if fx.MatchID != nil && *fx.MatchID > 0 {
		return fmt.Sprintf("tm:%d", *fx.MatchID)
	}
	// No Transfermarkt match id yet (unplayed fixture). Build a deterministic id
	// from the fixture's identity so it stays stable across syncs.
	matchday := strings.TrimSpace(strvalue(fx.Matchday))
	return fmt.Sprintf("tm:%s:%d:%s:%d-%d:%s",
		competition,
		fx.SeasonID,
		matchday,
		derefInt64(fx.HomeTeamID),
		derefInt64(fx.AwayTeamID),
		startsAt.Format("20060102"),
	)
}

func spiderRound(matchday *string) domain.LocalizedText {
	trimmed := strings.TrimSpace(strvalue(matchday))
	if trimmed == "" {
		return emptyLocalizedText()
	}
	return domain.LocalizedText{"en": trimmed}
}

func spiderMatchStatus(fx spiderFixture, startsAt time.Time) string {
	if fx.HomeScore != nil && fx.AwayScore != nil {
		return "finished"
	}
	return "scheduled"
}

func spiderResult(status string, homeScore, awayScore *int) []string {
	if status != "finished" || homeScore == nil || awayScore == nil {
		return []string{}
	}
	return []string{strconv.Itoa(*homeScore), strconv.Itoa(*awayScore)}
}

func strvalue(value *string) string {
	if value == nil {
		return ""
	}
	return strings.TrimSpace(*value)
}

func derefInt64(value *int64) int64 {
	if value == nil {
		return 0
	}
	return *value
}
