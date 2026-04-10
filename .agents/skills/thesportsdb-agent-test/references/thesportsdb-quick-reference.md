# TheSportsDB Quick Reference

This reference is intentionally short. Use it after the main skill is loaded when you need the most common endpoint patterns or testing constraints.

## Official Docs

- Documentation: https://www.thesportsdb.com/documentation
- v1 OpenAPI: https://www.thesportsdb.com/api/spec/v1/openapi.yaml
- v2 OpenAPI: https://www.thesportsdb.com/api/spec/v2/openapi.yaml

## Authentication

### v1 free or browser-friendly

Base URL:

```text
https://www.thesportsdb.com/api/v1/json
```

Free test key documented by TheSportsDB:

```text
123
```

Pattern:

```text
https://www.thesportsdb.com/api/v1/json/123/<endpoint>
```

### v2 premium

Base URL:

```text
https://www.thesportsdb.com/api/v2/json
```

Header:

```text
X-API-KEY: <premium key>
```

## Practical Endpoint Shortlist

### Discovery

- Search team: `/searchteams.php?t=<team>`
- Search event: `/searchevents.php?e=<event>`
- Search player: `/searchplayers.php?p=<player>`
- List leagues by country and sport: `/search_all_leagues.php?c=<country>&s=<sport>`

### Lookup by ID

- League: `/lookupleague.php?id=<leagueId>`
- Team: `/lookupteam.php?id=<teamId>`
- Player: `/lookupplayer.php?id=<playerId>`
- League table: `/lookuptable.php?l=<leagueId>&s=<season>`

### Schedule

- Next events for team: `/eventsnext.php?id=<teamId>`
- Previous events for team: `/eventslast.php?id=<teamId>`
- Next events for league: `/eventsnextleague.php?id=<leagueId>`
- Previous events for league: `/eventspastleague.php?id=<leagueId>`
- Events by date: `/eventsday.php?d=<YYYY-MM-DD>`
- Events by season: `/eventsseason.php?id=<leagueId>&s=<season>`

### Catalog

- All sports: `/all_sports.php`
- All countries: `/all_countries.php`
- All leagues: `/all_leagues.php`
- Teams in league: `/search_all_teams.php?l=<league>`
- Seasons for league: `/search_all_seasons.php?id=<leagueId>`

## Free-Tier Constraints

- Documented free rate limit: 30 requests per minute
- Some endpoints have lower free-result limits than premium
- Some team schedule endpoints note that the free key may only show home events

## Repo-Specific Notes

- Local OpenAPI snapshot: `../../../docs/thesportsdb.openapi.json`
- Backend TheSportsDB client: `../../../backend/internal/syncer/thesportsdb_client.go`
- Admin integration routes: `../../../backend/internal/server/admin_catalog.go`
- Local config source: `../../../backend/config/config.local.yaml`

## Repo v2 Endpoint Set

These are the endpoints the repository effectively depends on today:

- `/api/v2/json/all/sports`
- `/api/v2/json/all/leagues`
- `/api/v2/json/lookup/league/<leagueId>`
- `/api/v2/json/list/seasons/<leagueId>`
- `/api/v2/json/schedule/league/<leagueId>/<season>`

All of them use `X-API-KEY` header auth in the backend client.

## Premium Smoke Test Pattern

1. Read `baseURL` and `apiKey` from `backend/config/config.local.yaml`.
2. Test `all/sports` first.
3. Test `lookup/league/4328`.
4. Test `list/teams/4328`.
5. Test `list/seasons/4328`.
6. Pick the newest returned season and test `schedule/league/4328/<season>`.

If you need a script, use [../scripts/v2-smoke-test.sh](../scripts/v2-smoke-test.sh).

## Testing Advice

- Use search endpoints only to discover IDs.
- Switch to lookup or schedule endpoints once the ID is known.
- Prefer one narrow live request before any broader sampling.
- If the answer is about schema, inspect the local OpenAPI snapshot instead of spamming live requests.