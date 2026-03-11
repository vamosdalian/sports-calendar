# Local Testing Guide

This document describes how to test the refactored `sports-calendar` project locally.

## 1. Prerequisites

Install these tools first:

- Node.js `>= 20.9.0`
- npm `>= 10`
- Go `1.25.x`
- Optional: Docker (for image build verification)

Check versions:

```bash
node -v
npm -v
go version
```

## 2. Project Structure Used for Testing

- Frontend: `web/` (Next.js App Router)
- Backend: `backend/` (Gin + go-ical)
- Shared mock data: `shared/mock/catalog.json`
- Local backend config: `backend/config/config.local.yaml`

## 3. Backend Local Testing

### 3.1 Run unit tests

```bash
cd backend
go test ./...
```

Expected result: all tests pass.

### 3.2 Start backend API locally

Use local config (not container config):

```bash
cd backend
go run ./cmd/api -config ./config/config.local.yaml
```

Default address: `http://localhost:8080`

### 3.3 API smoke tests

Open a new terminal:

```bash
# Health
curl -i "http://localhost:8080/healthz"

# Sports list by year
curl -s "http://localhost:8080/api/sports?year=2026" | jq .

# League detail (season default)
curl -s "http://localhost:8080/api/sports/csl" | jq .

# League detail (explicit season)
curl -s "http://localhost:8080/api/sports/csl/2026" | jq .

# ICS feed
curl -i "http://localhost:8080/ics/football/csl/2026/matches.ics"
```

Notes:

- If `jq` is not installed, remove `| jq .`.
- ICS response should include `Content-Type: text/calendar` and cache headers.

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

Expected: redirect to first available season route for that league.

## 7. Optional: Docker Build Verification

From repo root:

```bash
docker build -f backend/Dockerfile .
```

If you see shell errors like `fork failed: resource temporarily unavailable`, this is usually an environment/process limit issue rather than code compilation failure.

## 8. Quick Regression Checklist

Run this after code changes:

1. `cd backend && go test ./...`
2. `cd web && npm run build`
3. Manually open at least one `en` route and one `zh` route.
4. Verify one ICS endpoint responds correctly.
