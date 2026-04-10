#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 ]]; then

echo "usage: $0 <base-url> <api-key> [league-id]" >&2
exit 1
fi

base_url="${1%/}"
api_key="$2"
league_id="${3:-4328}"

fetch_json() {
  local path="$1"
  curl --silent --show-error --fail \
    -H "Accept: application/json" \
    -H "X-API-KEY: ${api_key}" \
    "${base_url}${path}"
}

seasons_payload="$(fetch_json "/api/v2/json/list/seasons/${league_id}")"
season_value="$(printf '%s' "${seasons_payload}" | jq -r '.list | sort_by(.strSeason) | last | .strSeason')"

if [[ -z "${season_value}" || "${season_value}" == "null" ]]; then
  echo "failed to determine season for league ${league_id}" >&2
  exit 1
fi

echo "== sports =="
fetch_json "/api/v2/json/all/sports" | jq '{count: (.all | length), first: .all[0]}'

echo "== league =="
fetch_json "/api/v2/json/lookup/league/${league_id}" | jq '{count: (.lookup | length), first: .lookup[0] | {idLeague, strLeague, strSport, strCountry, strCurrentSeason}}'

echo "== teams =="
fetch_json "/api/v2/json/list/teams/${league_id}" | jq '{count: (.list | length), first: .list[0] | {idTeam, strTeam, strTeamShort}}'

echo "== seasons =="
printf '%s' "${seasons_payload}" | jq --arg season "${season_value}" '{count: (.list | length), latestSeason: $season}'

echo "== schedule =="
fetch_json "/api/v2/json/schedule/league/${league_id}/${season_value}" | jq '{count: (.schedule | length), first: .schedule[0] | {idEvent, strEvent, dateEvent, strTimestamp}}'