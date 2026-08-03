package repository

import (
	"context"
	"os"
	"sort"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/sirupsen/logrus"

	"github.com/vamosdalian/sports-calendar/backend/internal/domain"
	"github.com/vamosdalian/sports-calendar/backend/internal/migrations"
)

// Clubs play in a domestic league and a continental one at the same time, so
// syncing one competition must not take a team away from the other. That is a
// property of the actual SQL (upsert, join table, prune), so it is exercised
// against a real database and skipped when none is configured.
//
//	docker run --rm -e POSTGRES_DB=sctest -e POSTGRES_USER=sctest \
//	  -e POSTGRES_PASSWORD=sctest -p 55432:5432 -d postgres:16
//	TEST_DATABASE_URL=postgres://sctest:sctest@localhost:55432/sctest?sslmode=disable \
//	  go test ./internal/repository/ -run SharedTeam
func newSnapshotTestPool(t *testing.T) (*PostgresRepository, *pgxpool.Pool) {
	t.Helper()

	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("TEST_DATABASE_URL not set; skipping shared-team database test")
	}

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatalf("connect test database: %v", err)
	}
	t.Cleanup(pool.Close)

	logger := logrus.New()
	logger.SetLevel(logrus.PanicLevel)
	if err := migrations.Run(ctx, pool, logger); err != nil {
		t.Fatalf("run migrations: %v", err)
	}

	if _, err := pool.Exec(ctx, `TRUNCATE matches, team_leagues, teams, seasons, leagues, sports RESTART IDENTITY CASCADE`); err != nil {
		t.Fatalf("reset tables: %v", err)
	}

	repo, err := NewPostgresRepository(pool)
	if err != nil {
		t.Fatalf("create repository: %v", err)
	}
	return repo, pool
}

// seedSeason adds another season to an existing league.
func seedSeason(t *testing.T, pool *pgxpool.Pool, leagueID int64, slug string, startYear int) int64 {
	t.Helper()
	var seasonID int64
	if err := pool.QueryRow(context.Background(), `
		INSERT INTO seasons (league_id, slug, label, start_year, end_year, show)
		VALUES ($1, $2, $2, $3, $4, TRUE)
		RETURNING id
	`, leagueID, slug, startYear, startYear+1).Scan(&seasonID); err != nil {
		t.Fatalf("seed season %s: %v", slug, err)
	}
	return seasonID
}

// seedLeague creates one league with one season and returns their ids.
func seedLeague(t *testing.T, pool *pgxpool.Pool, leagueID int64, slug string) int64 {
	t.Helper()
	ctx := context.Background()

	if _, err := pool.Exec(ctx, `
		INSERT INTO sports (id, slug, name) VALUES (1, 'soccer', '{"en":"Soccer"}'::jsonb)
		ON CONFLICT (id) DO NOTHING
	`); err != nil {
		t.Fatalf("seed sport: %v", err)
	}
	// show = TRUE so the public read path (GetLeagueSeason) returns it.
	if _, err := pool.Exec(ctx, `
		INSERT INTO leagues (id, sport_id, slug, name, show) VALUES ($1, 1, $2, '{"en":"L"}'::jsonb, TRUE)
	`, leagueID, slug); err != nil {
		t.Fatalf("seed league %s: %v", slug, err)
	}
	var seasonID int64
	if err := pool.QueryRow(ctx, `
		INSERT INTO seasons (league_id, slug, label, start_year, end_year, show)
		VALUES ($1, '2025-2026', '2025-2026', 2025, 2026, TRUE)
		RETURNING id
	`, leagueID).Scan(&seasonID); err != nil {
		t.Fatalf("seed season for %s: %v", slug, err)
	}
	return seasonID
}

func snapshotFor(leagueID, seasonID int64, teams []domain.TeamSyncRecord, matches []domain.MatchSyncRecord) domain.LeagueSnapshot {
	return domain.LeagueSnapshot{
		Target: domain.LeagueSyncTarget{
			LeagueID: leagueID,
			SeasonID: seasonID,
		},
		Teams:   teams,
		Matches: matches,
	}
}

func teamRecord(id int64, slug, name string) domain.TeamSyncRecord {
	return domain.TeamSyncRecord{
		ID:        id,
		Slug:      slug,
		Names:     domain.LocalizedText{"en": name},
		ShortName: domain.LocalizedText{},
	}
}

func matchRecord(externalID string, home, away int64, at time.Time) domain.MatchSyncRecord {
	return domain.MatchSyncRecord{
		ExternalID: externalID,
		Teams:      []int64{home, away},
		TeamNames:  []domain.LocalizedText{{"en": "H"}, {"en": "A"}},
		StartsAt:   at,
		Status:     "scheduled",
		Result:     []string{},
	}
}

// leagueTeamSlugs reads the teams the way the season page does -- through
// GetLeagueSeason -- so the test fails on the symptom users would see (a match
// rendering without its teams) rather than on the join table's contents.
func leagueTeamSlugs(t *testing.T, repo *PostgresRepository, leagueSlug string) []string {
	t.Helper()
	detail, err := repo.GetLeagueSeason(context.Background(), "soccer", leagueSlug, "2025-2026")
	if err != nil {
		t.Fatalf("read season for %s: %v", leagueSlug, err)
	}
	seen := map[string]bool{}
	var slugs []string
	for _, match := range detail.Matches {
		for _, team := range []*domain.Team{match.HomeTeam, match.AwayTeam} {
			if team == nil {
				t.Fatalf("%s: match %s lost a team -- it would render without a title",
					leagueSlug, match.ID)
			}
			if !seen[team.Slug] {
				seen[team.Slug] = true
				slugs = append(slugs, team.Slug)
			}
		}
	}
	sort.Strings(slugs)
	return slugs
}

func TestSharedTeamStaysInBothLeagues(t *testing.T) {
	repo, pool := newSnapshotTestPool(t)
	ctx := context.Background()
	kickoff := time.Date(2026, 2, 17, 20, 0, 0, 0, time.UTC)

	domesticSeason := seedLeague(t, pool, 100, "english-premier-league")
	continentalSeason := seedLeague(t, pool, 200, "uefa-champions-league")

	arsenal := teamRecord(11, "arsenal-fc", "Arsenal FC")
	chelsea := teamRecord(631, "chelsea-fc", "Chelsea FC")
	realMadrid := teamRecord(418, "real-madrid", "Real Madrid")

	// The domestic league syncs first and claims both English clubs.
	if err := repo.ReplaceLeagueSnapshot(ctx, snapshotFor(100, domesticSeason,
		[]domain.TeamSyncRecord{arsenal, chelsea},
		[]domain.MatchSyncRecord{matchRecord("tm:1", 11, 631, kickoff)},
	)); err != nil {
		t.Fatalf("domestic sync: %v", err)
	}

	// Then the continental one, whose roster overlaps.
	if err := repo.ReplaceLeagueSnapshot(ctx, snapshotFor(200, continentalSeason,
		[]domain.TeamSyncRecord{arsenal, realMadrid},
		[]domain.MatchSyncRecord{matchRecord("tm:2", 11, 418, kickoff)},
	)); err != nil {
		t.Fatalf("continental sync: %v", err)
	}

	if got, want := leagueTeamSlugs(t, repo, "english-premier-league"), []string{"arsenal-fc", "chelsea-fc"}; !equalStrings(got, want) {
		t.Fatalf("domestic league lost teams to the continental sync: got %v, want %v", got, want)
	}
	if got, want := leagueTeamSlugs(t, repo, "uefa-champions-league"), []string{"arsenal-fc", "real-madrid"}; !equalStrings(got, want) {
		t.Fatalf("continental roster wrong: got %v, want %v", got, want)
	}

	// Re-syncing the domestic league must not evict Arsenal from the
	// continental one either -- otherwise the two just take turns.
	if err := repo.ReplaceLeagueSnapshot(ctx, snapshotFor(100, domesticSeason,
		[]domain.TeamSyncRecord{arsenal, chelsea},
		[]domain.MatchSyncRecord{matchRecord("tm:1", 11, 631, kickoff)},
	)); err != nil {
		t.Fatalf("domestic re-sync: %v", err)
	}
	if got, want := leagueTeamSlugs(t, repo, "uefa-champions-league"), []string{"arsenal-fc", "real-madrid"}; !equalStrings(got, want) {
		t.Fatalf("continental league lost teams to the domestic re-sync: got %v, want %v", got, want)
	}
}

func TestDepartedTeamLosesOnlyThatLeague(t *testing.T) {
	repo, pool := newSnapshotTestPool(t)
	ctx := context.Background()
	kickoff := time.Date(2026, 2, 17, 20, 0, 0, 0, time.UTC)

	domesticSeason := seedLeague(t, pool, 100, "english-premier-league")
	continentalSeason := seedLeague(t, pool, 200, "uefa-champions-league")

	arsenal := teamRecord(11, "arsenal-fc", "Arsenal FC")
	chelsea := teamRecord(631, "chelsea-fc", "Chelsea FC")
	realMadrid := teamRecord(418, "real-madrid", "Real Madrid")

	if err := repo.ReplaceLeagueSnapshot(ctx, snapshotFor(100, domesticSeason,
		[]domain.TeamSyncRecord{arsenal, chelsea},
		[]domain.MatchSyncRecord{matchRecord("tm:1", 11, 631, kickoff)},
	)); err != nil {
		t.Fatalf("domestic sync: %v", err)
	}
	if err := repo.ReplaceLeagueSnapshot(ctx, snapshotFor(200, continentalSeason,
		[]domain.TeamSyncRecord{arsenal, realMadrid},
		[]domain.MatchSyncRecord{matchRecord("tm:2", 11, 418, kickoff)},
	)); err != nil {
		t.Fatalf("continental sync: %v", err)
	}

	// Next season Arsenal does not qualify: it leaves the continental roster
	// but must stay in its domestic league.
	chelseaEurope := chelsea
	if err := repo.ReplaceLeagueSnapshot(ctx, snapshotFor(200, continentalSeason,
		[]domain.TeamSyncRecord{chelseaEurope, realMadrid},
		[]domain.MatchSyncRecord{matchRecord("tm:3", 631, 418, kickoff)},
	)); err != nil {
		t.Fatalf("continental re-sync: %v", err)
	}

	if got, want := leagueTeamSlugs(t, repo, "uefa-champions-league"), []string{"chelsea-fc", "real-madrid"}; !equalStrings(got, want) {
		t.Fatalf("continental roster did not drop the departed team: got %v, want %v", got, want)
	}
	if got, want := leagueTeamSlugs(t, repo, "english-premier-league"), []string{"arsenal-fc", "chelsea-fc"}; !equalStrings(got, want) {
		t.Fatalf("domestic league lost a team that only left the continental one: got %v, want %v", got, want)
	}
}

// leagueTeamSlugsForSeason is leagueTeamSlugs for a season other than the
// default one the other tests use.
func leagueTeamSlugsForSeason(t *testing.T, repo *PostgresRepository, leagueSlug, seasonSlug string) []string {
	t.Helper()
	detail, err := repo.GetLeagueSeason(context.Background(), "soccer", leagueSlug, seasonSlug)
	if err != nil {
		t.Fatalf("read season %s/%s: %v", leagueSlug, seasonSlug, err)
	}
	seen := map[string]bool{}
	var slugs []string
	for _, match := range detail.Matches {
		for _, team := range []*domain.Team{match.HomeTeam, match.AwayTeam} {
			if team == nil {
				t.Fatalf("%s %s: match %s lost a team -- it would render without a title",
					leagueSlug, seasonSlug, match.ID)
			}
			if !seen[team.Slug] {
				seen[team.Slug] = true
				slugs = append(slugs, team.Slug)
			}
		}
	}
	sort.Strings(slugs)
	return slugs
}

// A snapshot covers one season, but the roster prune runs against the whole
// league. A club relegated after last season is absent from this season's
// roster while last season's fixtures still reference it, so pruning on the
// current roster alone strips those matches of their team names.
func TestRelegatedTeamKeepsItsOldSeason(t *testing.T) {
	repo, pool := newSnapshotTestPool(t)
	ctx := context.Background()
	kickoff := time.Date(2026, 2, 17, 20, 0, 0, 0, time.UTC)

	lastSeason := seedLeague(t, pool, 100, "english-premier-league")
	thisSeason := seedSeason(t, pool, 100, "2026-2027", 2026)

	arsenal := teamRecord(11, "arsenal-fc", "Arsenal FC")
	westHam := teamRecord(379, "west-ham-united", "West Ham United")
	sunderland := teamRecord(289, "sunderland-afc", "Sunderland AFC")

	// Last season: Arsenal vs West Ham.
	if err := repo.ReplaceLeagueSnapshot(ctx, snapshotFor(100, lastSeason,
		[]domain.TeamSyncRecord{arsenal, westHam},
		[]domain.MatchSyncRecord{matchRecord("tm:1", 11, 379, kickoff)},
	)); err != nil {
		t.Fatalf("last season sync: %v", err)
	}

	// This season West Ham is relegated and Sunderland promoted.
	if err := repo.ReplaceLeagueSnapshot(ctx, snapshotFor(100, thisSeason,
		[]domain.TeamSyncRecord{arsenal, sunderland},
		[]domain.MatchSyncRecord{matchRecord("tm:2", 11, 289, kickoff)},
	)); err != nil {
		t.Fatalf("this season sync: %v", err)
	}

	if got, want := leagueTeamSlugsForSeason(t, repo, "english-premier-league", "2025-2026"),
		[]string{"arsenal-fc", "west-ham-united"}; !equalStrings(got, want) {
		t.Fatalf("last season lost the relegated team: got %v, want %v", got, want)
	}
	if got, want := leagueTeamSlugsForSeason(t, repo, "english-premier-league", "2026-2027"),
		[]string{"arsenal-fc", "sunderland-afc"}; !equalStrings(got, want) {
		t.Fatalf("this season roster wrong: got %v, want %v", got, want)
	}

	// Re-syncing the older season must not evict the promoted club either.
	if err := repo.ReplaceLeagueSnapshot(ctx, snapshotFor(100, lastSeason,
		[]domain.TeamSyncRecord{arsenal, westHam},
		[]domain.MatchSyncRecord{matchRecord("tm:1", 11, 379, kickoff)},
	)); err != nil {
		t.Fatalf("last season re-sync: %v", err)
	}
	if got, want := leagueTeamSlugsForSeason(t, repo, "english-premier-league", "2026-2027"),
		[]string{"arsenal-fc", "sunderland-afc"}; !equalStrings(got, want) {
		t.Fatalf("current season lost a team to the older season's re-sync: got %v, want %v", got, want)
	}
}

func equalStrings(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}
