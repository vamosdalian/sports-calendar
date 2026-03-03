#!/usr/bin/env python3
"""Generate league calendars from data/leagues.json + league fixtures CSV."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

from icalendar import Alarm, Calendar, Event

DATE_RE = re.compile(r"^(\d{1,2})月(\d{1,2})日$")
TIME_RE = re.compile(r"^(\d{1,2}):(\d{2})$")


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
    ticket_open: datetime | None
    ticket_url: str
    ticket_channel: str
    status: str


@dataclass(frozen=True)
class LeagueConfig:
    league_id: str
    league_name: str
    display_name: str
    season: str
    timezone: str
    file_prefix: str
    default_match_duration_minutes: int
    source_file: str
    prodid: str
    ticket_duration_minutes: int
    teams: list[Team]


MATCH_SUMMARY_TEMPLATE = "【{display_name}】{home_team} vs {away_team}"
MATCH_DESCRIPTION_TEMPLATE = (
    "赛事: {home_team} vs {away_team}\n"
    "轮次: 第{round_no}轮\n"
    "状态: {status}"
)
MATCH_CATEGORY = "比赛"

TICKET_SUMMARY_TEMPLATE = "【抢票提醒】{home_team} vs {away_team}"
TICKET_DESCRIPTION_TEMPLATE = (
    "抢票时间: {ticket_open_time}\n"
    "比赛: {home_team} vs {away_team}\n"
    "售票方式: {ticket_channel}\n"
    "售票链接: {ticket_url}"
)
TICKET_CATEGORY = "抢票"
TICKET_LOCATION = "线上售票"


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


def parse_season_year(season: str) -> int:
    season_value = season.strip()
    if not season_value.isdigit():
        raise ValueError(f"season must be a numeric year, got: {season!r}")
    return int(season_value)


def parse_csl_style_datetime(date_text: str, time_text: str, season: str, tz: ZoneInfo) -> datetime:
    date_match = DATE_RE.fullmatch(date_text.strip())
    if not date_match:
        raise ValueError(f"invalid date format {date_text!r}, expected M月D日")

    time_match = TIME_RE.fullmatch(time_text.strip())
    if not time_match:
        raise ValueError(f"invalid time format {time_text!r}, expected HH:MM")

    year = parse_season_year(season)
    month = int(date_match.group(1))
    day = int(date_match.group(2))
    hour = int(time_match.group(1))
    minute = int(time_match.group(2))

    return datetime(year, month, day, hour, minute, tzinfo=tz)


def parse_ticket_open(date_text: str, time_text: str, season: str, tz: ZoneInfo) -> datetime | None:
    date_val = date_text.strip()
    time_val = time_text.strip()
    if not date_val and not time_val:
        return None
    if not date_val or not time_val:
        raise ValueError(
            f"ticket_open_date and ticket_open_time must both be set or both be empty, "
            f"got date={date_text!r} time={time_text!r}"
        )
    return parse_csl_style_datetime(date_val, time_val, season, tz)


def build_auto_match_id(row: dict[str, str], line_number: int) -> str:
    basis = "|".join(
        [
            (row.get("round") or "").strip(),
            (row.get("home_team") or "").strip(),
            (row.get("away_team") or "").strip(),
            (row.get("date") or "").strip(),
            (row.get("time") or "").strip(),
            str(line_number),
        ]
    )
    digest = hashlib.blake2s(basis.encode("utf-8"), digest_size=8).hexdigest()
    return f"auto-{digest}"


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
        display_name = str(league.get("displayName") or league.get("display_name") or league_name).strip()

        result.append(
            LeagueConfig(
                league_id=league_id,
                league_name=league_name,
                display_name=display_name,
                season=season,
                timezone=timezone,
                file_prefix=file_prefix,
                default_match_duration_minutes=duration,
                source_file=source_file,
                prodid=prodid,
                ticket_duration_minutes=ticket_duration,
                teams=teams,
            )
        )

    unique_ids = {item.league_id for item in result}
    if len(unique_ids) != len(result):
        raise ValueError("league.id must be unique")

    return result


def load_fixtures(csv_path: Path, tz: ZoneInfo, season: str) -> list[Fixture]:
    fixtures: list[Fixture] = []

    with csv_path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        fieldnames = set(reader.fieldnames or [])

        required_columns = {
            "round",
            "home_team",
            "away_team",
            "date",
            "time",
            "stadium",
            "ticket_open_date",
            "ticket_open_time",
            "status",
        }

        missing = required_columns - fieldnames
        if missing:
            raise ValueError(f"fixtures CSV missing required columns: {sorted(missing)}")

        for line_number, row in enumerate(reader, start=2):
            round_no = (row.get("round") or "").strip()
            home_team = (row.get("home_team") or "").strip()
            away_team = (row.get("away_team") or "").strip()
            stadium = (row.get("stadium") or "").strip()
            status = (row.get("status") or "").strip()

            if not round_no:
                raise ValueError(f"line {line_number}: round cannot be empty")
            if not home_team or not away_team:
                raise ValueError(f"line {line_number}: home_team/away_team cannot be empty")
            if home_team == away_team:
                raise ValueError(f"line {line_number}: home_team cannot equal away_team")
            if not stadium:
                raise ValueError(f"line {line_number}: stadium cannot be empty")

            try:
                kickoff = parse_csl_style_datetime(
                    (row.get("date") or "").strip(),
                    (row.get("time") or "").strip(),
                    season,
                    tz,
                )
            except ValueError as exc:
                raise ValueError(f"line {line_number}: invalid kickoff data: {exc}") from exc

            try:
                ticket_open = parse_ticket_open(
                    (row.get("ticket_open_date") or "").strip(),
                    (row.get("ticket_open_time") or "").strip(),
                    season,
                    tz,
                )
            except ValueError as exc:
                raise ValueError(f"line {line_number}: invalid ticket open data: {exc}") from exc

            match_id = (row.get("match_id") or "").strip() or build_auto_match_id(row, line_number)
            ticket_url = (row.get("ticket_url") or "").strip()
            ticket_channel = (row.get("ticket_channel") or "").strip()

            fixtures.append(
                Fixture(
                    match_id=match_id,
                    round_no=round_no,
                    kickoff=kickoff,
                    home_team=home_team,
                    away_team=away_team,
                    stadium=stadium,
                    ticket_open=ticket_open,
                    ticket_url=ticket_url,
                    ticket_channel=ticket_channel,
                    status=status,
                )
            )

    if not fixtures:
        raise ValueError(f"no fixtures loaded from {csv_path}")

    return fixtures


def team_code_from_name(name: str) -> str:
    code = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    if code:
        return code

    digest = hashlib.blake2s(name.encode("utf-8"), digest_size=5).hexdigest()
    return f"team-{digest}"


def resolve_teams(
    fixtures: list[Fixture],
    configured_teams: list[Team],
) -> tuple[list[Team], list[Team], list[Team]]:
    configured_by_name = {team.name: team for team in configured_teams}

    fixture_team_order: list[str] = []
    seen: set[str] = set()
    for fixture in fixtures:
        for team_name in (fixture.home_team, fixture.away_team):
            if team_name not in seen:
                seen.add(team_name)
                fixture_team_order.append(team_name)

    resolved: list[Team] = []
    unknown_from_config: list[Team] = []
    for team_name in fixture_team_order:
        configured = configured_by_name.get(team_name)
        if configured:
            resolved.append(configured)
        else:
            generated = Team(code=team_code_from_name(team_name), name=team_name)
            resolved.append(generated)
            unknown_from_config.append(generated)

    missing_from_fixtures = [team for team in configured_teams if team.name not in seen]

    used_codes: set[str] = set()
    unique_resolved: list[Team] = []
    for team in resolved:
        code = team.code
        if code not in used_codes:
            used_codes.add(code)
            unique_resolved.append(team)
            continue

        suffix = 2
        while f"{code}-{suffix}" in used_codes:
            suffix += 1
        new_code = f"{code}-{suffix}"
        used_codes.add(new_code)
        unique_resolved.append(Team(code=new_code, name=team.name))

    return unique_resolved, unknown_from_config, missing_from_fixtures


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

    suffix = "比赛+抢票日历" if include_ticket else "比赛日历"
    cal.add("x-wr-calname", f"{team_name} - {league.display_name}{suffix}")
    cal.add("x-wr-caldesc", f"由 sports-calendar 自动生成的{league.display_name}赛程订阅")
    cal.add("last-modified", datetime.now(UTC))
    cal.add("x-published-ttl", "PT1H")
    return cal


def make_template_context(league: LeagueConfig, fixture: Fixture, ticket_url: str = "") -> dict[str, Any]:
    context = {
        "league_id": league.league_id,
        "league_name": league.league_name,
        "display_name": league.display_name,
        "season": league.season,
        "match_id": fixture.match_id,
        "round_no": fixture.round_no,
        "home_team": fixture.home_team,
        "away_team": fixture.away_team,
        "stadium": fixture.stadium,
        "status": {"Scheduled": "未赛", "Playing": "进行中", "Finished": "结束"}.get(fixture.status, fixture.status),
        "kickoff_iso": fixture.kickoff.isoformat(),
        "ticket_open_time": fixture.ticket_open.strftime("%Y-%m-%d %H:%M") if fixture.ticket_open else "",
        "ticket_url": ticket_url,
        "ticket_channel": fixture.ticket_channel,
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
        render_template(MATCH_SUMMARY_TEMPLATE, context, "match_summary"),
    )
    event.add("location", fixture.stadium)
    event.add(
        "description",
        render_template(MATCH_DESCRIPTION_TEMPLATE, context, "match_description"),
    )
    event.add("last-modified", datetime.now(UTC))
    event.add("categories", MATCH_CATEGORY)

    alarm = Alarm()
    alarm.add("action", "DISPLAY")
    alarm.add("description", "比赛即将开始")
    alarm.add("trigger", timedelta(minutes=-30))
    event.add_component(alarm)

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
        render_template(TICKET_SUMMARY_TEMPLATE, context, "ticket_summary"),
    )
    event.add("location", TICKET_LOCATION)
    event.add(
        "description",
        render_template(TICKET_DESCRIPTION_TEMPLATE, context, "ticket_description"),
    )
    event.add("last-modified", datetime.now(UTC))
    event.add("categories", TICKET_CATEGORY)

    alarm = Alarm()
    alarm.add("action", "DISPLAY")
    alarm.add("description", "抢票即将开始")
    alarm.add("trigger", timedelta(minutes=-5))
    event.add_component(alarm)

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
    fixtures = load_fixtures(fixtures_path, tz, league.season)

    target_teams, unknown_teams, missing_teams = resolve_teams(fixtures, league.teams)

    if unknown_teams:
        team_text = ", ".join(f"{team.name}->{team.code}" for team in unknown_teams)
        print(f"[{league.league_id}] warning: fixture teams missing in config, generated codes: {team_text}")

    if missing_teams:
        names = ", ".join(team.name for team in missing_teams)
        print(f"[{league.league_id}] warning: config teams not found in fixture: {names}")

    for team in target_teams:
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

    return len(target_teams) * 2


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
