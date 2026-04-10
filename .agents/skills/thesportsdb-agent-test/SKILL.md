---
name: thesportsdb-agent-test
description: 'Use for TheSportsDB, thesportsdb API, sports data docs, 联赛/球队/赛程/球员 查询, API testing, endpoint lookup, OpenAPI review, premium key validation, and agent validation against https://www.thesportsdb.com/documentation. Covers free v1 key 123, premium v2 header auth, repo-specific v2 integration, and smoke testing.'
argument-hint: 'Describe the entity or test goal, for example: lookup league 4328, validate premium v2 key, test repo season sync endpoints, summarize team search docs'
user-invocable: true
---

# TheSportsDB Agent Test

Use this skill when the user wants to inspect TheSportsDB documentation, verify an endpoint, understand auth rules, or run a small live test against TheSportsDB for this repository.

## What This Skill Does

- Chooses the correct TheSportsDB API version for the task.
- Uses the official documentation as the primary source of truth.
- Reuses the repository's local TheSportsDB OpenAPI asset when schema details are needed.
- Reuses this repository's configured premium key when the task is repo-specific live testing.
- Produces reproducible API checks with exact URLs or request examples.
- Keeps test traffic small enough to stay under free-tier limits.

## When to Use

Use this skill when the request includes any of these themes:

- TheSportsDB or thesportsdb
- sports API, sports data API, sportsdb docs
- 联赛, 球队, 球员, 赛程, 比赛, season, fixture, event
- endpoint lookup, OpenAPI, Swagger, API schema, response fields
- agent testing, API smoke test, remote data verification

## Sources

Start with these sources in order:

1. Official documentation: https://www.thesportsdb.com/documentation
2. Skill reference: [TheSportsDB quick reference](./references/thesportsdb-quick-reference.md)
3. Repository OpenAPI snapshot: `../../../docs/thesportsdb.openapi.json`
4. Repository backend client: `../../../backend/internal/syncer/thesportsdb_client.go`
5. Skill smoke test script: [v2 smoke test](./scripts/v2-smoke-test.sh)

Treat the official documentation as authoritative for auth, limits, and endpoint naming. Use the repo OpenAPI file to inspect example payload fields or confirm the shape already used in this codebase.

## API Selection Rules

### Use v1 when

- The user wants a public or free test.
- No premium API key is available.
- A simple browser or curl-friendly example is enough.

Authentication pattern:

```text
https://www.thesportsdb.com/api/v1/json/123/<endpoint>
```

The free test key documented by TheSportsDB is `123`.

### Use v2 when

- The user explicitly asks for v2.
- The user provides or already configured a premium API key.
- The task benefits from cleaner resource paths or standard HTTP behavior.
- The request is about this repository's actual runtime behavior.

Authentication pattern:

```text
GET https://www.thesportsdb.com/api/v2/json/<path>
X-API-KEY: <premium key>
```

Never invent or hardcode a premium key.

### Repository default behavior

For this repository, prefer v2 for live integration checks because the backend client in `backend/internal/syncer/thesportsdb_client.go` sends `X-API-KEY` and calls v2 endpoints such as:

- `/api/v2/json/all/sports`
- `/api/v2/json/all/leagues`
- `/api/v2/json/lookup/league/{id}`
- `/api/v2/json/list/seasons/{id}`
- `/api/v2/json/schedule/league/{id}/{season}`

If `backend/config/config.local.yaml` contains `theSportsDB.apiKey`, treat that as the preferred credential source for local repo testing. Do not repeat the key in user-facing output unless the user explicitly asks.

## Procedure

1. Identify the target object.
   Map the request to one of: sport, league, team, player, venue, event, season, standings, TV, highlights.

2. Decide whether the task is documentation-only or needs a live check.
   If the user wants behavior, freshness, or actual payload confirmation, do a live check. Otherwise stay on docs and local OpenAPI.

3. Choose the API version.
   Use v1 with key `123` for public smoke tests. Use v2 only when premium access is available or specifically requested.

4. Prefer the smallest endpoint that answers the question.
   Search endpoints are for finding IDs. Lookup endpoints are for details by ID. Schedule endpoints are for upcoming or past events. Avoid broad list endpoints unless the user asked for a catalog.

5. If IDs are unknown, search first, then lookup.
   Example flow: `searchteams` or `search_all_leagues` to discover IDs, then `lookupteam` or `lookupleague` for details.

6. When schema details matter, inspect the repo's local OpenAPI file.
   Use it to confirm field names and example payload structure already relevant to this repository.

7. For repo-specific live checks, inspect the local config before making assumptions.
   Read `backend/config/config.local.yaml` for `baseURL`, `apiKey`, and timeout. If a premium key exists there, use v2-first testing.

8. Keep live tests minimal.
   Free tier is documented at 30 requests per minute. Prefer one or two targeted requests, not loops or broad crawling.

9. Report the result with traceability.
   Always state which source was used: official docs, local OpenAPI, or live endpoint response.

## Repo Testing Flow

When the user asks to validate the configured API key or test the repo integration, use this order:

1. Read `backend/config/config.local.yaml` and confirm `theSportsDB.baseURL` and `theSportsDB.apiKey` exist.
2. Run the skill script [v2 smoke test](./scripts/v2-smoke-test.sh) with the configured key.
3. Validate these endpoints in order, stopping on the first failure:
   - `all/sports`
   - `lookup/league/4328`
   - `list/teams/4328`
   - `list/seasons/4328`
   - `schedule/league/4328/<latest season selected from previous step, not just the first item>`
4. Summarize the HTTP status and a few key fields only.
5. If the remote API succeeds but the repo still fails, inspect `backend/internal/syncer/thesportsdb_client.go` and the calling path in the backend.

## Branching Guide

### If the user asks for docs or usage guidance

- Fetch or summarize the official documentation.
- Include the exact endpoint pattern, auth mode, and key parameters.
- Provide one concrete example request.

### If the user asks for a live API test

- Use the repository premium key for repo-local testing if one is configured.
- Otherwise use v1 key `123` unless a premium key is available.
- If the repo config is missing `theSportsDB.apiKey`, fall back to documentation-only guidance or explicit v1 public tests instead of inventing a v2 request.
- Run a single narrow request first.
- Summarize the important fields in the response instead of dumping raw JSON unless the user asked for it.

### If the user asks to validate a premium key

- Prefer v2.
- Do not print the raw key in the answer by default.
- Use `all/sports` as the first auth check because it is cheap and deterministic.
- Then test one league lookup and one season or schedule endpoint.
- If the API returns non-200, report the status and endpoint category that failed.

### If the user asks for response shape or field mapping

- Read `../../../docs/thesportsdb.openapi.json`.
- Confirm field names from the schema or example payload.
- Cross-check with official docs if the endpoint behavior is unclear.

### If the user asks about this repo's integration

- Search the backend and admin code for TheSportsDB usage.
- Focus on the existing flows for sports, leagues, seasons, and sync.
- Explain how the external endpoint maps into local models or admin APIs.

## Quality Checks

Before finishing, verify all of the following:

- The chosen API version matches available credentials.
- The endpoint category matches the task: search, lookup, list, schedule, filter, or livescore.
- IDs were discovered before using ID-based lookups.
- The answer says whether it came from docs, local OpenAPI, or a live request.
- The request volume stays comfortably below rate limits.
- The answer distinguishes between generic TheSportsDB behavior and this repository's v2 integration behavior.

## Output Expectations

Prefer concise, reproducible outputs:

- Exact URL or curl example
- Short explanation of why this endpoint was chosen
- Key response fields or schema notes
- Any caveat such as free-tier limits, home-only event visibility, or premium-only v2 access
- For repo tests, whether the configured local key worked against v2 endpoints

## Good Starting Requests

- Summarize how to authenticate against TheSportsDB free API.
- Test a live TheSportsDB v1 league lookup for league `4328`.
- Validate the premium key from `backend/config/config.local.yaml` against v2.
- Smoke test the repo's v2 league and season flow for league `4328`.
- Find the right endpoint for next events in a league.
- Explain which fields the local OpenAPI snapshot exposes for league lookup.
- Compare whether this repo should use search or lookup for a league bootstrap flow.

## References

- [TheSportsDB quick reference](./references/thesportsdb-quick-reference.md)
- [v2 smoke test](./scripts/v2-smoke-test.sh)
