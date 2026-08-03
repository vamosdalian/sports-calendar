"""Tests for turning a discovered competition into a catalogue row.

Continental competitions reach the catalogue only through this path, and it was
silently dead: the scraper's dict carries a ``country`` key the model has no
column for, so every run failed on AttributeError and the catalogue held zero
international competitions.
"""

from pathlib import Path

import pytest
from selectolax.parser import HTMLParser
from sqlalchemy import inspect

from app.crawler import discovered_competition_row
from app.models import Competition, CompetitionType, TeamKind
from app.scraper.discovery import parse_international

SAMPLES = Path(__file__).parents[1] / "scripts" / "samples"


@pytest.fixture(scope="module")
def europe_competitions() -> list[dict]:
    tree = HTMLParser((SAMPLES / "dir_europa.html").read_text(encoding="utf-8"))
    return parse_international(tree, "europa")


def test_the_champions_league_is_discovered(europe_competitions):
    by_id = {c["id"]: c for c in europe_competitions}
    assert "CL" in by_id, "the Champions League must be found on the Europe page"
    assert by_id["CL"]["type"] == CompetitionType.cup


def test_rows_only_use_columns_the_model_has(europe_competitions):
    """The original failure: a key with no column reaches the insert."""
    columns = {c.key for c in inspect(Competition).columns}
    for comp in europe_competitions:
        row = discovered_competition_row(comp)
        assert set(row) <= columns, f"{comp['id']} carries unknown columns"


def test_continental_club_cups_are_club_competitions(europe_competitions):
    """The Champions League is played by clubs. Typing it as a national-team
    competition would send the crawler down the wrong edges."""
    champions_league = next(c for c in europe_competitions if c["id"] == "CL")
    assert discovered_competition_row(champions_league)["kind_of_teams"] is TeamKind.club


def test_national_team_competitions_stay_national():
    row = discovered_competition_row({
        "id": "EM",
        "name": "UEFA Euro",
        "type": CompetitionType.international,
        "country": None,
        "tier": "International cups · europa",
    })
    assert row["kind_of_teams"] is TeamKind.national


def test_the_crawler_reaches_a_cup_through_the_cup_url():
    """A cup typed as `cup` gets the /pokalwettbewerb/ path. With no catalogue
    row at all the crawler falls back to the league path, which redirects to the
    competition's front page and parses to zero fixtures."""
    from app import models
    from app.crawler import _segment

    competition = models.Competition(id="CL", name="UEFA Champions League",
                                     type=CompetitionType.cup)
    assert _segment(competition) == "pokalwettbewerb"
    assert _segment(None) == "wettbewerb"
