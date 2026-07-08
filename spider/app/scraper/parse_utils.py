"""Small helpers shared by the Transfermarkt HTML parsers."""

from __future__ import annotations

import re
from datetime import date, datetime, time

_VEREIN_RE = re.compile(r"/verein/(\d+)")
_SPIELER_RE = re.compile(r"/spieler/(\d+)")
_WETTBEWERB_RE = re.compile(r"/wettbewerb/([A-Za-z0-9]+)")
_SPIELBERICHT_RE = re.compile(r"/(?:spielbericht|index/spielbericht)/(\d+)")


def text(node) -> str:
    if node is None:
        return ""
    return re.sub(r"\s+", " ", node.text(strip=True)).strip()


def first_int(value: str) -> int | None:
    m = re.search(r"\d+", value or "")
    return int(m.group()) if m else None


def club_id_from_href(href: str | None) -> int | None:
    if not href:
        return None
    m = _VEREIN_RE.search(href)
    return int(m.group(1)) if m else None


def player_id_from_href(href: str | None) -> int | None:
    if not href:
        return None
    m = _SPIELER_RE.search(href)
    return int(m.group(1)) if m else None


def competition_code_from_href(href: str | None) -> str | None:
    if not href:
        return None
    m = _WETTBEWERB_RE.search(href)
    return m.group(1) if m else None


def match_id_from_href(href: str | None) -> int | None:
    if not href:
        return None
    m = _SPIELBERICHT_RE.search(href)
    return int(m.group(1)) if m else None


def slugify(name: str | None) -> str:
    if not name:
        return "x"
    s = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return s or "x"


def slug_from_href(href: str | None) -> str | None:
    if not href:
        return None
    parts = [p for p in href.split("/") if p]
    return parts[0] if parts else None


def parse_market_value(raw: str | None) -> int | None:
    """'€100.00m' -> 100_000_000, '€900k' -> 900_000, '-' -> None."""
    if not raw:
        return None
    s = raw.replace("\xa0", " ").strip().lower()
    s = s.replace("€", "").replace("£", "").replace("$", "").strip()
    if not s or s in {"-", "?"}:
        return None
    mult = 1
    if s.endswith("m"):
        mult = 1_000_000
        s = s[:-1]
    elif s.endswith("k") or s.endswith("th."):
        mult = 1_000
        s = s.rstrip("kth. ")
    elif s.endswith("bn"):
        mult = 1_000_000_000
        s = s[:-2]
    try:
        return int(float(s.replace(",", "")) * mult)
    except ValueError:
        return None


def parse_height(raw: str | None) -> int | None:
    """'1,85 m' or '1.85 m' -> 185 (cm)."""
    if not raw:
        return None
    m = re.search(r"(\d)[.,](\d{2})", raw)
    if m:
        return int(m.group(1)) * 100 + int(m.group(2))
    return None


_DATUM_RE = re.compile(r"datum/(\d{4}-\d{2}-\d{2})")
_DATE_FORMATS = (
    "%b %d, %Y", "%B %d, %Y", "%d/%m/%Y", "%Y-%m-%d", "%m/%d/%Y", "%d/%m/%y"
)


def date_from_datum_href(href: str | None) -> date | None:
    """Transfermarkt schedule links carry the date as '.../datum/2024-05-11'."""
    if not href:
        return None
    m = _DATUM_RE.search(href)
    if m:
        try:
            return datetime.strptime(m.group(1), "%Y-%m-%d").date()
        except ValueError:
            return None
    return None


# No word boundaries: mobile cells glue date+time ("...20269:00 PM"). Two
# digits after the colon still keep us from matching a score like "1:2".
_TIME_RE = re.compile(r"(\d{1,2}):(\d{2})\s*([AaPp][Mm])?")


def parse_time(text: str | None) -> time | None:
    """Parse a kickoff time like '8:00 PM', '12:00 AM', '20:00'.

    Handles mobile cells where the date is glued to the time
    ('Thu11/06/20269:00 PM'): a greedy 2-digit hour like '69' is corrected to
    its last digit ('9'). Two digits after the colon avoid matching a score.
    """
    if not text:
        return None
    for m in _TIME_RE.finditer(text):
        hh, minute = m.group(1), int(m.group(2))
        ampm = (m.group(3) or "").lower()
        hour = int(hh)
        if hour > 23 and len(hh) == 2:  # date digit glued onto the hour
            hour = int(hh[1])
        if ampm == "am":
            hour = 0 if hour == 12 else hour
        elif ampm == "pm":
            hour = hour if hour == 12 else hour + 12
        if 0 <= hour <= 23 and 0 <= minute <= 59:
            return time(hour, minute)
    return None


_TEXT_DATE_RE = re.compile(r"(\d{1,2})/(\d{1,2})/(\d{2,4})")


def date_from_text(text: str | None) -> date | None:
    """Pull a dd/mm/yyyy(or yy) date out of a free-text cell.

    Cup fixture rows show the date as plain text (e.g. 'Fri 13/03/2026 8:00 AM'
    or '19/01/2026') rather than as a '.../datum/...' link.
    """
    if not text:
        return None
    m = _TEXT_DATE_RE.search(text)
    if not m:
        return None
    day, month, year = (int(g) for g in m.groups())
    if year < 100:
        year += 2000
    try:
        return date(year, month, day)
    except ValueError:
        return None


def parse_date(raw: str | None) -> date | None:
    if not raw:
        return None
    s = re.sub(r"\s*\(\d+\)\s*$", "", raw.strip())  # drop trailing "(age)"
    s = s.strip()
    for fmt in _DATE_FORMATS:
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    return None
