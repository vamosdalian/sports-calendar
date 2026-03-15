# Local Testing Guide

This document describes how to test the refactored `sports-calendar` project locally.

## 1. Prerequisites

Install these tools first:

- Node.js `>= 20.9.0`
- npm `>= 10`
- Go `1.25.x`
- Docker

Check versions:

```bash
node -v
npm -v
go version
```

## 2. Project Structure Used for Testing

- Frontend: `web/` (Next.js App Router)
- Backend: `backend/` (Gin + PostgreSQL + go-ical)
- Database init SQL: `database/init/001_postgres_init.sql`
- Local backend config: `backend/config/config.local.yaml`

## 3. Backend Local Testing

### 3.1 Start PostgreSQL 16 locally

Use a fresh local PostgreSQL container with the init SQL mounted into `docker-entrypoint-initdb.d`:

```bash
docker run --name sports-calendar-postgres \
	-e POSTGRES_DB=sports_calendar \
	-e POSTGRES_USER=sports_calendar \
	-e POSTGRES_PASSWORD=sports_calendar \
	-p 5432:5432 \
	-v /Users/lmc10232/project/sports-calendar/database/init:/docker-entrypoint-initdb.d \
	-d postgres:16
```

Useful checks:

```bash
docker logs sports-calendar-postgres
docker exec -it sports-calendar-postgres psql -U sports_calendar -d sports_calendar -c '\dt'
```

Expected tables:

- `sports`
- `leagues`
- `seasons`
- `teams`
- `matches`

The init SQL inserts a minimal `football / csl / 2026` seed dataset so the API can be smoke-tested immediately.

### 3.2 Run unit tests

```bash
cd backend
go test ./...
```

Expected result: all tests pass.

### 3.3 Start backend API locally

Use local config (not container config):

```bash
cd backend
go run ./cmd/api -config ./config/config.local.yaml
```

Default address: `http://localhost:8080`

The backend now reads PostgreSQL connection settings from `backend/config/config.local.yaml`:

```yaml
database:
	host: localhost
	port: 5432
	dbname: sports_calendar
	user: sports_calendar
	password: sports_calendar
	sslmode: disable
```

### 3.4 API smoke tests

Open a new terminal:

```bash
# Health
curl -i "http://localhost:8080/healthz"

# Competition directory
curl -s "http://localhost:8080/api/leagues?lang=en" | jq .

# League seasons
curl -s "http://localhost:8080/api/football/csl/seasons?lang=en" | jq .

# Season detail
curl -s "http://localhost:8080/api/football/csl/2026?lang=en" | jq .

# ICS feed
curl -i "http://localhost:8080/ics/football/csl/2026/matches.ics"
```

Notes:

- If `jq` is not installed, remove `| jq .`.
- ICS response should include `Content-Type: text/calendar` and cache headers.
- `GET /api/football/csl/2026` should return seeded CSL season data from PostgreSQL, grouped under `groups`, not from JSON mock files.

## 4. Frontend Local Testing

### 4.1 Install dependencies

```bash
cd web
npm install
```

### 4.2 Run dev server

```bash
npm run dev
```

Default address: `http://localhost:3000`

### 4.3 Run production build check

```bash
npm run build
```

Expected result: build succeeds, and routes are generated with language prefix.

## 5. URL Policy Verification (Important)

Current standard URL format:

`/[language]/[sports]/[league]/[season]/index.html`

Example checks in browser:

- `http://localhost:3000/zh/football/csl/2026/`
- `http://localhost:3000/en/racing/f1/2026/`

Compatibility behavior:

- `http://localhost:3000/` redirects to `/en`

## 6. Legacy Compatibility Checks

### 6.1 Legacy query parameter

Open:

- `http://localhost:3000/en?league=csl`

Expected: redirect to the default season route for that league from `/api/leagues`.

## 7. Optional: Docker Build Verification

From repo root:

```bash
docker build -f backend/Dockerfile .
```

If you see shell errors like `fork failed: resource temporarily unavailable`, this is usually an environment/process limit issue rather than code compilation failure.

## 8. Quick Regression Checklist

Run this after code changes:

1. `docker exec -it sports-calendar-postgres psql -U sports_calendar -d sports_calendar -c '\dt'`
2. `cd backend && go test ./...`
3. `cd web && npm run build`
4. Manually open at least one `en` route and one `zh` route.
5. Verify one ICS endpoint responds correctly and the season page "订阅" button opens a `webcal://` URL.
