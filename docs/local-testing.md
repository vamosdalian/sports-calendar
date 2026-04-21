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
- Admin frontend: `admin/` (Vite + React + Tailwind)
- Local backend config: copy `backend/config/config.example.yaml` to `backend/config/config.local.yaml`

## 3. Backend Local Testing

### 3.1 Start PostgreSQL 16 locally

Use a fresh local PostgreSQL container:

```bash
docker run --name sports-calendar-postgres \
	-e POSTGRES_DB=sports_calendar \
	-e POSTGRES_USER=sports_calendar \
	-e POSTGRES_PASSWORD=sports_calendar \
	-p 5432:5432 \
	-d postgres:16
```

Useful checks:

```bash
docker logs sports-calendar-postgres
docker exec -it sports-calendar-postgres psql -U sports_calendar -d sports_calendar -c '\dt'
```

后端启动时会自动执行程序内 migration，并使用 `schema_migrations` 记录版本。
如果数据库是旧版本但已经有历史表结构，启动时会先识别现状并回填 baseline，再自动补齐缺失变更。

Expected tables:

- `sports`
- `leagues`
- `seasons`
- `teams`
- `matches`
- `users`

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
cp ./config/config.example.yaml ./config/config.local.yaml
# edit ./config/config.local.yaml for your local DB and secrets
go run ./cmd/api -config ./config/config.local.yaml
```

Default address: `http://localhost:8080`

`backend/config/config.local.yaml` is ignored by Git. Start from `backend/config/config.example.yaml` and then edit your local copy.

The backend now reads PostgreSQL connection settings from `backend/config/config.local.yaml`:

```yaml
database:
	host: localhost
	port: 5432
	dbname: sports_calendar
	user: sports_calendar
	password: sports_calendar
	sslmode: disable

adminAuth:
	secret: local-admin-secret-change-me
	tokenTTLMinutes: 30
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

# Bootstrap the first admin user
curl -s -X POST "http://localhost:8080/api/auth/register" \
	-H 'Content-Type: application/json' \
	-d '{
	  "email": "admin@example.com",
	  "password": "change-me-123"
	}' | jq .

# Login and keep the token for protected admin APIs
TOKEN=$(curl -s -X POST "http://localhost:8080/api/auth/login" \
	-H 'Content-Type: application/json' \
	-d '{
	  "email": "admin@example.com",
	  "password": "change-me-123"
	}' | jq -r '.token')

# Refresh the current token
curl -s -X POST "http://localhost:8080/api/auth/refresh" \
	-H "Authorization: Bearer $TOKEN" | jq .

# List admin sports
curl -s "http://localhost:8080/api/admin/sports" \
	-H "Authorization: Bearer $TOKEN" | jq .

# Create sport
curl -s -X POST "http://localhost:8080/api/admin/sports" \
	-H "Authorization: Bearer $TOKEN" \
	-H 'Content-Type: application/json' \
	-d '{
	  "id": 102,
	  "slug": "basketball",
	  "name": {"en": "Basketball", "zh": "篮球"}
	}' | jq .

# Create league (id must be TheSportsDB league id)
curl -s -X POST "http://localhost:8080/api/admin/leagues" \
	-H "Authorization: Bearer $TOKEN" \
	-H 'Content-Type: application/json' \
	-d '{
	  "id": 4387,
	  "sportSlug": "football",
	  "slug": "afc-champions-league-elite",
	  "name": {"en": "AFC Champions League Elite", "zh": "亚冠精英联赛"},
	  "syncInterval": "@daily"
	}' | jq .

# List leagues for one sport
curl -s "http://localhost:8080/api/admin/football/leagues" \
	-H "Authorization: Bearer $TOKEN" | jq .

# Create season
curl -s -X POST "http://localhost:8080/api/admin/seasons" \
	-H "Authorization: Bearer $TOKEN" \
	-H 'Content-Type: application/json' \
	-d '{
	  "sportSlug": "football",
	  "leagueSlug": "afc-champions-league-elite",
	  "slug": "2026-2027",
	  "label": "2026-2027",
	  "startYear": 2026,
	  "endYear": 2027,
	  "defaultMatchDurationMinutes": 120
	}' | jq .

# Delete season and cascade delete season matches
curl -i -X DELETE "http://localhost:8080/api/admin/football/afc-champions-league-elite/seasons/2026-2027" \
	-H "Authorization: Bearer $TOKEN"
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

## 5. Admin Frontend Local Testing

### 5.1 Install dependencies

```bash
cd admin
npm install
```

### 5.2 Run dev server

```bash
npm run dev
```

Default address: `http://localhost:5174`

If the backend runs on the default local port, the admin frontend can use it directly. If needed, set a custom API base URL before starting dev/build:

```bash
VITE_API_BASE_URL=http://localhost:8080 npm run dev
```

### 5.3 Run production build check

```bash
npm run build
```

Expected result: build succeeds and outputs static files to `admin/dist`.

## 6. URL Policy Verification (Important)

Current standard URL format:

`/[language]/[sports]/[league]/[season]/index.html`

Example checks in browser:

- `http://localhost:3000/zh/football/csl/2026/`
- `http://localhost:3000/en/racing/f1/2026/`

Compatibility behavior:

- `http://localhost:3000/` redirects to `/en`

## 7. Legacy Compatibility Checks

### 6.1 Legacy query parameter

Open:

- `http://localhost:3000/en?league=csl`

Expected: redirect to the default season route for that league from `/api/leagues`.

## 8. Optional: Docker Build Verification

From repo root:

```bash
docker build -f backend/Dockerfile .
```

If you see shell errors like `fork failed: resource temporarily unavailable`, this is usually an environment/process limit issue rather than code compilation failure.

## 9. Quick Regression Checklist

Run this after code changes:

1. `docker exec -it sports-calendar-postgres psql -U sports_calendar -d sports_calendar -c '\dt'`
2. `cd backend && go test ./...`
3. `cd web && npm run build`
4. `cd admin && npm run build`
5. Manually open at least one `en` route and one `zh` route.
6. Verify one ICS endpoint responds correctly and the season page "订阅" button opens a `webcal://` URL.
