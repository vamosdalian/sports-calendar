# sports-calendar

Sports Calendar is the codebase behind the `sports-calendar.com` product.

It is used to publish sports season pages, provide ICS subscription feeds, and maintain competition data through an internal admin system.

The active application structure is:

- `web/`: public website
- `backend/`: API and ICS service
- `admin/`: internal management console

The previous root-level static site and Python-based generation flow are no longer part of the active architecture.

## Application

This project powers the Sports Calendar product.

- Public website: `https://sports-calendar.com`
- Public API domain: `https://api.sports-calendar.com`

The product is intended to let users:

- browse sports, leagues, and seasons
- view season schedules in a calendar-oriented layout
- subscribe to season match feeds through ICS
- access localized season pages

The repository contains the full application stack required to operate the service:

- `web/`: the public website used by end users
- `backend/`: the API and ICS service used by the website and integrations
- `admin/`: the internal management console used to maintain data

## Repository Layout

```text
sports-calendar/
├── admin/                      # Internal admin application
├── backend/                    # API, persistence, sync, and ICS generation
├── docs/                       # API, local testing, deployment and release docs
├── web/                        # Public website
├── LICENSE
├── README.md
└── skills-lock.json
```

## Applications

### `web/`

The public website for `sports-calendar.com`. It serves localized league and season pages such as:

- `/zh/football/csl/2026/index.html`
- `/en/football/csl/2026/index.html`

It is responsible for:

- homepage and league discovery
- localized season pages
- public-facing navigation and SEO pages
- linking users to ICS subscriptions

### `backend/`

The service behind `api.sports-calendar.com`.

It is responsible for:

- public API responses
- admin APIs
- authentication
- database access
- season ICS generation
- scheduled data synchronization hooks

### `admin/`

The internal data management application.

It is responsible for:

- managing sports, leagues, seasons, teams, and matches
- maintaining localized content
- operating the structured data used by the public website and ICS feeds

## Requirements

Recommended local setup:

- Node.js `>= 20.9.0`
- npm `>= 10`
- Go `1.25.x`
- Docker
- PostgreSQL 16

## Quick Start

Start PostgreSQL:

```bash
docker run --name sports-calendar-postgres \
  -e POSTGRES_DB=sports_calendar \
  -e POSTGRES_USER=sports_calendar \
  -e POSTGRES_PASSWORD=sports_calendar \
  -p 5432:5432 \
  -d postgres:16
```

Start the backend:

```bash
cd backend
cp ./config/config.example.yaml ./config/config.local.yaml
go run ./cmd/api -config ./config/config.local.yaml
```

Default address: `http://localhost:8080`

Start the public web app:

```bash
cd web
npm install
npm run dev
```

Default address: `http://localhost:3000`

Start the admin app:

```bash
cd admin
npm install
npm run dev
```

Default address: `http://localhost:5174`

If the backend is not running on `http://localhost:8080`, set a custom API base URL:

```bash
cd admin
VITE_API_BASE_URL=http://localhost:8081 npm run dev
```

## Documentation

- Local development and smoke testing: [`docs/local-testing.md`](docs/local-testing.md)
- API documentation: [`docs/api.md`](docs/api.md)
- Public web deployment: [`docs/cloudflare-workers-web-deploy.md`](docs/cloudflare-workers-web-deploy.md)
- Backend deployment: [`docs/cloudflare-pages-backend-deploy.md`](docs/cloudflare-pages-backend-deploy.md)
- Online deployment notes: [`docs/online-deploy.md`](docs/online-deploy.md)
- Zero-downtime release notes: [`docs/zero-downtime-release.md`](docs/zero-downtime-release.md)

## Current State

This repository is in the refactored architecture phase. The active implementation lives in `web/`, `backend/`, and `admin/`.

If you are updating project documentation or onboarding materials, treat those three directories as the source of truth rather than the legacy root-level static site structure.
