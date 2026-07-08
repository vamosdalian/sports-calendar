"""Transfermarkt ``/quickselect`` JSON API (the homepage cascading selector).

Cheap, structured enumeration used to *expand* the selection tree:

    countries()                 -> all countries           [{id, name, link}]
    competitions(country_id)    -> that country's comps     [{id, name, link}]
    teams(competition_id)       -> current-season teams     [{id, name, link}]
    players(team_id)            -> current squad            [{id, name, shirtNumber, positionId, link}]

These reflect the *current* season only (no saison_id). Historical data still
comes from the HTML pages in ``transfermarkt.py``.
"""

from __future__ import annotations

from app.scraper.client import fetcher


async def _get(kind: str, parent: str | int | None = None) -> list[dict]:
    path = f"/quickselect/{kind}" if parent is None else f"/quickselect/{kind}/{parent}"
    data = await fetcher.fetch_json(path)
    return data if isinstance(data, list) else []


async def countries() -> list[dict]:
    return await _get("countries")


async def competitions(country_id: int | str) -> list[dict]:
    return await _get("competitions", country_id)


async def teams(competition_id: str) -> list[dict]:
    return await _get("teams", competition_id)


async def players(team_id: int | str) -> list[dict]:
    return await _get("players", team_id)
