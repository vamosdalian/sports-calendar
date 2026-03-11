# API Documentation

This document describes the frontend/backend APIs used by the current homepage and season pages.

## Base URL

- Local default: `http://localhost:8080`
- Frontend env: `SPORTS_CALENDAR_API_BASE_URL`

## 1. GET /api/years

Returns all available years from catalog seasons (grouped and deduplicated from mock data).

### Request

- Method: `GET`
- Query params: none

### Response 200

```json
{
  "years": [2026, 2025, 2024],
  "updatedAt": "2026-03-10T00:00:00Z"
}
```

### Notes

- Sorted in descending order.
- Used by homepage year selector and season-page year navigation.

## 2. GET /api/leagues?year=2026&lang=en

Returns all competitions for the selected year.

### Request

- Method: `GET`
- Query params:
  - `year` (optional, number): target year. Defaults to current calendar year on server.
  - `lang` (optional, string): localized language, default `en`.

### Response 200

```json
{
  "year": 2026,
  "items": [
    {
      "sportSlug": "football",
      "sportName": "Football",
      "leagues": [
        {
          "leagueSlug": "csl",
          "leagueName": "Chinese Super League",
          "countryName": "China",
          "seasons": [
            {
              "slug": "2026",
              "label": "2026"
            }
          ]
        }
      ]
    }
  ],
  "updatedAt": "2026-03-10T00:00:00Z"
}
```

### Error responses

- `400` for invalid year:

```json
{
  "error": {
    "code": "invalid_year",
    "message": "year must be numeric"
  }
}
```

- `429` when rate-limited.
- `500` when repository/service fails.

## 3. GET /api/sports/:league/:season?lang=en

Returns season detail for a specific league + season.

### Request

- Method: `GET`
- Path params:
  - `league` (string)
  - `season` (string)
- Query params:
  - `lang` (optional, string), default `en`

### Notes

- Used by season pages.
- Returns `404` when not found.

## 4. GET /ics/:sport/:league/:season/matches.ics

Returns ICS file for season matches.

## 5. GET /healthz

Simple health check endpoint.
