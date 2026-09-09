#!/usr/bin/env python3
"""Probe / drive outbound access to WAF-guarded upstreams through a proxy.

Written for sports-calendar's spider, whose only upstream (Transfermarkt) sits
behind AWS WAF. WAF's verdict is driven almost entirely by the *reputation of
the source IP*: a datacenter egress (AWS, Aliyun, GCP...) is challenged on
every request, a residential egress is let straight through. So "can I scrape"
reduces to "what is my egress IP, and is it residential" -- which is exactly
what this script answers, separately from "is the proxy even reachable".

Run everything through the spider venv so the `spider` subcommand can import
the project's own fetcher/parsers:

    ./venv/bin/python .claude/skills/proxy-fetch/proxy_probe.py doctor

Proxy resolution order: --proxy > $SCRAPER_PROXY > SCRAPER_PROXY in spider/.env
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

SKILL_DIR = Path(__file__).resolve().parent
SPIDER_DIR = SKILL_DIR.parents[2]  # .../spider/.claude/skills/proxy-fetch -> spider

# Kept in sync with app/scraper/client.py -- a WAF challenge is NOT an HTTP
# error, it is a 200-or-405 page full of these markers.
WAF_MARKERS = ("awsWafCookieDomainList", "Human Verification", "gokuProps")
BLOCK_STATUS = {403, 405, 429, 503}

# Substrings in ipinfo's "org" that mean "datacenter" -> WAF will challenge.
# Heuristic, not authoritative: it only has to be right about the hosts we use.
DATACENTER_HINTS = (
    "amazon", "aws", "google", "microsoft", "azure", "alibaba", "aliyun",
    "tencent", "digitalocean", "linode", "vultr", "ovh", "hetzner", "oracle",
    "cloudflare", "contabo", "leaseweb", "choopa", "m247",
)

DEFAULT_TM_URL = (
    "https://www.transfermarkt.com/premier-league/gesamtspielplan"
    "/wettbewerb/GB1?saison_id=2025"
)
UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)
HEADERS = {
    "User-Agent": UA,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

OK, BAD, WARN = "PASS", "FAIL", "WARN"


def redact(proxy: str) -> str:
    """Never print credentials -- output of this script ends up in transcripts."""
    if not proxy:
        return "(none)"
    parts = urlsplit(proxy)
    if parts.username or parts.password:
        host = parts.hostname or ""
        if parts.port:
            host = f"{host}:{parts.port}"
        return urlunsplit((parts.scheme, f"***:***@{host}", parts.path, "", ""))
    return proxy


def read_env_proxy() -> str:
    """Pull SCRAPER_PROXY out of spider/.env without importing pydantic."""
    env_file = SPIDER_DIR / ".env"
    if not env_file.exists():
        return ""
    for line in env_file.read_text().splitlines():
        line = line.strip()
        if line.startswith("SCRAPER_PROXY=") and not line.startswith("#"):
            return line.split("=", 1)[1].strip().strip("'\"")
    return ""


def resolve_proxy(cli_proxy: str | None) -> tuple[str, str]:
    if cli_proxy:
        return cli_proxy, "--proxy"
    if os.environ.get("SCRAPER_PROXY"):
        return os.environ["SCRAPER_PROXY"], "$SCRAPER_PROXY"
    from_env = read_env_proxy()
    if from_env:
        return from_env, "spider/.env"
    return "", "(unset)"


def looks_blocked(status: int, headers, body: str) -> bool:
    if status in BLOCK_STATUS or headers.get("x-amzn-waf-action"):
        return True
    return any(m in body[:4000] for m in WAF_MARKERS)


def say(state: str, msg: str) -> None:
    print(f"[{state:4}] {msg}")


# ── egress identity ─────────────────────────────────────────────────────────
def egress(proxy: str | None) -> dict:
    """Who does the outside world think we are? Empty dict = could not reach."""
    import httpx

    try:
        with httpx.Client(proxy=proxy or None, timeout=30, headers=HEADERS) as c:
            return c.get("https://ipinfo.io/json").json()
    except Exception as exc:  # noqa: BLE001
        return {"error": f"{type(exc).__name__}: {exc}"}


def classify(info: dict) -> tuple[str, str]:
    """-> (verdict, one-line reason). Datacenter egress == WAF will challenge."""
    org = (info.get("org") or "").lower()
    hit = next((h for h in DATACENTER_HINTS if h in org), None)
    where = f"{info.get('city', '?')}, {info.get('country', '??')}"
    if hit:
        return "datacenter", f"{info.get('ip')} {where} -- {info.get('org')}"
    return "residential", f"{info.get('ip')} {where} -- {info.get('org')}"


def cmd_ip(args) -> int:
    proxy, src = resolve_proxy(args.proxy)
    print(f"proxy: {redact(proxy)}  (from {src})\n")
    rc = 0
    for label, p in (("direct", None), ("proxy", proxy or None)):
        if label == "proxy" and not proxy:
            say(WARN, "proxy: not configured, skipped")
            continue
        info = egress(p)
        if info.get("error"):
            say(BAD, f"{label}: unreachable -- {info['error']}")
            rc = 1
            continue
        verdict, reason = classify(info)
        state = OK if verdict == "residential" else WARN
        say(state, f"{label}: {verdict} -- {reason}")
    return rc


# ── raw fetch ───────────────────────────────────────────────────────────────
def fetch(url: str, proxy: str | None, save: Path | None = None) -> dict:
    import httpx

    try:
        with httpx.Client(
            proxy=proxy or None, timeout=60, headers=HEADERS, follow_redirects=True
        ) as c:
            r = c.get(url)
    except Exception as exc:  # noqa: BLE001
        return {"error": f"{type(exc).__name__}: {exc}"}
    body = r.text
    if save:
        save.write_text(body)
    title = ""
    if "<title>" in body:
        title = body.split("<title>", 1)[1].split("</title>", 1)[0].strip()[:90]
    return {
        "status": r.status_code,
        "bytes": len(r.content),
        "blocked": looks_blocked(r.status_code, r.headers, body),
        "title": title,
        "markers": [m for m in WAF_MARKERS if m in body[:4000]],
    }


def report_fetch(label: str, res: dict, expect_block: bool = False) -> bool:
    """expect_block flips the severity: in the no-proxy control step a WAF
    challenge is the desired outcome, not a failure."""
    if res.get("error"):
        say(WARN if expect_block else BAD, f"{label}: {res['error']}")
        return False
    if res["blocked"]:
        say(
            WARN if expect_block else BAD,
            f"{label}: WAF challenge -- HTTP {res['status']}, "
            f"{res['bytes']}B, markers={res['markers'] or 'status-only'}",
        )
        return False
    say(OK, f"{label}: HTTP {res['status']}, {res['bytes']}B, title={res['title']!r}")
    return True


def cmd_fetch(args) -> int:
    proxy, src = resolve_proxy(args.proxy)
    if args.direct:
        proxy, src = "", "--direct"
    print(f"url:   {args.url}\nproxy: {redact(proxy)}  (from {src})\n")
    save = Path(args.save) if args.save else None
    ok = report_fetch("fetch", fetch(args.url, proxy or None, save))
    if save:
        print(f"       body saved to {save}")
    return 0 if ok else 1


# ── the project's own code path ─────────────────────────────────────────────
def cmd_spider(args) -> int:
    """Drive app.scraper the way the crawler does, through the proxy.

    Imports happen *after* the env is set: app.config builds a cached Settings
    at import time, so exporting SCRAPER_PROXY later has no effect.
    """
    proxy, src = resolve_proxy(args.proxy)
    if not proxy:
        say(BAD, "no proxy configured -- set SCRAPER_PROXY in spider/.env")
        return 1
    os.environ["SCRAPER_PROXY"] = proxy
    os.environ["STORE_RAW_HTML"] = "false"  # no rustfs/S3 in a local probe
    sys.path.insert(0, str(SPIDER_DIR))
    os.chdir(SPIDER_DIR)
    print(f"proxy: {redact(proxy)}  (from {src})")
    print(f"call:  scrape_fixtures({args.comp!r}, {args.season})\n")

    import asyncio

    from app.config import settings
    from app.scraper.client import FetchError, fetcher
    from app.scraper.transfermarkt import scrape_fixtures

    if not settings.scraper_proxy:
        say(BAD, "Settings.scraper_proxy is empty -- env was set too late")
        return 1

    async def run() -> dict:
        await fetcher.start()
        try:
            return await scrape_fixtures(args.comp, args.season)
        finally:
            await fetcher.close()

    try:
        data = asyncio.run(run())
    except FetchError as exc:
        say(BAD, f"FetchError -- {exc}")
        return 1
    except Exception as exc:  # noqa: BLE001
        say(BAD, f"{type(exc).__name__}: {exc}")
        return 1

    fixtures = data.get("fixtures", [])
    if not fixtures:
        say(BAD, "parsed 0 fixtures -- page fetched but empty (see gotchas)")
        return 1
    say(OK, f"parsed {len(fixtures)} fixtures via the spider's own fetcher")
    sample = fixtures[0]
    keep = ("date", "time", "kickoff", "home", "away", "matchday", "round")
    print("        first:", {k: sample[k] for k in keep if k in sample})
    return 0


# ── everything, in order ────────────────────────────────────────────────────
def cmd_doctor(args) -> int:
    proxy, src = resolve_proxy(args.proxy)
    print(f"proxy: {redact(proxy)}  (from {src})")
    print(f"target: {args.url}\n")
    failures = 0

    print("1. egress identity")
    if not proxy:
        say(BAD, "no proxy configured (--proxy / $SCRAPER_PROXY / spider/.env)")
        return 1
    info = egress(proxy)
    if info.get("error"):
        say(BAD, f"proxy unreachable -- {info['error']}")
        say(WARN, "check host:port and that user:pass are URL-encoded")
        return 1
    verdict, reason = classify(info)
    say(OK if verdict == "residential" else WARN, f"{verdict} -- {reason}")
    if verdict == "datacenter":
        say(WARN, "datacenter egress: AWS WAF will challenge every request")

    print("\n2. upstream through the proxy")
    if not report_fetch("proxied", fetch(args.url, proxy)):
        failures += 1

    print("\n3. control: same URL, no proxy")
    direct = fetch(args.url, None)
    if report_fetch("direct", direct, expect_block=True):
        say(WARN, "direct works too -- this network may not need the proxy")
    else:
        say(OK, "direct is blocked as expected -- the proxy is what buys access")

    print("\n4. the spider's own fetcher + parser")
    rc = cmd_spider(argparse.Namespace(proxy=proxy, comp=args.comp, season=args.season))
    failures += 1 if rc else 0

    print()
    if failures:
        say(BAD, f"{failures} check(s) failed")
    else:
        say(OK, "all checks passed -- the proxy is a working route to the upstream")
    return 1 if failures else 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--proxy", help="http://user:pass@host:port or socks5://...")
    sub = ap.add_subparsers(dest="cmd", required=True)

    p = sub.add_parser("ip", help="compare direct vs proxied egress IP")
    p.set_defaults(func=cmd_ip)

    p = sub.add_parser("fetch", help="fetch one URL and judge the response")
    p.add_argument("url", nargs="?", default=DEFAULT_TM_URL)
    p.add_argument("--direct", action="store_true", help="bypass the proxy")
    p.add_argument("--save", help="write the body to this file")
    p.set_defaults(func=cmd_fetch)

    p = sub.add_parser("spider", help="run the project's fetcher+parser via proxy")
    p.add_argument("--comp", default="GB1")
    p.add_argument("--season", type=int, default=2025)
    p.set_defaults(func=cmd_spider)

    p = sub.add_parser("doctor", help="every check above, in order")
    p.add_argument("--url", default=DEFAULT_TM_URL)
    p.add_argument("--comp", default="GB1")
    p.add_argument("--season", type=int, default=2025)
    p.set_defaults(func=cmd_doctor)

    args = ap.parse_args()
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
