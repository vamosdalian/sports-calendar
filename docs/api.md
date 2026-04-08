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

## 5. POST /api/auth/register

Bootstrap-only admin registration. This endpoint only succeeds when no admin user exists yet.

### Request

- Method: `POST`
- Body:

```json
{
  "email": "admin@example.com",
  "password": "change-me-123"
}
```

### Response 201

```json
{
  "id": 1,
  "email": "admin@example.com",
  "createdAt": "2026-03-16T08:00:00Z",
  "updatedAt": "2026-03-16T08:00:00Z"
}
```

### Error responses

- `400` when email is invalid or password is shorter than 8 characters.
- `409` when the bootstrap admin already exists.

## 6. POST /api/auth/login

Admin login. Returns a signed bearer token whose payload contains `email` and `exp`.

### Request

- Method: `POST`
- Body:

```json
{
  "email": "admin@example.com",
  "password": "change-me-123"
}
```

### Response 200

```json
{
  "token": "<signed-token>",
  "email": "admin@example.com",
  "expiresAt": "2026-03-16T08:30:00Z"
}
```

### Error responses

- `400` when email or password is invalid.
- `401` when credentials are incorrect.

## 7. POST /api/auth/refresh

Refreshes the current admin bearer token. Send the old token in the `Authorization` header.

### Request

- Method: `POST`
- Headers:
  - `Authorization: Bearer <current-token>`

### Response 200

```json
{
  "token": "<new-signed-token>",
  "email": "admin@example.com",
  "expiresAt": "2026-03-16T09:00:00Z"
}
```

### Error responses

- `401` when the token is missing, invalid, or expired.

## 8. GET /api/admin/sports

Lists sports for the admin platform.

### Request

- Method: `GET`
- Headers:
  - `Authorization: Bearer <token>`

### Response 200

```json
{
  "items": [
    {
      "id": 102,
      "slug": "basketball",
      "name": {
        "en": "Basketball",
        "zh": "篮球"
      },
      "createdAt": "2026-03-16T08:00:00Z",
      "updatedAt": "2026-03-16T08:00:00Z"
    }
  ],
  "updatedAt": "2026-03-16T08:00:00Z"
}
```

### Error responses

- `401` when bearer token is missing or invalid.

## 9. POST /api/admin/sports

Protected admin endpoint. Requires `Authorization: Bearer <token>`.

Creates a sport catalog item.

### Request

- Method: `POST`
- Body:

```json
{
  "id": 102,
  "slug": "basketball",
  "name": {
    "en": "Basketball",
    "zh": "篮球"
  }
}
```

### Response 201

```json
{
  "id": 102,
  "slug": "basketball",
  "name": {
    "en": "Basketball",
    "zh": "篮球"
  },
  "createdAt": "2026-03-16T08:00:00Z",
  "updatedAt": "2026-03-16T08:00:00Z"
}
```

### Error responses

- `400` when `id`, `slug`, or `name.en` is missing.
- `409` when sport `id` or `slug` already exists.

## 10. GET /api/admin/:sport/leagues

Lists leagues for one sport in the admin platform.

### Request

- Method: `GET`
- Headers:
  - `Authorization: Bearer <token>`
- Path params:
  - `sport` (string)

### Response 200

```json
{
  "sportSlug": "football",
  "items": [
    {
      "id": 4387,
      "sportSlug": "football",
      "slug": "afc-champions-league-elite",
      "name": {
        "en": "AFC Champions League Elite",
        "zh": "亚冠精英联赛"
      },
      "syncInterval": "@daily",
      "calendarDescription": {
        "en": "Competition calendar"
      },
      "dataSourceNote": {},
      "notes": {
        "en": "Created manually"
      },
      "createdAt": "2026-03-16T08:00:00Z",
      "updatedAt": "2026-03-16T08:00:00Z"
    }
  ],
  "updatedAt": "2026-03-16T08:00:00Z"
}
```

### Error responses

- `400` when `sport` is empty.
- `401` when bearer token is missing or invalid.

## 11. POST /api/admin/leagues

Protected admin endpoint. Requires `Authorization: Bearer <token>`.

Creates a league. `id` must be the TheSportsDB league id.

### Request

- Method: `POST`
- Body:

```json
{
  "id": 4387,
  "sportSlug": "football",
  "slug": "afc-champions-league-elite",
  "name": {
    "en": "AFC Champions League Elite",
    "zh": "亚冠精英联赛"
  },
  "syncInterval": "@daily",
  "calendarDescription": {
    "en": "Competition calendar"
  },
  "notes": {
    "en": "Created manually"
  }
}
```

### Response 201

```json
{
  "id": 4387,
  "sportSlug": "football",
  "slug": "afc-champions-league-elite",
  "name": {
    "en": "AFC Champions League Elite",
    "zh": "亚冠精英联赛"
  },
  "syncInterval": "@daily",
  "calendarDescription": {
    "en": "Competition calendar"
  },
  "dataSourceNote": {},
  "notes": {
    "en": "Created manually"
  },
  "createdAt": "2026-03-16T08:00:00Z",
  "updatedAt": "2026-03-16T08:00:00Z"
}
```

### Error responses

- `400` when `id`, `sportSlug`, `slug`, or `name.en` is missing.
- `404` when `sportSlug` does not exist.
- `409` when league `id` or `slug` already exists.

## 12. POST /api/admin/seasons

Protected admin endpoint. Requires `Authorization: Bearer <token>`.

Creates a season for an existing sport + league.

### Request

- Method: `POST`
- Body:

```json
{
  "sportSlug": "football",
  "leagueSlug": "afc-champions-league-elite",
  "slug": "2026-2027",
  "label": "2026-2027",
  "startYear": 2026,
  "endYear": 2027,
  "defaultMatchDurationMinutes": 120
}
```

### Response 201

```json
{
  "id": 12,
  "sportSlug": "football",
  "leagueSlug": "afc-champions-league-elite",
  "slug": "2026-2027",
  "label": "2026-2027",
  "startYear": 2026,
  "endYear": 2027,
  "defaultMatchDurationMinutes": 120,
  "createdAt": "2026-03-16T08:00:00Z",
  "updatedAt": "2026-03-16T08:00:00Z"
}
```

### Error responses

- `400` when required fields are missing or `endYear < startYear`.
- `404` when the target sport + league does not exist.
- `409` when the season slug already exists under the league.

## 13. DELETE /api/admin/:sport/:league/seasons/:season

Protected admin endpoint. Requires `Authorization: Bearer <token>`.

Deletes a season and cascades deletion to all matches under that season.

### Request

- Method: `DELETE`
- Path params:
  - `sport` (string)
  - `league` (string)
  - `season` (string)

### Response 204

No response body.

### Error responses

- `404` when the season does not exist.

## 14. GET /healthz

Simple health check endpoint.
