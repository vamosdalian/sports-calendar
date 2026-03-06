#!/usr/bin/env python
"""Generate a readable markdown schedule from data/leagues.json + league fixtures CSV."""

from __future__ import annotations

import argparse
import csv
import re
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

from generate_ics import (
    LeagueConfig,
    load_leagues,
    parse_csl_style_datetime,
)

WEEKDAY_CN = ["一", "二", "三", "四", "五", "六", "日"]

SITE_BASE_URL = "https://sports-calendar.com"


def parse_args() -> argparse.Namespace:
    project_root = Path(__file__).resolve().parents[1]

    parser = argparse.ArgumentParser(description="Generate league schedule markdown")
    parser.add_argument(
        "--config",
        type=Path,
        default=project_root / "data" / "leagues.json",
    )
    parser.add_argument("--league", type=str, default="csl")
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=None,
    )
    return parser.parse_args()


def load_fixtures_raw(csv_path: Path, tz: ZoneInfo, season: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    with csv_path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            kickoff = parse_csl_style_datetime(
                (row.get("date") or "").strip(),
                (row.get("time") or "").strip(),
                season,
                tz,
            )
            rows.append(
                {
                    "round": (row.get("round") or "").strip(),
                    "home_team": (row.get("home_team") or "").strip(),
                    "away_team": (row.get("away_team") or "").strip(),
                    "kickoff": kickoff,
                    "stadium": (row.get("stadium") or "").strip(),
                }
            )
    return rows


def format_kickoff(dt: datetime) -> str:
    weekday = WEEKDAY_CN[dt.weekday()]
    return f"{dt.month}月{dt.day}日（周{weekday}）{dt.hour:02d}:{dt.minute:02d}"



def build_markdown(league: LeagueConfig, rows: list[dict[str, Any]]) -> str:
    rounds: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        rounds[row["round"]].append(row)

    team_codes = {t.name: t.code for t in league.teams}
    subscribe_url = f"{SITE_BASE_URL}/?league={league.league_id}"

    lines: list[str] = []
    lines.append(f"# {league.season} {league.display_name}完整赛程\n")
    lines.append(f"> 赛事：{league.league_name}")
    lines.append(f"> 赛季：{league.season}")
    lines.append(f"> 共 {len(rounds)} 轮，{len(rows)} 场比赛\n")

    lines.append("## 日历订阅\n")
    lines.append(f"打开 👉 [{SITE_BASE_URL}]({subscribe_url})")
    lines.append("选择你支持的球队，复制链接添加到手机日历即可自动同步赛程和抢票提醒。\n")

    lines.append("---\n")
    lines.append("## 赛程总览\n")

    round_keys = sorted(rounds.keys(), key=lambda r: int(r))
    for rnd in round_keys:
        fixtures = rounds[rnd]
        lines.append(f"### 第{rnd}轮\n")

        for row in fixtures:
            time_str = format_kickoff(row["kickoff"])
            lines.append(f"- **{row['home_team']}** vs **{row['away_team']}**  ")
            lines.append(f"  {time_str}  ")
            lines.append(f"  📍 {row['stadium']}  ")

        lines.append("")

    lines.append("---\n")
    lines.append(f"*数据来源：sports-calendar · 自动生成于 {datetime.now().strftime('%Y-%m-%d')}*\n")

    return "\n".join(lines)


def main() -> None:
    args = parse_args()
    config_path = args.config.resolve()
    data_dir = config_path.parent

    leagues = load_leagues(config_path)
    target_id = args.league.strip().lower()
    league = next((l for l in leagues if l.league_id == target_id), None)
    if league is None:
        raise ValueError(f"league not found in config: {target_id}")

    project_root = config_path.parents[1]
    output_dir = args.output_dir.resolve() if args.output_dir else (project_root / "docs").resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    tz = ZoneInfo(league.timezone)
    csv_path = data_dir / league.source_file
    rows = load_fixtures_raw(csv_path, tz, league.season)

    md_content = build_markdown(league, rows)
    output_path = output_dir / f"{league.file_prefix}_{league.season}_schedule.md"
    output_path.write_text(md_content, encoding="utf-8")
    print(f"Generated {output_path}")


if __name__ == "__main__":
    main()
