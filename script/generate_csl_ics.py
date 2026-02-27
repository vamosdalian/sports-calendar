#!/usr/bin/env python3
"""Generate league team calendars from CSV fixtures and YAML metadata."""

from __future__ import annotations

import argparse
import csv
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

import yaml
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


def parse_args() -> argparse.Namespace:
    project_root = Path(__file__).resolve().parents[1]

    parser = argparse.ArgumentParser(description="Generate league ICS files")
    parser.add_argument(
        "--meta",
        type=Path,
        default=project_root / "data" / "csl_meta.yaml",
        help="Path to metadata YAML file",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=None,
        help="Optional calendar output dir, overrides meta output_dir if set",
    )
    return parser.parse_args()


def parse_datetime(raw_value: str, default_tz: ZoneInfo) -> datetime:
    parsed = datetime.fromisoformat(raw_value.strip())
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=default_tz)
    return parsed


def load_meta(meta_path: Path) -> dict[str, Any]:
    with meta_path.open("r", encoding="utf-8") as f:
        meta = yaml.safe_load(f)

    required_keys = {
        "league_id",
        "league_name",
        "season",
        "timezone",
        "default_match_duration_minutes",
        "calendar_name_template",
        "calendar_with_ticket_name_template",
        "calendar_description",
        "source_file",
        "teams",
    }
    missing = required_keys - set(meta.keys())
    if missing:
        raise ValueError(f"meta missing required fields: {sorted(missing)}")

    return meta


def load_teams(meta: dict[str, Any]) -> list[Team]:
    teams_raw = meta["teams"]
    teams: list[Team] = []
    for item in teams_raw:
        code = str(item["code"]).strip()
        name = str(item["name"]).strip()
        if not code or not name:
            raise ValueError("team code/name cannot be empty")
        teams.append(Team(code=code, name=name))
    return teams


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


def ensure_fixture_teams_exist(fixtures: list[Fixture], teams: list[Team]) -> None:
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
        raise ValueError(f"fixture has teams not found in meta teams: {unknown}")


def render_template(template: str, context: dict[str, Any], field_name: str) -> str:
    try:
        return template.format(**context)
    except KeyError as exc:
        raise ValueError(
            f"meta {field_name} has unknown placeholder: {exc.args[0]}"
        ) from exc


def build_calendar_base(
    meta: dict[str, Any],
    team_name: str,
    include_ticket: bool,
) -> Calendar:
    league_id = str(meta["league_id"]).strip().upper()
    prodid = str(meta.get("prodid", f"-//sports-calendar//{league_id}//CN"))

    cal = Calendar()
    cal.add("prodid", prodid)
    cal.add("version", "2.0")
    cal.add("calscale", "GREGORIAN")
    cal.add("x-wr-timezone", meta["timezone"])

    if include_ticket:
        cal_name = str(meta["calendar_with_ticket_name_template"]).format(team=team_name)
    else:
        cal_name = str(meta["calendar_name_template"]).format(team=team_name)

    cal.add("x-wr-calname", cal_name)
    cal.add("x-wr-caldesc", meta["calendar_description"])
    return cal


def add_match_event(
    cal: Calendar,
    fixture: Fixture,
    meta: dict[str, Any],
    league_id: str,
    season: str,
    duration_minutes: int,
) -> None:
    summary_template = str(
        meta.get("match_summary_template", "【{league_name}】{home_team} vs {away_team}")
    )
    description_template = str(
        meta.get(
            "match_description_template",
            (
                "赛事: {home_team} vs {away_team}\\n"
                "轮次: 第{round_no}轮\\n"
                "状态: {status}\\n"
                "比赛编号: {match_id}"
            ),
        )
    )

    context = {
        "league_id": league_id,
        "league_name": str(meta["league_name"]),
        "season": season,
        "match_id": fixture.match_id,
        "round_no": fixture.round_no,
        "home_team": fixture.home_team,
        "away_team": fixture.away_team,
        "stadium": fixture.stadium,
        "city": fixture.city,
        "status": fixture.status,
        "kickoff_iso": fixture.kickoff.isoformat(),
    }

    event = Event()
    event.add("uid", f"{league_id}-{season}-{fixture.match_id}@sports-calendar")
    event.add("dtstamp", datetime.now(UTC))
    event.add("dtstart", fixture.kickoff)
    event.add("dtend", fixture.kickoff + timedelta(minutes=duration_minutes))
    event.add("summary", render_template(summary_template, context, "match_summary_template"))
    event.add("location", f"{fixture.stadium}（{fixture.city}）")
    event.add(
        "description",
        render_template(description_template, context, "match_description_template"),
    )
    event.add("categories", str(meta.get("match_category", "比赛")))
    cal.add_component(event)


def add_ticket_event(
    cal: Calendar,
    fixture: Fixture,
    meta: dict[str, Any],
    league_id: str,
    season: str,
) -> None:
    if fixture.ticket_open is None:
        return

    ticket_text = fixture.ticket_url if fixture.ticket_url else "暂无"
    summary_template = str(
        meta.get("ticket_summary_template", "【抢票提醒】{home_team} vs {away_team}")
    )
    description_template = str(
        meta.get(
            "ticket_description_template",
            (
                "抢票时间: {ticket_open_iso}\\n"
                "比赛: {home_team} vs {away_team}\\n"
                "售票链接: {ticket_url}"
            ),
        )
    )
    ticket_duration = int(meta.get("ticket_duration_minutes", 15))

    context = {
        "league_id": league_id,
        "league_name": str(meta["league_name"]),
        "season": season,
        "match_id": fixture.match_id,
        "round_no": fixture.round_no,
        "home_team": fixture.home_team,
        "away_team": fixture.away_team,
        "stadium": fixture.stadium,
        "city": fixture.city,
        "status": fixture.status,
        "kickoff_iso": fixture.kickoff.isoformat(),
        "ticket_open_iso": fixture.ticket_open.isoformat(),
        "ticket_url": ticket_text,
    }

    event = Event()
    event.add("uid", f"{league_id}-{season}-{fixture.match_id}-ticket@sports-calendar")
    event.add("dtstamp", datetime.now(UTC))
    event.add("dtstart", fixture.ticket_open)
    event.add("dtend", fixture.ticket_open + timedelta(minutes=ticket_duration))
    event.add("summary", render_template(summary_template, context, "ticket_summary_template"))
    event.add("location", str(meta.get("ticket_location", "线上售票")))
    event.add(
        "description",
        render_template(description_template, context, "ticket_description_template"),
    )
    event.add("categories", str(meta.get("ticket_category", "抢票")))
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


def main() -> None:
    args = parse_args()
    meta_path = args.meta.resolve()
    meta = load_meta(meta_path)
    teams = load_teams(meta)

    timezone_name = str(meta["timezone"]).strip()
    tz = ZoneInfo(timezone_name)

    data_dir = meta_path.parent
    fixtures_path = data_dir / str(meta["source_file"])
    fixtures = load_fixtures(fixtures_path, tz)
    ensure_fixture_teams_exist(fixtures, teams)

    project_root = meta_path.parents[1]
    output_dir = (
        args.output_dir.resolve()
        if args.output_dir
        else (project_root / str(meta.get("output_dir", "calendar"))).resolve()
    )

    league_id = str(meta["league_id"]).strip()
    season = str(meta["season"]).strip()
    duration_minutes = int(meta["default_match_duration_minutes"])

    for team in teams:
        team_fixtures = fixtures_for_team(fixtures, team.name)

        match_only_cal = build_calendar_base(meta, team.name, include_ticket=False)
        for fixture in team_fixtures:
            add_match_event(match_only_cal, fixture, meta, league_id, season, duration_minutes)

        with_ticket_cal = build_calendar_base(meta, team.name, include_ticket=True)
        for fixture in team_fixtures:
            add_match_event(with_ticket_cal, fixture, meta, league_id, season, duration_minutes)
            add_ticket_event(with_ticket_cal, fixture, meta, league_id, season)

        match_only_path = output_dir / f"{league_id}_{team.code}.ics"
        with_ticket_path = output_dir / f"{league_id}_{team.code}_with_ticket.ics"
        write_calendar(match_only_path, match_only_cal)
        write_calendar(with_ticket_path, with_ticket_cal)

    print(f"Generated {len(teams) * 2} ICS files in {output_dir}")


if __name__ == "__main__":
    main()
