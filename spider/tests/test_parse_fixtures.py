"""Regression tests for the fixture-list parser.

These guard a failure mode that is invisible in production: Transfermarkt
prints a kickoff slot once, on a header row above the matches that share it, so
a parser that only reads the match rows silently produces fixtures with no time
(stored as local midnight) or with a neighbouring slot's time. Both look like
ordinary data downstream — the calendar just shows the wrong hour.
"""

from datetime import date, time
from pathlib import Path

import pytest
from selectolax.parser import HTMLParser

from app.scraper.transfermarkt import parse_fixtures

SAMPLES = Path(__file__).parent / "samples"


def load(name: str, code: str, season: int) -> list[dict]:
    tree = HTMLParser((SAMPLES / name).read_text(encoding="utf-8"))
    return parse_fixtures(tree, code, season)["fixtures"]


@pytest.fixture(scope="module")
def cup_fixtures() -> list[dict]:
    return load("cl_fixtures.html", "CL", 2025)


@pytest.fixture(scope="module")
def league_fixtures() -> list[dict]:
    return load("gb1_fixtures.html", "GB1", 2025)


@pytest.mark.parametrize("sample", ["cup_fixtures", "league_fixtures"])
def test_every_fixture_has_a_date_and_kickoff(sample, request):
    fixtures = request.getfixturevalue(sample)
    assert fixtures, "sample parsed to nothing"
    missing = [f for f in fixtures if f["date"] is None or f["time"] is None]
    assert missing == [], f"{len(missing)} fixtures without a kickoff"


def test_cup_matches_inherit_their_slot_time(cup_fixtures):
    """The 16/09 league-phase evening has a 6:45 PM slot with two matches and a
    9:00 PM slot with four. Only the slot headers carry the time."""
    by_id = {f["match_id"]: f for f in cup_fixtures}

    early = [4716778, 4716779]  # Athletic-Arsenal, PSV-Union SG
    late = [4716774, 4716843, 4716844, 4716845]

    for match_id in early:
        assert by_id[match_id]["time"] == time(18, 45), match_id
    for match_id in late:
        assert by_id[match_id]["time"] == time(21, 0), match_id
    assert all(by_id[m]["date"] == date(2025, 9, 16) for m in early + late)


def test_league_matches_inherit_their_slot_time(league_fixtures):
    """Same shape in a league table: three matches kick off at 15:00 BST on
    23/08 but only the first row prints the time."""
    by_id = {f["match_id"]: f for f in league_fixtures}

    for match_id in (4625789, 4625791, 4625792):
        assert by_id[match_id]["time"] == time(16, 0), match_id
        assert by_id[match_id]["date"] == date(2025, 8, 23), match_id

    # Rows that do print their own time must keep it.
    assert by_id[4625786]["time"] == time(13, 30)
    assert by_id[4625790]["time"] == time(18, 30)


def test_a_slot_time_does_not_leak_into_the_next_day(league_fixtures):
    """Carrying the previous slot forward must stop at the next slot header,
    otherwise Sunday's matches inherit Saturday's evening kickoff."""
    by_id = {f["match_id"]: f for f in league_fixtures}
    assert by_id[4625788]["time"] == time(15, 0)  # 24/08, not 23/08's 18:30
    assert by_id[4625787]["time"] == time(17, 30)


def test_knockout_rounds_are_labelled_individually(cup_fixtures):
    """A cup box holds every round; the round name lives on a section header
    row, not in the box headline."""
    rounds = {f["matchday"] for f in cup_fixtures}
    assert "intermediate stage 1st leg" in rounds
    # The league phase has no per-round header ("Schedule" is generic), so it
    # falls back to the box headline.
    assert "Group GP" in rounds
    assert "Schedule" not in rounds


def test_scores_and_teams_survive(cup_fixtures):
    final = next(f for f in cup_fixtures if f["match_id"] == 4716779)
    assert final["home_name"] == "PSV Eindhoven"
    assert final["away_name"] == "Union Saint-Gilloise"
    assert (final["home_score"], final["away_score"]) == (1, 3)
