"""Regression tests for how a fixture's kickoff is stored.

Transfermarkt prints only the date until a broadcaster picks a kickoff time.
Those fixtures are stored at local midnight, which downstream is impossible to
tell apart from a real midnight kickoff — and the calendar then announces a
match (and used to ring an alarm) at an hour the source never published. The
flag these tests guard is what keeps the two cases distinguishable.
"""

from datetime import date, datetime, time

from app.repository import resolve_kickoff


def test_published_time_is_kept_and_not_flagged():
    kickoff, tbd = resolve_kickoff({"date": date(2026, 8, 15), "time": time(17, 30)})
    assert kickoff == datetime(2026, 8, 15, 17, 30)
    assert tbd is False


def test_missing_time_falls_back_to_midnight_and_is_flagged():
    kickoff, tbd = resolve_kickoff({"date": date(2026, 9, 5), "time": None})
    assert kickoff == datetime(2026, 9, 5, 0, 0)
    assert tbd is True


def test_absent_time_key_is_treated_as_pending():
    kickoff, tbd = resolve_kickoff({"date": date(2026, 9, 5)})
    assert kickoff == datetime(2026, 9, 5, 0, 0)
    assert tbd is True


def test_a_genuine_midnight_kickoff_is_not_flagged():
    """Midnight alone must not imply "pending" — only a missing time does."""
    kickoff, tbd = resolve_kickoff({"date": date(2026, 9, 5), "time": time(0, 0)})
    assert kickoff == datetime(2026, 9, 5, 0, 0)
    assert tbd is False


def test_no_date_yields_no_kickoff():
    assert resolve_kickoff({"date": None, "time": time(20, 0)}) == (None, False)
