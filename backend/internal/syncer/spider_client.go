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

// ProviderSpider is the leagues.provider value that routes a league's sync to
// the local Transfermarkt crawler instead of TheSportsDB.
const ProviderSpider = "spider"

// spiderTeamIDOffset namespaces Transfermarkt entity ids away from TheSportsDB
// ids. Both providers key teams by small integers in the shared `teams` table;
// adding this offset to every spider-origin id guarantees the two id spaces
// never collide (and it is reversible with a modulo).
const spiderTeamIDOffset int64 = 100_000_000_000

// spiderSourceTimeZone is the timezone Transfermarkt.com renders kickoff times
// in for an anonymous visitor (its German site default). The crawler stores the
// displayed wall-clock time as a naive datetime, so we reinterpret it in this
// zone before converting to UTC. Verify against a known fixture when onboarding
// a new competition and adjust if the source ever localizes differently.
const spiderSourceTimeZone = "Europe/Berlin"

// SpiderFetcher pulls a league snapshot from the local sports-spider crawler
// (Transfermarkt). It reads already-crawled fixtures from the spider's data API
// and best-effort triggers a fresh crawl so subsequent syncs converge.
type SpiderFetcher struct {
	baseURL    string
	httpClient *http.Client
	logger     *logrus.Logger
	location   *time.Location
}

type spiderFixture struct {
	MatchID       *int64  `json:"match_id"`
	CompetitionID string  `json:"competition_id"`
	SeasonID      int     `json:"season_id"`
	Matchday      *string `json:"matchday"`
	Kickoff       *string `json:"kickoff"`
	HomeTeamID    *int64  `json:"home_team_id"`
	AwayTeamID    *int64  `json:"away_team_id"`
	HomeName      *string `json:"home_name"`
	AwayName      *string `json:"away_name"`
	HomeScore     *int    `json:"home_score"`
	AwayScore     *int    `json:"away_score"`
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
		baseURL:    trimmed,
		httpClient: &http.Client{Timeout: timeout},
		logger:     logger,
		location:   location,
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

	// Best-effort: ask the spider to (re)crawl this competition/season so the
	// next read is fresh. Failures here must not fail the sync — we still serve
	// whatever the crawler already has.
	c.triggerCrawl(ctx, competition, saisonID)

	fixtures, err := c.fetchFixtures(ctx, competition, saisonID)
	if err != nil {
		return domain.LeagueSnapshot{}, err
	}

	teamMap := map[int64]domain.TeamSyncRecord{}
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

		status := spiderMatchStatus(fx, startsAt)
		matches = append(matches, domain.MatchSyncRecord{
			ExternalID: spiderExternalID(fx, competition, startsAt),
			Teams:      []int64{homeID, awayID},
			TeamNames: []domain.LocalizedText{
				englishText(homeName),
				englishText(awayName),
			},
			Round:    spiderRound(fx.Matchday),
			VenueID:  nil,
			StartsAt: startsAt,
			Status:   status,
			Result:   spiderResult(status, fx.HomeScore, fx.AwayScore),
		})
	}

	teams := make([]domain.TeamSyncRecord, 0, len(teamMap))
	for _, team := range teamMap {
		teams = append(teams, team)
	}

	dataSourceNote := englishText(fmt.Sprintf("Synced from Transfermarkt competition %s (saison_id %d)", competition, saisonID))
	return domain.LeagueSnapshot{
		Target:         target,
		DataSourceNote: dataSourceNote,
		Teams:          teams,
		Venues:         nil,
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

func (c *SpiderFetcher) triggerCrawl(ctx context.Context, competition string, season int) {
	body, err := json.Marshal(map[string]any{
		"kind":      "competition_fixtures",
		"target_id": competition,
		"seasons":   []int{season},
	})
	if err != nil {
		c.logger.WithError(err).Warn("spider: marshal crawl request")
		return
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/api/crawl", bytes.NewReader(body))
	if err != nil {
		c.logger.WithError(err).Warn("spider: build crawl request")
		return
	}
	request.Header.Set("Content-Type", "application/json")
	response, err := c.httpClient.Do(request)
	if err != nil {
		c.logger.WithError(err).WithField("competition", competition).Warn("spider: trigger crawl (ignored)")
		return
	}
	defer response.Body.Close()
	if response.StatusCode >= http.StatusBadRequest {
		c.logger.WithFields(logrus.Fields{"competition": competition, "status": response.StatusCode}).Warn("spider: trigger crawl returned error (ignored)")
	}
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

// RoutingFetcher dispatches a snapshot fetch to the provider a league is
// configured to use, falling back to a default fetcher (TheSportsDB).
type RoutingFetcher struct {
	defaultFetcher SnapshotFetcher
	byProvider     map[string]SnapshotFetcher
}

func NewRoutingFetcher(defaultFetcher SnapshotFetcher, byProvider map[string]SnapshotFetcher) (*RoutingFetcher, error) {
	if defaultFetcher == nil {
		return nil, fmt.Errorf("default fetcher is required")
	}
	routed := map[string]SnapshotFetcher{}
	for provider, fetcher := range byProvider {
		if fetcher == nil {
			continue
		}
		routed[provider] = fetcher
	}
	return &RoutingFetcher{defaultFetcher: defaultFetcher, byProvider: routed}, nil
}

func (r *RoutingFetcher) FetchLeagueSnapshot(ctx context.Context, target domain.LeagueSyncTarget) (domain.LeagueSnapshot, error) {
	if fetcher, ok := r.byProvider[strings.TrimSpace(target.Provider)]; ok {
		return fetcher.FetchLeagueSnapshot(ctx, target)
	}
	return r.defaultFetcher.FetchLeagueSnapshot(ctx, target)
}
