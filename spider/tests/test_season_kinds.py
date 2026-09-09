"""Guards the season-scoped crawl-kind list.

A kind missing from SEASON_KINDS is enqueued with season_id = NO_SEASON, its
handler is then called with season 0, and every season-filtered query inside it
returns nothing. Nothing raises: the task goes green with a message saying it
did no work. competition_stadiums shipped that way and reported
"20 个球场, 0 场比赛已定位" against a season holding 380 fixtures.
"""

import inspect

from app import crawler
from app.models import NO_SEASON, CrawlKind


def test_every_kind_has_a_handler():
    assert set(crawler._HANDLERS) == set(CrawlKind)


def test_season_scoped_kinds_are_declared():
    """A handler that filters on the season it is given must be listed, or it
    will silently run against season 0."""
    assert crawler.SEASON_KINDS == {
        CrawlKind.competition_clubs,
        CrawlKind.competition_fixtures,
        CrawlKind.competition_standings,
        CrawlKind.competition_stadiums,
        CrawlKind.team_fixtures,
        CrawlKind.team_squad,
    }


def test_router_uses_the_crawler_s_list():
    """The router must not keep its own copy: two lists drift, and the drift is
    invisible until a season-scoped crawl quietly does nothing."""
    from app.routers import crawl

    assert crawl._SEASON_KINDS is crawler.SEASON_KINDS


def test_season_free_kinds_ignore_their_season_argument():
    """The kinds left out of SEASON_KINDS get NO_SEASON, so their handlers must
    not filter on it."""
    for kind in set(CrawlKind) - crawler.SEASON_KINDS:
        handler = crawler._HANDLERS[kind]
        source = inspect.getsource(handler)
        assert "season_id=season" not in source, (
            f"{kind.value} is enqueued with NO_SEASON ({NO_SEASON}) but its "
            f"handler filters on the season argument"
        )
