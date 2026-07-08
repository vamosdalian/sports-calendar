"""Discover the competition catalogue directly from Transfermarkt.

Two phases:

1. **Continents** — fetch the per-continent overview pages
   (``/wettbewerbe/{continent}``) to enumerate the countries (flag id + name).
2. **Countries** — for each country fetch
   ``/wettbewerbe/national/wettbewerbe/{country_id}`` which lists every
   competition (all league tiers + cups) grouped by a header row.

This replaces the hand-maintained seed list: the catalogue becomes whatever
Transfermarkt currently publishes, and can be re-synced at any time.
"""

from __future__ import annotations

import re

from selectolax.parser import HTMLParser

from app.models import CompetitionType
from app.scraper import parse_utils as pu
from app.scraper.client import fetcher

CONTINENTS = ["europa", "amerika", "asien", "afrika"]

# Overview pages whose sidebar holds international / cross-country competitions.
# Same per-continent pages as above, plus the FIFA page (``/wettbewerbe/fifa``)
# whose "International cups" box lists the globally-scoped national-team events
# (World Cup + its qualifiers, Confederations Cup, friendlies, ...). This is
# what replaces the old hand-maintained global seed list.
INTERNATIONAL_SOURCES = CONTINENTS + ["fifa"]

_FLAG_RE = re.compile(r"/flagge/\w+/(\d+)\.png")
_COMP_RE = re.compile(r"/(wettbewerb|pokalwettbewerb)/([A-Za-z0-9]+)")
# Groups we don't want in the catalogue (youth / reserve / amateur noise).
_SKIP_GROUP = re.compile(r"youth|reserve|u1[0-9]|u2[0-9]|junior", re.I)
_CUP_GROUP = re.compile(r"cup|super|play-?off", re.I)


# ── Phase 1: countries from a continent page ────────────────────────────────
async def scrape_countries(continent: str) -> list[dict]:
    tree = await fetcher.fetch(f"/wettbewerbe/{continent}")
    return parse_continent(tree, continent)


def parse_continent(tree: HTMLParser, continent: str) -> list[dict]:
    table = tree.css_first("table.items")
    countries: dict[int, dict] = {}
    if table is None:
        return []
    for row in table.css("tbody > tr"):
        if row.css_first("td.extrarow"):
            continue
        flag = row.css_first("img.flaggenrahmen")
        if flag is None:
            continue
        m = _FLAG_RE.search(flag.attributes.get("src", ""))
        if not m:
            continue
        cid = int(m.group(1))
        countries.setdefault(
            cid,
            {
                "country_id": cid,
                "country": (flag.attributes.get("title") or "").strip(),
                "continent": continent,
            },
        )
    return list(countries.values())


# ── International / national-team competitions of a confederation ────────────
async def scrape_international(continent: str) -> list[dict]:
    tree = await fetcher.fetch(f"/wettbewerbe/{continent}")
    return parse_international(tree, continent)


def parse_international(tree: HTMLParser, continent: str) -> list[dict]:
    """Parse the cross-country competition boxes in a confederation page sidebar.

    Two boxes matter, distinguished by their header:

    * **"Cups"** — continental *club* cups (Champions League, Europa League,
      Copa Libertadores, AFC Champions League, ...). Typed as ``cup``.
    * **"International cups"** — national-team competitions (Euro, Nations
      League, Copa América, AFCON, plus the World Cup & qualifiers on the FIFA
      page, and historical editions). Typed as ``international``.

    The country tables' own "... leagues & cups" box is ignored here — those
    leagues are picked up via the per-country crawl.
    """
    out: dict[str, dict] = {}
    for box in tree.css("div.box"):
        header = box.css_first("h2, .content-box-headline")
        if header is None:
            continue
        title = header.text(strip=True)
        if "International" in title:
            ctype = CompetitionType.international
        elif title == "Cups":
            ctype = CompetitionType.cup
        else:
            continue
        for a in box.css("a[href]"):
            m = _COMP_RE.search(a.attributes.get("href", ""))
            if not m:
                continue
            code = m.group(2)
            name = (a.attributes.get("title") or a.text(strip=True)).strip()
            if not name or code in out:
                continue
            out[code] = {
                "id": code,
                "name": name,
                "type": ctype,
                "country": None,
                "tier": f"{title} · {continent}",
            }
    return list(out.values())


# ── National teams of one country ────────────────────────────────────────────
_VEREIN_RE = re.compile(r"/verein/(\d+)")


async def scrape_country_national_teams(country_id: int) -> list[dict]:
    tree = await fetcher.fetch(f"/wettbewerbe/national/wettbewerbe/{country_id}")
    return parse_country_national_teams(tree, country_id)


def parse_country_national_teams(tree: HTMLParser, country_id: int) -> list[dict]:
    """National selections (A / B / U-teams / women) listed on a country page.

    They sit in the ``.relevante-wettbewerbe-auflistung`` box, distinct from the
    "clubs playing on the international stage" box.
    """
    out: dict[int, dict] = {}
    for box in tree.css(".relevante-wettbewerbe-auflistung"):
        for a in box.css("a[href*='/verein/']"):
            m = _VEREIN_RE.search(a.attributes.get("href", ""))
            name = (a.attributes.get("title") or a.text(strip=True)).strip()
            if not m or not name:
                continue
            tid = int(m.group(1))
            out.setdefault(
                tid,
                {
                    "team_id": tid,
                    "name": name,
                    "slug": pu.slug_from_href(a.attributes.get("href")),
                    "country_id": country_id,
                    "kind": "national",
                },
            )
    return list(out.values())


# ── Phase 2: competitions of one country ────────────────────────────────────
async def scrape_country_competitions(country_id: int, country: str) -> list[dict]:
    tree = await fetcher.fetch(f"/wettbewerbe/national/wettbewerbe/{country_id}")
    return parse_country(tree, country_id, country)


def parse_country(tree: HTMLParser, country_id: int, country: str) -> list[dict]:
    table = tree.css_first("table.items")
    if table is None:
        return []
    comps: dict[str, dict] = {}
    group = ""
    for row in table.css("tbody > tr"):
        header = row.css_first("td.extrarow")
        if header is not None:
            group = pu.text(header)
            continue
        if _SKIP_GROUP.search(group):
            continue
        # A row carries a logo anchor and a text anchor, both to the same comp.
        code = kind = None
        name = ""
        for a in row.css("a[href]"):
            m = _COMP_RE.search(a.attributes.get("href", ""))
            if not m:
                continue
            code = m.group(2)
            kind = m.group(1)
            name = name or (a.attributes.get("title") or a.text(strip=True)).strip()
        if not code or not name:
            continue
        if kind == "pokalwettbewerb" or _CUP_GROUP.search(group):
            ctype = CompetitionType.cup
        elif "tier" in group.lower():
            ctype = CompetitionType.league
        else:
            ctype = CompetitionType.other
        comps.setdefault(
            code,
            {
                "id": code,
                "name": name,
                "type": ctype,
                "country": country,
                "country_id": country_id,
                "tier": group or None,
            },
        )
    return list(comps.values())
