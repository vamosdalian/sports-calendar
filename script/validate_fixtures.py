#!/usr/bin/env python
"""Validate league fixtures CSV integrity."""

from __future__ import annotations

import argparse
import csv
import re
from collections import Counter, defaultdict
from pathlib import Path

DATE_RE = re.compile(r"^\d{1,2}月\d{1,2}日$")
TIME_RE = re.compile(r"^\d{1,2}:\d{2}$")


def parse_args() -> argparse.Namespace:
    project_root = Path(__file__).resolve().parents[1]

    parser = argparse.ArgumentParser(description="Validate fixtures CSV")
    parser.add_argument(
        "--csv",
        type=Path,
        default=project_root / "data" / "csl_fixtures.csv",
        help="Path to fixtures CSV",
    )
    parser.add_argument("--expected-rounds", type=int, default=30)
    parser.add_argument("--matches-per-round", type=int, default=8)
    parser.add_argument("--expected-teams", type=int, default=16)
    return parser.parse_args()


def add_error(errors: list[str], message: str) -> None:
    errors.append(message)


def validate(path: Path, expected_rounds: int, matches_per_round: int, expected_teams: int) -> list[str]:
    errors: list[str] = []

    if not path.exists():
        return [f"CSV file not found: {path}"]

    with path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        required_columns = {
            "round",
            "home_team",
            "away_team",
            "date",
            "time",
            "stadium",
            "status",
        }
        missing = required_columns - set(reader.fieldnames or [])
        if missing:
            return [f"Missing required columns: {sorted(missing)}"]

        rows = list(reader)

    expected_total_matches = expected_rounds * matches_per_round
    if len(rows) != expected_total_matches:
        add_error(
            errors,
            f"Total match count mismatch: expected {expected_total_matches}, got {len(rows)}",
        )

    round_to_matches: dict[int, list[tuple[str, str, int]]] = defaultdict(list)
    all_teams: set[str] = set()
    directed_pair_counter: Counter[tuple[str, str]] = Counter()
    undirected_pair_counter: Counter[tuple[str, str]] = Counter()
    team_home_counter: Counter[str] = Counter()
    team_away_counter: Counter[str] = Counter()

    for idx, row in enumerate(rows, start=2):
        round_raw = (row.get("round") or "").strip()
        home_team = (row.get("home_team") or "").strip()
        away_team = (row.get("away_team") or "").strip()
        date_text = (row.get("date") or "").strip()
        time_text = (row.get("time") or "").strip()
        stadium = (row.get("stadium") or "").strip()
        status = (row.get("status") or "").strip()

        if not round_raw:
            add_error(errors, f"Line {idx}: round is empty")
            continue

        try:
            round_no = int(round_raw)
        except ValueError:
            add_error(errors, f"Line {idx}: round is not an integer: {round_raw!r}")
            continue

        if not (1 <= round_no <= expected_rounds):
            add_error(errors, f"Line {idx}: round out of range 1-{expected_rounds}: {round_no}")

        if not home_team or not away_team:
            add_error(errors, f"Line {idx}: home_team/away_team cannot be empty")
            continue

        if home_team == away_team:
            add_error(errors, f"Line {idx}: home_team equals away_team: {home_team}")

        if not DATE_RE.match(date_text):
            add_error(errors, f"Line {idx}: date format invalid, expected 'M月D日', got {date_text!r}")

        if not TIME_RE.match(time_text):
            add_error(errors, f"Line {idx}: time format invalid, expected 'HH:MM', got {time_text!r}")

        if not stadium:
            add_error(errors, f"Line {idx}: stadium is empty")

        if not status:
            add_error(errors, f"Line {idx}: status is empty")

        round_to_matches[round_no].append((home_team, away_team, idx))
        all_teams.add(home_team)
        all_teams.add(away_team)

        directed_pair_counter[(home_team, away_team)] += 1
        pair_key = tuple(sorted((home_team, away_team)))
        undirected_pair_counter[pair_key] += 1
        team_home_counter[home_team] += 1
        team_away_counter[away_team] += 1

    # Round presence and exact counts.
    observed_rounds = set(round_to_matches)
    expected_round_set = set(range(1, expected_rounds + 1))

    missing_rounds = sorted(expected_round_set - observed_rounds)
    extra_rounds = sorted(observed_rounds - expected_round_set)
    if missing_rounds:
        add_error(errors, f"Missing rounds: {missing_rounds}")
    if extra_rounds:
        add_error(errors, f"Unexpected rounds: {extra_rounds}")

    for round_no in sorted(observed_rounds):
        matches = round_to_matches[round_no]
        if len(matches) != matches_per_round:
            add_error(
                errors,
                f"Round {round_no}: match count mismatch, expected {matches_per_round}, got {len(matches)}",
            )

        teams_in_round: list[str] = []
        seen_matchups: set[tuple[str, str]] = set()
        for home_team, away_team, line_no in matches:
            teams_in_round.extend([home_team, away_team])
            matchup = (home_team, away_team)
            if matchup in seen_matchups:
                add_error(
                    errors,
                    f"Round {round_no}: duplicate fixture {home_team} vs {away_team} (line {line_no})",
                )
            seen_matchups.add(matchup)

        team_count = Counter(teams_in_round)
        duplicated_teams = sorted([team for team, count in team_count.items() if count > 1])
        if duplicated_teams:
            add_error(
                errors,
                f"Round {round_no}: teams repeated in same round: {duplicated_teams}",
            )

        if len(team_count) != expected_teams:
            add_error(
                errors,
                f"Round {round_no}: unique team count mismatch, expected {expected_teams}, got {len(team_count)}",
            )

    # League-level checks.
    if len(all_teams) != expected_teams:
        add_error(
            errors,
            f"League unique team count mismatch: expected {expected_teams}, got {len(all_teams)}",
        )

    # Double round-robin checks.
    expected_pairs = expected_teams * (expected_teams - 1) // 2
    if len(undirected_pair_counter) != expected_pairs:
        add_error(
            errors,
            f"Unique team-pair count mismatch: expected {expected_pairs}, got {len(undirected_pair_counter)}",
        )

    bad_pair_counts = sorted((pair, cnt) for pair, cnt in undirected_pair_counter.items() if cnt != 2)
    for pair, cnt in bad_pair_counts:
        add_error(errors, f"Pair {pair[0]} / {pair[1]} appears {cnt} times, expected 2")

    bad_directed_counts = sorted((pair, cnt) for pair, cnt in directed_pair_counter.items() if cnt != 1)
    for pair, cnt in bad_directed_counts:
        add_error(errors, f"Fixture {pair[0]} vs {pair[1]} appears {cnt} times, expected 1")

    expected_games_per_team = (expected_teams - 1) * 2
    expected_home_per_team = expected_teams - 1
    expected_away_per_team = expected_teams - 1

    for team in sorted(all_teams):
        home_games = team_home_counter[team]
        away_games = team_away_counter[team]
        total_games = home_games + away_games
        if total_games != expected_games_per_team:
            add_error(
                errors,
                f"Team {team}: total games mismatch, expected {expected_games_per_team}, got {total_games}",
            )
        if home_games != expected_home_per_team:
            add_error(
                errors,
                f"Team {team}: home games mismatch, expected {expected_home_per_team}, got {home_games}",
            )
        if away_games != expected_away_per_team:
            add_error(
                errors,
                f"Team {team}: away games mismatch, expected {expected_away_per_team}, got {away_games}",
            )

    return errors


def main() -> int:
    args = parse_args()
    errors = validate(
        path=args.csv,
        expected_rounds=args.expected_rounds,
        matches_per_round=args.matches_per_round,
        expected_teams=args.expected_teams,
    )

    if errors:
        print(f"FAIL: {args.csv.name} validation failed")
        print(f"Total errors: {len(errors)}")
        for err in errors:
            print(f"- {err}")
        return 1

    print(f"PASS: {args.csv.name} validation passed")
    print(
        f"Checked: rounds={args.expected_rounds}, matches_per_round={args.matches_per_round}, teams={args.expected_teams}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
