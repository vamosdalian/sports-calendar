#!/usr/bin/env python3
"""Generate league calendars from data/leagues.json + league CSV fixtures."""

from __future__ import annotations

import argparse
import csv
import json
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

from icalendar import Calendar, Event


@dataclass(frozen=True)
class Team:
    code: str
    name: str


@dataclass(frozen=True)
class Fixture:
    match_id: str
    round_no: str
    kickoff: datetime
    home_team: str
    away_team: str
    stadium: str
    city: str
    ticket_open: datetime | None
    ticket_url: str
    status: str


@dataclass(frozen=True)
class LeagueConfig:
    league_id: str
    league_name: str
    season: str
    timezone: str
    file_prefix: str
    default_match_duration_minutes: int
    calendar_name_template: str
    calendar_with_ticket_name_template: str
    calendar_description: str
    source_file: str
    prodid: str
    match_summary_template: str
    match_description_template: str
    match_category: str
    ticket_summary_template: str
    ticket_description_template: str
    ticket_duration_minutes: int
    ticket_category: str
    ticket_location: str
    teams: list[Team]


DEFAULT_MATCH_DESCRIPTION_TEMPLATE = (
    "赛事: {home_team} vs {away_team}\\n"
    "轮次: 第{round_no}轮\\n"
    "状态: {status}\\n"
    "比赛编号: {match_id}"
)

DEFAULT_TICKET_DESCRIPTION_TEMPLATE = (
    "抢票时间: {ticket_open_iso}\\n"
    "比赛: {home_team} vs {away_team}\\n"
    "售票链接: {ticket_url}"
)


def parse_args() -> argparse.Namespace:
    project_root = Path(__file__).resolve().parents[1]

    parser = argparse.ArgumentParser(description="Generate league ICS files")
    parser.add_argument(
        "--config",
        type=Path,
        default=project_root / "data" / "leagues.json",
        help="Path to leagues JSON config",
    )
    parser.add_argument(
        "--league",
        type=str,
        default=None,
        help="Generate specific league only, e.g. csl",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=None,
        help="Optional calendar output dir",
    )
    return parser.parse_args()


def parse_datetime(raw_value: str, default_tz: ZoneInfo) -> datetime:
    parsed = datetime.fromisoformat(raw_value.strip())
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=default_tz)
    return parsed


def load_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, dict):
        raise ValueError("config JSON root must be an object")
    return data


def ensure_str(value: Any, field_name: str) -> str:
    text = str(value).strip()
    if not text:
        raise ValueError(f"{field_name} cannot be empty")
    return text


def load_leagues(config_path: Path) -> list[LeagueConfig]:
    raw = load_json(config_path)
    leagues = raw.get("leagues")
    if not isinstance(leagues, list) or not leagues:
        raise ValueError("config must contain non-empty leagues list")

    result: list[LeagueConfig] = []
    for league in leagues:
        if not isinstance(league, dict):
            raise ValueError("each league entry must be an object")

        league_id = ensure_str(league.get("id"), "league.id").lower()
        league_name = ensure_str(league.get("name"), f"{league_id}.name")
        season = ensure_str(league.get("season"), f"{league_id}.season")
        timezone = ensure_str(league.get("timezone"), f"{league_id}.timezone")
        source_file = ensure_str(league.get("source_file"), f"{league_id}.source_file")

        file_prefix = str(league.get("filePrefix") or league.get("file_prefix") or league_id).strip()
        if not file_prefix:
            file_prefix = league_id

        teams_raw = league.get("teams")
        if not isinstance(teams_raw, list) or not teams_raw:
            raise ValueError(f"{league_id}.teams must be a non-empty list")

        teams: list[Team] = []
        for item in teams_raw:
            if not isinstance(item, dict):
                raise ValueError(f"{league_id}.teams item must be an object")
            code = ensure_str(item.get("code"), f"{league_id}.teams.code")
            name = ensure_str(item.get("name"), f"{league_id}.teams.name")
            teams.append(Team(code=code, name=name))

        duration = int(league.get("default_match_duration_minutes", 120))
        ticket_duration = int(league.get("ticket_duration_minutes", 15))

        prodid = str(league.get("prodid", f"-//sports-calendar//{league_id.upper()}//CN"))

        result.append(
            LeagueConfig(
                league_id=league_id,
                league_name=league_name,
                season=season,
                timezone=timezone,
                file_prefix=file_prefix,
                default_match_duration_minutes=duration,
                calendar_name_template=ensure_str(
                    league.get("calendar_name_template"),
                    f"{league_id}.calendar_name_template",
                ),
                calendar_with_ticket_name_template=ensure_str(
                    league.get("calendar_with_ticket_name_template"),
                    f"{league_id}.calendar_with_ticket_name_template",
                ),
                calendar_description=ensure_str(
                    league.get("calendar_description"),
                    f"{league_id}.calendar_description",
                ),
                source_file=source_file,
                prodid=prodid,
                match_summary_template=str(
                    league.get(
                        "match_summary_template",
                        "【{league_name}】{home_team} vs {away_team}",
                    )
                ),
                match_description_template=str(
                    league.get(
                        "match_description_template",
                        DEFAULT_MATCH_DESCRIPTION_TEMPLATE,
                    )
                ),
                match_category=str(league.get("match_category", "比赛")),
                ticket_summary_template=str(
                    league.get("ticket_summary_template", "【抢票提醒】{home_team} vs {away_team}")
                ),
                ticket_description_template=str(
                    league.get(
                        "ticket_description_template",
                        DEFAULT_TICKET_DESCRIPTION_TEMPLATE,
                    )
                ),
                ticket_duration_minutes=ticket_duration,
                ticket_category=str(league.get("ticket_category", "抢票")),
                ticket_location=str(league.get("ticket_location", "线上售票")),
                teams=teams,
            )
        )

    unique_ids = {item.league_id for item in result}
    if len(unique_ids) != len(result):
        raise ValueError("league.id must be unique")

    return result


def load_fixtures(csv_path: Path, tz: ZoneInfo) -> list[Fixture]:
    fixtures: list[Fixture] = []
    with csv_path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        required_columns = {
            "match_id",
            "round",
            "kickoff",
            "home_team",
            "away_team",
            "stadium",
            "city",
            "ticket_open",
            "ticket_url",
            "status",
        }
        missing = required_columns - set(reader.fieldnames or [])
        if missing:
            raise ValueError(f"fixtures CSV missing required columns: {sorted(missing)}")

        for row in reader:
            kickoff = parse_datetime(row["kickoff"], tz)
            ticket_open_raw = row["ticket_open"].strip()
            ticket_open = parse_datetime(ticket_open_raw, tz) if ticket_open_raw else None

            fixtures.append(
                Fixture(
                    match_id=row["match_id"].strip(),
                    round_no=row["round"].strip(),
                    kickoff=kickoff,
                    home_team=row["home_team"].strip(),
                    away_team=row["away_team"].strip(),
                    stadium=row["stadium"].strip(),
                    city=row["city"].strip(),
                    ticket_open=ticket_open,
                    ticket_url=row["ticket_url"].strip(),
                    status=row["status"].strip(),
                )
            )
    return fixtures


def ensure_fixture_teams_exist(fixtures: list[Fixture], teams: list[Team], league_id: str) -> None:
    team_names = {team.name for team in teams}
    unknown = sorted(
        {
            fixture.home_team
            for fixture in fixtures
            if fixture.home_team not in team_names
        }
        | {
            fixture.away_team
            for fixture in fixtures
            if fixture.away_team not in team_names
        }
    )
    if unknown:
        raise ValueError(f"{league_id}: fixture has teams not found in teams list: {unknown}")


def render_template(template: str, context: dict[str, Any], field_name: str) -> str:
    try:
        return template.format(**context)
    except KeyError as exc:
        raise ValueError(
            f"template {field_name} has unknown placeholder: {exc.args[0]}"
        ) from exc


def build_calendar_base(league: LeagueConfig, team_name: str, include_ticket: bool) -> Calendar:
    cal = Calendar()
    cal.add("prodid", league.prodid)
    cal.add("version", "2.0")
    cal.add("calscale", "GREGORIAN")
    cal.add("x-wr-timezone", league.timezone)

    if include_ticket:
        cal_name = league.calendar_with_ticket_name_template.format(team=team_name)
    else:
        cal_name = league.calendar_name_template.format(team=team_name)

    cal.add("x-wr-calname", cal_name)
    cal.add("x-wr-caldesc", league.calendar_description)
    return cal


def make_template_context(league: LeagueConfig, fixture: Fixture, ticket_url: str = "") -> dict[str, Any]:
    context = {
        "league_id": league.league_id,
        "league_name": league.league_name,
        "season": league.season,
        "match_id": fixture.match_id,
        "round_no": fixture.round_no,
        "home_team": fixture.home_team,
        "away_team": fixture.away_team,
        "stadium": fixture.stadium,
        "city": fixture.city,
        "status": fixture.status,
        "kickoff_iso": fixture.kickoff.isoformat(),
        "ticket_open_iso": fixture.ticket_open.isoformat() if fixture.ticket_open else "",
        "ticket_url": ticket_url,
    }
    return context


def add_match_event(cal: Calendar, fixture: Fixture, league: LeagueConfig) -> None:
    context = make_template_context(league, fixture)

    event = Event()
    event.add(
        "uid",
        f"{league.league_id}-{league.season}-{fixture.match_id}@sports-calendar",
    )
    event.add("dtstamp", datetime.now(UTC))
    event.add("dtstart", fixture.kickoff)
    event.add(
        "dtend",
        fixture.kickoff + timedelta(minutes=league.default_match_duration_minutes),
    )
    event.add(
        "summary",
        render_template(
            league.match_summary_template,
            context,
            f"{league.league_id}.match_summary_template",
        ),
    )
    event.add("location", f"{fixture.stadium}（{fixture.city}）")
    event.add(
        "description",
        render_template(
            league.match_description_template,
            context,
            f"{league.league_id}.match_description_template",
        ),
    )
    event.add("categories", league.match_category)
    cal.add_component(event)


def add_ticket_event(cal: Calendar, fixture: Fixture, league: LeagueConfig) -> None:
    if fixture.ticket_open is None:
        return

    ticket_text = fixture.ticket_url if fixture.ticket_url else "暂无"
    context = make_template_context(league, fixture, ticket_url=ticket_text)

    event = Event()
    event.add(
        "uid",
        f"{league.league_id}-{league.season}-{fixture.match_id}-ticket@sports-calendar",
    )
    event.add("dtstamp", datetime.now(UTC))
    event.add("dtstart", fixture.ticket_open)
    event.add(
        "dtend",
        fixture.ticket_open + timedelta(minutes=league.ticket_duration_minutes),
    )
    event.add(
        "summary",
        render_template(
            league.ticket_summary_template,
            context,
            f"{league.league_id}.ticket_summary_template",
        ),
    )
    event.add("location", league.ticket_location)
    event.add(
        "description",
        render_template(
            league.ticket_description_template,
            context,
            f"{league.league_id}.ticket_description_template",
        ),
    )
    event.add("categories", league.ticket_category)
    cal.add_component(event)


def fixtures_for_team(fixtures: list[Fixture], team_name: str) -> list[Fixture]:
    return [
        fixture
        for fixture in fixtures
        if fixture.home_team == team_name or fixture.away_team == team_name
    ]


def write_calendar(output_path: Path, calendar: Calendar) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_bytes(calendar.to_ical())


def generate_league_calendars(
    league: LeagueConfig,
    data_dir: Path,
    output_dir: Path,
) -> int:
    tz = ZoneInfo(league.timezone)
    fixtures_path = data_dir / league.source_file
    fixtures = load_fixtures(fixtures_path, tz)
    ensure_fixture_teams_exist(fixtures, league.teams, league.league_id)

    for team in league.teams:
        team_fixtures = fixtures_for_team(fixtures, team.name)

        match_only_cal = build_calendar_base(league, team.name, include_ticket=False)
        for fixture in team_fixtures:
            add_match_event(match_only_cal, fixture, league)

        with_ticket_cal = build_calendar_base(league, team.name, include_ticket=True)
        for fixture in team_fixtures:
            add_match_event(with_ticket_cal, fixture, league)
            add_ticket_event(with_ticket_cal, fixture, league)

        match_only_path = output_dir / f"{league.file_prefix}_{team.code}.ics"
        with_ticket_path = output_dir / f"{league.file_prefix}_{team.code}_with_ticket.ics"
        write_calendar(match_only_path, match_only_cal)
        write_calendar(with_ticket_path, with_ticket_cal)

    return len(league.teams) * 2


def main() -> None:
    args = parse_args()
    config_path = args.config.resolve()
    data_dir = config_path.parent

    leagues = load_leagues(config_path)
    if args.league:
        target_id = args.league.strip().lower()
        leagues = [league for league in leagues if league.league_id == target_id]
        if not leagues:
            raise ValueError(f"league not found in config: {target_id}")

    project_root = config_path.parents[1]
    output_dir = args.output_dir.resolve() if args.output_dir else (project_root / "calendar").resolve()

    total = 0
    for league in leagues:
        count = generate_league_calendars(league, data_dir, output_dir)
        total += count
        print(f"[{league.league_id}] generated {count} ICS files")

    print(f"Generated {total} ICS files in {output_dir}")


if __name__ == "__main__":
    main()
