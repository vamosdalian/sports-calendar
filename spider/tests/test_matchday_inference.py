"""Tests for recovering round numbers from the fixture calendar.

The Champions League league phase lists all 144 fixtures under one heading with
no round markers. The rounds are recoverable because each is played over a
couple of evenings weeks apart from the next — but only when the schedule
really has that shape, so the guards matter as much as the split itself.
"""

from datetime import date

from app.scraper.transfermarkt import _split_undivided_matchdays


def fixture(day: date, label: str = "Group GP") -> dict:
    return {"date": day, "matchday": label}


def labels(fixtures: list[dict]) -> list[str]:
    return [f["matchday"] for f in fixtures]


def test_league_phase_rounds_are_numbered():
    """Four rounds of two matches, each round a fortnight after the last."""
    fixtures = [
        fixture(date(2025, 9, 16)), fixture(date(2025, 9, 17)),
        fixture(date(2025, 9, 30)), fixture(date(2025, 10, 1)),
        fixture(date(2025, 10, 21)), fixture(date(2025, 10, 22)),
        fixture(date(2025, 11, 4)), fixture(date(2025, 11, 5)),
    ]
    _split_undivided_matchdays(fixtures)
    assert labels(fixtures) == [
        "1.Matchday", "1.Matchday",
        "2.Matchday", "2.Matchday",
        "3.Matchday", "3.Matchday",
        "4.Matchday", "4.Matchday",
    ]


def test_consecutive_evenings_stay_one_round():
    """A round spread over Tue/Wed/Thu must not split into three."""
    fixtures = [
        fixture(date(2025, 9, 16)), fixture(date(2025, 9, 17)),
        fixture(date(2025, 9, 18)),
        fixture(date(2025, 9, 30)), fixture(date(2025, 10, 1)),
        fixture(date(2025, 10, 2)),
        fixture(date(2025, 10, 21)), fixture(date(2025, 10, 22)),
        fixture(date(2025, 10, 23)),
    ]
    _split_undivided_matchdays(fixtures)
    assert labels(fixtures) == ["1.Matchday"] * 3 + ["2.Matchday"] * 3 + ["3.Matchday"] * 3


def test_uneven_rounds_keep_the_original_label():
    """A postponed fixture makes the clusters unequal. Better to leave the
    site's own label than to number the rounds wrongly."""
    fixtures = [
        fixture(date(2025, 9, 16)), fixture(date(2025, 9, 17)),
        fixture(date(2025, 9, 30)),
        fixture(date(2025, 10, 21)), fixture(date(2025, 10, 22)),
    ]
    _split_undivided_matchdays(fixtures)
    assert labels(fixtures) == ["Group GP"] * 5


def test_a_league_that_already_labels_its_rounds_is_untouched():
    """Each round arrives pre-labelled and covers one weekend, so there is
    nothing to infer — and nothing may be renamed."""
    fixtures = [
        fixture(date(2025, 8, 22), "1.Matchday"),
        fixture(date(2025, 8, 23), "1.Matchday"),
        fixture(date(2025, 8, 24), "1.Matchday"),
        fixture(date(2025, 8, 30), "2.Matchday"),
        fixture(date(2025, 8, 31), "2.Matchday"),
        fixture(date(2025, 9, 1), "2.Matchday"),
    ]
    _split_undivided_matchdays(fixtures)
    assert labels(fixtures) == ["1.Matchday"] * 3 + ["2.Matchday"] * 3


def test_too_few_rounds_are_not_inferred():
    """Two clusters is as easily a cup's two legs as a league phase."""
    fixtures = [
        fixture(date(2026, 2, 17), "Knockout stage"),
        fixture(date(2026, 2, 18), "Knockout stage"),
        fixture(date(2026, 2, 24), "Knockout stage"),
        fixture(date(2026, 2, 25), "Knockout stage"),
    ]
    _split_undivided_matchdays(fixtures)
    assert labels(fixtures) == ["Knockout stage"] * 4


def test_a_missing_date_disables_inference_entirely():
    """Without every date the clustering is guesswork, so nothing is relabelled
    rather than some rounds being numbered off-by-one."""
    fixtures = [
        fixture(date(2025, 9, 16)), fixture(date(2025, 9, 17)),
        {"date": None, "matchday": "Group GP"},
        fixture(date(2025, 9, 30)), fixture(date(2025, 10, 1)),
        fixture(date(2025, 10, 21)), fixture(date(2025, 10, 22)),
    ]
    _split_undivided_matchdays(fixtures)
    assert labels(fixtures) == ["Group GP"] * 7
