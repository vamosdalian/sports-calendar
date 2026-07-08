"""High-level Transfermarkt page scrapers.

Each function fetches one page (via the rate-limited ``fetcher``) and returns
plain dicts so persistence stays decoupled from parsing. Selectors target the
current Transfermarkt markup; they are written defensively but may still need
tuning if the site's HTML changes.

URL patterns used (English locale, www.transfermarkt.com):
  competition squad table : /x/startseite/wettbewerb/{CODE}/plus/?saison_id={Y}
  club squad (detailed)   : /x/kader/verein/{ID}/saison_id/{Y}/plus/1
  full fixture list       : /x/gesamtspielplan/wettbewerb/{CODE}/saison_id/{Y}
"""

from __future__ import annotations

import re

from selectolax.parser import HTMLParser

from app.scraper import parse_utils as pu
from app.scraper.client import fetcher

_COMP_RE = re.compile(r"/(wettbewerb|pokalwettbewerb)/([A-Za-z0-9]+)")
_POS_SUFFIX_RE = re.compile(r"\(\d+\.\)\s*$")  # trailing "(3.)" league position


# ── Real season list from a competition's saison_id dropdown ────────────────
async def scrape_competition_seasons(
    code: str, slug: str = "x", segment: str = "wettbewerb"
) -> list[dict]:
    # Leagues expose the saison_id dropdown on their startseite; cups expose it
    # on the fixtures (gesamtspielplan) page instead.
    page = "gesamtspielplan" if segment == "pokalwettbewerb" else "startseite"
    tree = await fetcher.fetch(f"/{slug}/{page}/{segment}/{code}")
    return parse_seasons(tree)


def parse_seasons(tree: HTMLParser) -> list[dict]:
    """Parse the ``select[name=saison_id]`` options into [{id, label}].

    The option *value* is the real ``saison_id`` Transfermarkt expects in deep
    URLs; the *label* is what the site displays (e.g. "2024" or "19/20").
    """
    select = tree.css_first("select[name='saison_id']")
    if select is None:
        return []
    seasons: list[dict] = []
    seen: set[int] = set()
    for opt in select.css("option"):
        raw = (opt.attributes.get("value") or "").strip()
        if not raw.isdigit():
            continue
        sid = int(raw)
        if sid in seen:
            continue
        seen.add(sid)
        seasons.append({"id": sid, "label": pu.text(opt) or str(sid)})
    return seasons


# ── Clubs taking part in a competition for a season ─────────────────────────
async def scrape_competition_clubs(
    code: str, season: int, slug: str = "x", segment: str = "wettbewerb"
) -> dict:
    # Leagues use ".../wettbewerb/CODE"; cups use ".../pokalwettbewerb/CODE".
    path = f"/{slug}/startseite/{segment}/{code}/plus/"
    tree = await fetcher.fetch(path, params={"saison_id": season})
    return parse_competition_clubs(tree, code, season)


def parse_competition_clubs(tree: HTMLParser, code: str, season: int) -> dict:
    comp_name = pu.text(tree.css_first("h1.data-header__headline-wrapper, h1"))
    clubs: list[dict] = []
    table = tree.css_first("table.items")
    rows = table.css("tbody > tr") if table else []
    for row in rows:
        link = row.css_first("td.hauptlink a[href*='/verein/']") or row.css_first(
            "a[href*='/verein/']"
        )
        if link is None:
            continue
        href = link.attributes.get("href")
        club_id = pu.club_id_from_href(href)
        if not club_id:
            continue
        # Centered numeric columns after the (empty) logo cell:
        # [squad size, avg age, foreigners]. Drop empty cells so the leading
        # logo column doesn't shift the indices.
        zentriert = [pu.text(c) for c in row.css("td.zentriert") if pu.text(c)]
        market_cells = [
            pu.parse_market_value(pu.text(c)) for c in row.css("td.rechts")
        ]
        clubs.append(
            {
                "club_id": club_id,
                "name": pu.text(link) or (link.attributes.get("title") or "").strip(),
                "slug": pu.slug_from_href(href),
                "squad_size": pu.first_int(zentriert[0]) if zentriert else None,
                # last "rechts" column is the total market value
                "market_value": next(
                    (m for m in reversed(market_cells) if m), None
                ),
                "extra": {
                    "avg_age": zentriert[1] if len(zentriert) > 1 else None,
                    "foreigners": zentriert[2] if len(zentriert) > 2 else None,
                },
            }
        )
    # de-dup (the table sometimes repeats a club logo row)
    seen: dict[int, dict] = {}
    for c in clubs:
        seen.setdefault(c["club_id"], c)
    return {
        "competition_id": code,
        "competition_name": comp_name,
        "season_id": season,
        "clubs": list(seen.values()),
    }


# ── Squad of one club for a season ──────────────────────────────────────────
async def scrape_club_squad(
    club_id: int, season: int, slug: str = "x"
) -> dict:
    path = f"/{slug}/kader/verein/{club_id}/saison_id/{season}/plus/1"
    tree = await fetcher.fetch(path)
    return parse_club_squad(tree, club_id, season)


def parse_club_squad(tree: HTMLParser, club_id: int, season: int) -> dict:
    club_name = pu.text(tree.css_first("h1.data-header__headline-wrapper, h1"))
    players: list[dict] = []
    table = tree.css_first("table.items")
    rows = table.css("tbody > tr") if table else []
    for row in rows:
        link = row.css_first("td.hauptlink a[href*='/spieler/']") or row.css_first(
            "a[href*='/spieler/']"
        )
        if link is None:
            continue
        href = link.attributes.get("href")
        player_id = pu.player_id_from_href(href)
        if not player_id:
            continue
        shirt = pu.text(row.css_first("div.rn_nummer"))
        pos = pu.text(
            row.css_first("td.posrela tr:nth-child(2) td")
        ) or pu.text(row.css_first("table.inline-table tr:last-child td"))
        nat_img = row.css_first("img.flaggenrahmen")
        nationality = (nat_img.attributes.get("title") if nat_img else None)
        mv = pu.parse_market_value(pu.text(row.css_first("td.rechts.hauptlink")))
        # date of birth / age cell is the centered cell with a date
        dob = None
        for c in row.css("td.zentriert"):
            d = pu.parse_date(pu.text(c))
            if d:
                dob = d
                break
        players.append(
            {
                "player_id": player_id,
                "name": pu.text(link) or (link.attributes.get("title") or "").strip(),
                "slug": pu.slug_from_href(href),
                "position": pos or None,
                "shirt_number": shirt or None,
                "nationality": nationality,
                "date_of_birth": dob,
                "market_value": mv,
            }
        )
    seen: dict[int, dict] = {}
    for p in players:
        seen.setdefault(p["player_id"], p)
    return {
        "club_id": club_id,
        "club_name": club_name,
        "season_id": season,
        "players": list(seen.values()),
    }


# ── Full fixture list of a competition for a season ─────────────────────────
async def scrape_fixtures(
    code: str, season: int, slug: str = "x", segment: str = "wettbewerb"
) -> dict:
    path = f"/{slug}/gesamtspielplan/{segment}/{code}/saison_id/{season}"
    tree = await fetcher.fetch(path)
    return parse_fixtures(tree, code, season)


def parse_fixtures(tree: HTMLParser, code: str, season: int) -> dict:
    fixtures: list[dict] = []
    for box in tree.css("div.box"):
        header = box.css_first("h2, .content-box-headline")
        matchday = pu.text(header) or None
        # Some competitions (e.g. World Cup) keep the kickoff time only in the
        # mobile "show-for-small" date+time cell, in rows separate from the
        # desktop team row. Collect those times per date (FIFO) so a match row
        # lacking its own time can borrow one.
        sfs_times: dict = {}
        for cell in box.css("td.show-for-small"):
            txt = pu.text(cell)
            ct = pu.parse_time(txt)
            cd = pu.date_from_text(txt) or pu.date_from_datum_href(
                cell.css_first("a[href*='datum/']").attributes.get("href")
                if cell.css_first("a[href*='datum/']") else None
            )
            if ct and cd:
                sfs_times.setdefault(cd, []).append(ct)
        # Iterate every row in the box (cups put standings, match lists and
        # stats tables side by side). Non-match rows are filtered out below.
        last_date = None
        for row in box.css("tr"):
            club_links = row.css("a[href*='/verein/']")
            if len(club_links) < 2:
                # Possibly a date-header row (knockout rounds) -> carry its date.
                datum = row.css_first("a[href*='datum/']")
                dd = pu.date_from_datum_href(
                    datum.attributes.get("href") if datum else None
                )
                if dd:
                    last_date = dd
                continue
            # A match row carries 4 club links: home name, home crest,
            # away crest, away name. Home is the first, away the last.
            home, away = club_links[0], club_links[-1]
            home_id = pu.club_id_from_href(home.attributes.get("href"))
            away_id = pu.club_id_from_href(away.attributes.get("href"))
            # Skip standings / record-winner / placeholder rows: a real match
            # has two *different* clubs.
            if not home_id or not away_id or home_id == away_id:
                continue
            result_link = row.css_first("a[href*='spielbericht/']")
            result_txt = pu.text(result_link)
            home_score = away_score = None
            if ":" in result_txt:
                parts = result_txt.split(":")
                home_score = pu.first_int(parts[0])
                away_score = pu.first_int(parts[1])
            # Date: leagues use a ".../datum/YYYY-MM-DD" link; cups put it as
            # plain text in the (first) date cell. Fall back to carried date.
            datum = row.css_first("a[href*='datum/']")
            d = pu.date_from_datum_href(
                datum.attributes.get("href") if datum else None
            )
            if d is None:
                date_cell = row.css_first("td.hide-for-small")
                d = pu.date_from_text(pu.text(date_cell)) if date_cell else None
            if d:
                last_date = d
            # Kickoff time lives in its own cell (e.g. '8:00 PM'); not always
            # present. Two digits after the colon avoid matching the score.
            t = None
            for cell in row.css("td"):
                if cell.css_first("a[href*='spielbericht/']"):
                    continue
                t = pu.parse_time(pu.text(cell))
                if t:
                    break
            # Fallback: borrow the mobile (show-for-small) time for this date.
            fx_date = d or last_date
            if t is None and fx_date in sfs_times and sfs_times[fx_date]:
                t = sfs_times[fx_date].pop(0)
            fixtures.append(
                {
                    "match_id": pu.match_id_from_href(
                        result_link.attributes.get("href") if result_link else None
                    ),
                    "matchday": matchday,
                    "date": d or last_date,
                    "time": t,
                    "home_team_id": home_id,
                    "away_team_id": away_id,
                    "home_name": home.attributes.get("title") or pu.text(home),
                    "away_name": away.attributes.get("title") or pu.text(away),
                    "home_score": home_score,
                    "away_score": away_score,
                }
            )
    # de-dup by match_id when available
    out: list[dict] = []
    seen_ids: set[int] = set()
    for f in fixtures:
        mid = f.get("match_id")
        if mid is not None:
            if mid in seen_ids:
                continue
            seen_ids.add(mid)
        out.append(f)
    return {"competition_id": code, "season_id": season, "fixtures": out}


# ── A team's own fixtures across all competitions (for a season) ─────────────
# This is the core of competition discovery: a team's schedule page groups its
# matches by competition, so it reveals every competition the team plays in
# (domestic league + cups + continental/international), each as a box header.
async def scrape_team_fixtures(team_id: int, season: int, slug: str = "x") -> dict:
    # Full schedule (the /plus/1 variant is only a compact summary).
    path = f"/{slug}/spielplan/verein/{team_id}/saison_id/{season}"
    tree = await fetcher.fetch(path)
    return parse_team_fixtures(tree, team_id, season)


def parse_team_fixtures(tree: HTMLParser, team_id: int, season: int) -> dict:
    fixtures: list[dict] = []
    comp_names: dict[str, str] = {}
    for box in tree.css("div.box"):
        # The competition this box belongs to (header link).
        code = None
        for a in box.css("a[href]"):
            m = _COMP_RE.search(a.attributes.get("href", ""))
            if m:
                code = m.group(2)
                break
        if not code:
            continue
        header = box.css_first("h2, .content-box-headline")
        if header is not None and code not in comp_names:
            comp_names[code] = pu.text(header)
        for row in box.css("tr"):
            tds = row.css("td")
            if len(tds) < 5:
                continue
            # A match row has an explicit venue cell ("H"/"A"); standings and
            # record rows do not -> this filters them out.
            venue = None
            for c in tds:
                if pu.text(c) in ("H", "A"):
                    venue = pu.text(c)
                    break
            if venue is None:
                continue
            # Row has two verein links (crest + name); the name link is last.
            opp_links = row.css("a[href*='/verein/']")
            if not opp_links:
                continue
            opp_link = opp_links[-1]
            opp_id = pu.club_id_from_href(opp_link.attributes.get("href"))
            if not opp_id or opp_id == team_id:
                continue
            opp_name = _POS_SUFFIX_RE.sub(
                "", (opp_link.attributes.get("title") or pu.text(opp_link))
            ).strip()
            # date / time anywhere in the row
            d = t = None
            for c in tds:
                d = d or pu.date_from_text(pu.text(c))
            for c in tds:
                t = t or pu.parse_time(pu.text(c))
            result_link = row.css_first("a[href*='spielbericht/']")
            home_score = away_score = None
            rtxt = pu.text(result_link)
            if ":" in rtxt:
                parts = rtxt.split(":")
                home_score = pu.first_int(parts[0])
                away_score = pu.first_int(parts[1])
            # Result is shown home:away; assign sides from the venue indicator.
            if venue == "H":
                home_id, away_id = team_id, opp_id
                home_name, away_name = None, opp_name
            else:
                home_id, away_id = opp_id, team_id
                home_name, away_name = opp_name, None
            fixtures.append(
                {
                    "match_id": pu.match_id_from_href(
                        result_link.attributes.get("href") if result_link else None
                    ),
                    "competition_id": code,
                    "matchday": pu.text(tds[0]) or None,
                    "date": d,
                    "time": t,
                    "home_team_id": home_id,
                    "away_team_id": away_id,
                    "home_name": home_name,
                    "away_name": away_name,
                    "home_score": home_score,
                    "away_score": away_score,
                }
            )
    out: list[dict] = []
    seen_ids: set[int] = set()
    for f in fixtures:
        mid = f.get("match_id")
        if mid is not None:
            if mid in seen_ids:
                continue
            seen_ids.add(mid)
        out.append(f)
    competition_ids = sorted({f["competition_id"] for f in out})
    return {
        "team_id": team_id,
        "season_id": season,
        "fixtures": out,
        "competition_ids": competition_ids,
        "competitions": [
            {"id": c, "name": comp_names.get(c) or c} for c in competition_ids
        ],
    }


# ── League / group standings table ──────────────────────────────────────────
async def scrape_standings(
    code: str, season: int, slug: str = "x", segment: str = "wettbewerb"
) -> dict:
    path = f"/{slug}/tabelle/{segment}/{code}/saison_id/{season}"
    tree = await fetcher.fetch(path)
    return parse_standings(tree, code, season)


def parse_standings(tree: HTMLParser, code: str, season: int) -> dict:
    rows_out: list[dict] = []
    table = tree.css_first("table.items")
    rows = table.css("tbody > tr") if table else []
    for row in rows:
        tds = row.css("td")
        if len(tds) < 10:
            continue
        link = row.css_first("a[href*='/verein/']")
        team_id = pu.club_id_from_href(
            link.attributes.get("href") if link else None
        )
        if not team_id:
            continue
        goals = pu.text(tds[7])
        gf = ga = None
        if ":" in goals:
            gp = goals.split(":")
            gf, ga = pu.first_int(gp[0]), pu.first_int(gp[1])
        rows_out.append(
            {
                "team_id": team_id,
                "name": (link.attributes.get("title") or pu.text(link)),
                "rank": pu.first_int(pu.text(tds[0])),
                "played": pu.first_int(pu.text(tds[3])),
                "win": pu.first_int(pu.text(tds[4])),
                "draw": pu.first_int(pu.text(tds[5])),
                "loss": pu.first_int(pu.text(tds[6])),
                "goals_for": gf,
                "goals_against": ga,
                "goal_diff": (gf - ga) if gf is not None and ga is not None else None,
                "points": pu.first_int(pu.text(tds[9])),
                "group": "",
            }
        )
    return {"competition_id": code, "season_id": season, "standings": rows_out}


# ── Player profile (bio details) ────────────────────────────────────────────
async def scrape_player_profile(player_id: int, slug: str = "x") -> dict:
    tree = await fetcher.fetch(f"/{slug}/profil/spieler/{player_id}")
    return parse_player_profile(tree, player_id)


def parse_player_profile(tree: HTMLParser, player_id: int) -> dict:
    # Pair the info-table label (regular) with its value (bold).
    info: dict[str, str] = {}
    spans = tree.css("span.info-table__content")
    i = 0
    while i < len(spans) - 1:
        cls = spans[i].attributes.get("class", "") or ""
        if "regular" in cls:
            label = pu.text(spans[i]).rstrip(":").strip()
            val_span = spans[i + 1]
            if label == "Citizenship":
                flags = [
                    im.attributes.get("title")
                    for im in val_span.css("img")
                    if im.attributes.get("title")
                ]
                info[label] = ", ".join(flags) if flags else pu.text(val_span)
            else:
                info[label] = pu.text(val_span)
            i += 2
        else:
            i += 1
    # The h1 concatenates the shirt number; take the clean name from <title>.
    title = pu.text(tree.css_first("title"))
    name = title.split(" - ")[0].strip() if title else ""
    mv = pu.parse_market_value(
        pu.text(tree.css_first(".data-header__market-value-wrapper"))
    )
    return {
        "player_id": player_id,
        "name": name or str(player_id),
        "position": info.get("Position") or None,
        "date_of_birth": pu.parse_date(info.get("Date of birth/Age")),
        "nationality": info.get("Citizenship") or None,
        "height_cm": pu.parse_height(info.get("Height")),
        "foot": info.get("Foot") or None,
        "market_value": mv,
        "extra": {k: v for k, v in info.items() if v},
    }
