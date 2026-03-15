# API Documentation

This document describes the frontend/backend APIs used by the current homepage and season pages.

## Base URL

- Local default: `http://localhost:8080`
- Frontend env: `SPORTS_CALENDAR_API_BASE_URL`

## 1. GET /api/leagues?lang=en

Returns all available competitions grouped by sport. This endpoint powers the homepage and the competition list in season pages.

### Request

- Method: `GET`
- Query params:
  - `lang` (optional, string): localized language, default `en`

### Response 200

```json
{
  "items": [
    {
      "sportSlug": "football",
      "sportName": "Football",
      "leagues": [
        {
          "leagueSlug": "csl",
          "leagueName": "Chinese Super League",
          "defaultSeason": {
            "slug": "2026",
            "label": "2026"
          }
        }
      ]
    }
  ],
  "updatedAt": "2026-03-10T00:00:00Z"
}
```

### Notes

- Used by homepage and left-side competition navigation.

## 2. GET /api/:sport/:league/seasons?lang=en

Returns all seasons for a specific competition.

### Request

- Method: `GET`
- Path params:
  - `sport` (string)
  - `league` (string)
- Query params:
  - `lang` (optional, string): localized language, default `en`.

### Response 200

```json
{
  "sportSlug": "football",
  "sportName": "Football",
  "leagueSlug": "csl",
  "leagueName": "Chinese Super League",
  "seasons": [
    {
      "slug": "2026",
      "label": "2026"
    },
    {
      "slug": "2025",
      "label": "2025"
    }
  ],
  "updatedAt": "2026-03-10T00:00:00Z"
}
```

### Error responses

- `404` when the sport/league pair does not exist.
- `429` when rate-limited.
- `500` when repository/service fails.

## 3. GET /api/:sport/:league/:season?lang=en

Returns season detail for a specific league + season.

### Request

- Method: `GET`
- Path params:
  - `sport` (string)
  - `league` (string)
  - `season` (string)
- Query params:
  - `lang` (optional, string), default `en`

### Notes

- Used by season pages.
- Returns `404` when not found.
- Match data is grouped by round / stage name in `groups`.

### Response 200

```json
{
  "sportSlug": "football",
  "sportName": "Football",
  "leagueSlug": "csl",
  "leagueName": "Chinese Super League",
  "seasonSlug": "2026",
  "seasonLabel": "2026",
  "defaultMatchDurationMinutes": 120,
  "calendarDescription": "Season calendar",
  "dataSourceNote": "Synced from provider",
  "notes": "Local notes",
  "groups": [
    {
      "key": "Round 1",
      "label": "Round 1",
      "matches": [
        {
          "id": "event-1",
          "round": "Round 1",
          "title": "Team A vs Team B",
          "startsAt": "2026-03-14T11:35:00Z",
          "status": "scheduled",
          "venue": "Workers Stadium",
          "city": "Beijing"
        }
      ]
    }
  ],
  "updatedAt": "2026-03-10T00:00:00Z"
}
```

## 4. GET /ics/:sport/:league/:season/matches.ics

Returns ICS file for season matches.

## 5. GET /healthz

Simple health check endpoint.
