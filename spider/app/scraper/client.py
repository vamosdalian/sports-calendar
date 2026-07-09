"""Silent HTTP fetcher for Transfermarkt (httpx + 2captcha for the WAF token).

Transfermarkt is behind AWS WAF, which blocks plain HTTP clients with an
interactive captcha. We recover the ``aws-waf-token`` cookie **only** via
2captcha (no browser, no human) and then do all scraping through a fast, silent
``httpx`` client carrying that cookie.

* The token is persisted to disk (``waf_cookies.json``), so after a successful
  solve the token is reused across requests and restarts — 2captcha is called
  again only once the token expires and an ``httpx`` request gets WAF-blocked.
* A blocked request triggers a 2captcha solve with a few retries; if every
  attempt fails the caller gets a clean error (surfaced as a 4xx), never a crash.
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
import uuid
from contextvars import ContextVar
from dataclasses import dataclass
from pathlib import Path

import httpx
from selectolax.parser import HTMLParser

from app.config import settings
from app.rate_limiter import AsyncRateLimiter
from app.scraper.captcha import CaptchaError, solver as captcha_solver
from app.storage import build_key, put_html, record_snapshot

log = logging.getLogger("scraper")

# Set by the crawl worker so snapshots taken during a task can be linked back
# to it. Left at None for ad-hoc fetches (e.g. tree expansion / discovery).
current_task_id: ContextVar[uuid.UUID | None] = ContextVar(
    "current_task_id", default=None
)

# Single global limiter -> guarantees the configured QPS process-wide.
rate_limiter = AsyncRateLimiter(qps=settings.scraper_qps, burst=1)

_CAPTCHA_MARKERS = ("awsWafCookieDomainList", "Human Verification", "gokuProps")
_BLOCK_STATUS = {403, 405, 429, 503}
_COOKIE_FILE = Path(settings.scraper_browser_profile) / "waf_cookies.json"


def _looks_blocked(resp: httpx.Response) -> bool:
    if resp.status_code in _BLOCK_STATUS:
        return True
    if resp.headers.get("x-amzn-waf-action"):
        return True
    head = resp.text[:4000]
    return any(m in head for m in _CAPTCHA_MARKERS)


def _safe_json(resp: httpx.Response):
    """Parse a body as JSON regardless of the (sometimes wrong) content-type."""
    try:
        return resp.json()
    except Exception:  # noqa: BLE001
        return None


def _is_captcha(html: str, title: str) -> bool:
    if title.strip() == "Human Verification":
        return True
    return any(m in html for m in _CAPTCHA_MARKERS)


@dataclass
class VerificationState:
    """Kept for API compatibility (/api/browser/status). With the browser path
    removed there is no human-in-the-loop, so this stays False."""

    needs_verification: bool = False
    url: str | None = None
    since: float | None = None

    def as_dict(self) -> dict:
        return {
            "needs_verification": self.needs_verification,
            "url": self.url,
            "waiting_seconds": (
                round(time.monotonic() - self.since) if self.since else None
            ),
        }


def _redact_proxy(proxy: str) -> str:
    """Hide the user:pass in a proxy URL before logging it."""
    try:
        parsed = httpx.URL(proxy)
        if parsed.username or parsed.password:
            return str(parsed.copy_with(username="***", password="***"))
    except Exception:  # noqa: BLE001
        return "<proxy>"
    return proxy


def _headers() -> dict[str, str]:
    return {
        "User-Agent": settings.scraper_user_agent,
        "Accept": (
            "text/html,application/xhtml+xml,application/xml;q=0.9,"
            "image/avif,image/webp,*/*;q=0.8"
        ),
        "Accept-Language": "en-US,en;q=0.9",
        "Upgrade-Insecure-Requests": "1",
    }


class BrowserFetcher:
    def __init__(self) -> None:
        self._http: httpx.AsyncClient | None = None
        self._lock = asyncio.Lock()          # serialise navigations
        self._verify_lock = asyncio.Lock()   # only one token solve at a time
        self.state = VerificationState()

    # ── lifecycle ───────────────────────────────────────────────────────────
    async def start(self) -> None:
        if self._http is None:
            proxy = settings.scraper_proxy or None
            if proxy:
                log.info("scraper routing through proxy %s", _redact_proxy(proxy))
            self._http = httpx.AsyncClient(
                base_url=settings.scraper_base_url,
                timeout=settings.scraper_timeout,
                follow_redirects=True,
                headers=_headers(),
                proxy=proxy,
            )
            self._load_cookies()

    async def close(self) -> None:
        if self._http is not None:
            await self._http.aclose()
            self._http = None

    # ── cookie persistence ──────────────────────────────────────────────────
    def _load_cookies(self) -> None:
        try:
            data = json.loads(_COOKIE_FILE.read_text())
            for k, v in data.items():
                self._http.cookies.set(k, v)
            log.info("loaded %d cached WAF cookies", len(data))
        except FileNotFoundError:
            pass
        except Exception as exc:  # noqa: BLE001
            log.warning("could not load cookies: %s", exc)

    def _save_cookies(self, jar: dict[str, str]) -> None:
        try:
            _COOKIE_FILE.parent.mkdir(parents=True, exist_ok=True)
            _COOKIE_FILE.write_text(json.dumps(jar))
            log.info("cached %d WAF cookies to %s", len(jar), _COOKIE_FILE)
        except Exception as exc:  # noqa: BLE001
            log.warning("could not save cookies: %s", exc)

    # ── public fetch ─────────────────────────────────────────────────────────
    async def fetch(self, path: str, *, params: dict | None = None) -> HTMLParser:
        if self._http is None:
            await self.start()
        # Cache-buster: Transfermarkt sits behind CloudFront, which otherwise
        # serves stale pages (e.g. fixtures whose kickoff times were just
        # published). A unique param forces a fresh origin response.
        params = dict(params or {})
        params["_"] = int(time.time() * 1000)
        url = str(self._http.build_request("GET", path, params=params).url)

        async with self._lock:
            await rate_limiter.acquire()
            blocked = False
            blocked_html = None
            html = None
            status_code = None
            try:
                resp = await self._http.get(path, params=params)
                if _looks_blocked(resp):
                    blocked = True
                    blocked_html = resp.text  # WAF interstitial -> feeds the solver
                    log.info("httpx WAF-blocked (%s) on %s", resp.status_code, url)
                else:
                    status_code = resp.status_code
                    html = resp.text
            except (httpx.TimeoutException, httpx.TransportError) as exc:
                blocked = True
                log.info("httpx error (%s) on %s -> recover token", exc, url)
            if blocked:
                html = await self._refresh_token(url, blocked_html)

        # Never persist a captcha / human-verification interstitial — only the
        # real page that comes back after it's solved is worth snapshotting.
        if settings.store_raw_html and html and not _is_captcha(html, ""):
            key = build_key(url)
            try:
                await put_html(key, html, url)
            except Exception as exc:  # storage must never break scraping
                log.warning("snapshot store failed for %s: %s", url, exc)
            else:
                try:
                    await record_snapshot(
                        url, key, status_code, current_task_id.get()
                    )
                except Exception as exc:  # indexing must never break scraping
                    log.warning("snapshot index failed for %s: %s", url, exc)
        return HTMLParser(html)

    async def fetch_json(self, path: str, *, params: dict | None = None):
        """Fetch a JSON endpoint (e.g. ``/quickselect/...``) through the same
        rate limiter + WAF-recovery path. Returns the parsed JSON, or None."""
        if self._http is None:
            await self.start()
        params = dict(params or {})
        url = str(self._http.build_request("GET", path, params=params).url)

        async with self._lock:
            await rate_limiter.acquire()
            blocked = False
            blocked_html = None
            try:
                resp = await self._http.get(path, params=params)
                if _looks_blocked(resp):
                    blocked = True
                    blocked_html = resp.text
                    log.info("httpx WAF-blocked (%s) on %s", resp.status_code, url)
                else:
                    return _safe_json(resp)
            except (httpx.TimeoutException, httpx.TransportError) as exc:
                blocked = True
                log.info("httpx error (%s) on %s -> recover token", exc, url)

        if blocked:
            # Refresh the aws-waf-token via 2captcha, then retry once.
            await self._refresh_token(url, blocked_html)
            async with self._lock:
                await rate_limiter.acquire()
                resp = await self._http.get(path, params=params)
                return _safe_json(resp)
        return None

    # ── token recovery (2captcha only, with retries) ─────────────────────────
    async def _refresh_token(self, url: str, blocked_html: str | None = None) -> str:
        """Recover a fresh aws-waf-token via 2captcha. Retries up to
        ``captcha_max_attempts`` times; raises CaptchaError if all fail. There is
        no browser fallback — the caller turns CaptchaError into a 4xx."""
        if not (settings.captcha_provider == "2captcha" and captcha_solver.enabled):
            raise CaptchaError(
                "2captcha is not configured (TWOCAPTCHA_API_KEY missing); "
                "no browser fallback available"
            )

        attempts = max(1, settings.captcha_max_attempts)
        last_error: Exception | None = None
        for i in range(1, attempts + 1):
            try:
                html = await self._refresh_via_2captcha(url, blocked_html)
                if i > 1:
                    log.info("2captcha solve succeeded on attempt %d/%d", i, attempts)
                return html
            except CaptchaError as exc:
                last_error = exc
                log.warning(
                    "2captcha solve attempt %d/%d failed: %s", i, attempts, exc
                )
                # Force a fresh challenge on the next attempt (stale gokuProps is
                # a common reason for ERROR_CAPTCHA_UNSOLVABLE).
                blocked_html = None
                if i < attempts:
                    await asyncio.sleep(min(2 * i, 5))
        raise CaptchaError(
            f"2captcha failed after {attempts} attempts: {last_error}"
        )

    async def _refresh_via_2captcha(self, url: str, blocked_html: str | None) -> str:
        """Hand the AWS WAF challenge to 2captcha, inject the returned token into
        the httpx cookie jar, persist it, and re-fetch the real page."""
        async with self._verify_lock:
            html = blocked_html
            if not html or "gokuProps" not in html:
                # No interstitial in hand (e.g. the request timed out, or we are
                # retrying) — fetch a fresh one so the solver has current params.
                await rate_limiter.acquire()
                html = (await self._http.get(url)).text

            cookies = await captcha_solver.solve_aws_waf(url, html)
            for name, value in cookies.items():
                self._http.cookies.set(name, value)
            jar = {c.name: c.value for c in self._http.cookies.jar}
            self._save_cookies(jar)
            log.info("injected aws-waf-token from 2captcha into httpx")

            await rate_limiter.acquire()
            return (await self._http.get(url)).text


# Process-wide singleton (name kept as `fetcher` for the parsers).
fetcher = BrowserFetcher()
