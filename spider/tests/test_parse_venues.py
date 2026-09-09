"""Regression tests for the venue parsers.

The failure these guard against is silent: a venue that fails to parse does
not raise, it just leaves the match without a location, and the calendar entry
loses its LOCATION line without anything showing up in the logs.

Samples are trimmed live pages (2026-09-09, English locale).
"""

from pathlib import Path

import pytest
from selectolax.parser import HTMLParser

from app.scraper import transfermarkt as tm

SAMPLES = Path(__file__).parent / "samples"


def load(name: str) -> HTMLParser:
    return HTMLParser((SAMPLES / f"{name}.html").read_text(encoding="utf-8"))


def test_stadium_overview_yields_every_club_in_the_league():
    data = tm.parse_competition_stadiums(load("stadiums_gb1"), "GB1", 2025)
    venues = data["venues"]
    assert len(venues) == 20, "the Premier League fields 20 clubs"
    assert all(v["venue_id"] and v["name"] for v in venues)
    # City is read from the cell *after* the stadium link. The crest sits in a
    # nested inline-table, so a naive index walk lands on an empty cell and
    # every city comes back None -- which is exactly what happened first time.
    assert all(v["city"] for v in venues)


def test_stadium_overview_reads_name_city_and_capacity():
    data = tm.parse_competition_stadiums(load("stadiums_gb1"), "GB1", 2025)
    anfield = next(v for v in data["venues"] if v["venue_id"] == 31)
    assert anfield["name"] == "Anfield"
    assert anfield["city"] == "Liverpool"
    assert anfield["capacity"] == 61276  # "61.276" on the page


def test_match_report_gives_the_home_ground():
    detail = tm.parse_match_detail(load("match_finished"), 4625774)
    assert detail == {
        "match_id": 4625774,
        "venue_id": 31,
        "venue_name": "Anfield",
    }


def test_venue_is_available_before_kick_off():
    """An unplayed match still names its ground (only referee/attendance are
    'tbc'), so a subscriber gets the location up front rather than after the
    final whistle."""
    detail = tm.parse_match_detail(load("match_upcoming"), 4899287)
    assert detail["venue_id"] == 989  # Bournemouth's ground, the home side
    assert detail["venue_name"] == "Vitality Stadium"


def test_neutral_venue_is_not_either_side_s_ground():
    """The whole reason per-match crawling exists: this final was played at
    Puskás Aréna, which belongs to neither Paris Saint-Germain nor Arsenal, so
    the home-ground guess would have put it in the wrong country."""
    detail = tm.parse_match_detail(load("match_neutral"), 4814382)
    assert detail["venue_name"] == "Puskás Aréna"
    assert detail["venue_id"] == 3468
    assert detail["venue_id"] not in (583, 11)  # PSG, Arsenal


def test_missing_venue_block_is_not_an_error():
    """A page without the info paragraph must yield an empty venue rather than
    raising -- the match then simply stays unlocated."""
    detail = tm.parse_match_detail(HTMLParser("<html><body></body></html>"), 42)
    assert detail == {"match_id": 42, "venue_id": None, "venue_name": None}


@pytest.mark.parametrize(
    "href,expected",
    [
        ("/manchester-united/stadion/verein/985", 985),   # overview page shape
        ("/stadion/stadion/verein/31/saison_id/2025", 31),  # match report shape
        ("/fc-liverpool/startseite/verein/31", None),     # a club, not a ground
        (None, None),
    ],
)
def test_venue_id_only_matches_stadium_links(href, expected):
    from app.scraper import parse_utils as pu

    assert pu.venue_id_from_href(href) == expected
