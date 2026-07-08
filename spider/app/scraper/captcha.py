"""Unattended AWS WAF captcha solving via 2captcha.

Transfermarkt is fronted by AWS WAF, which serves an interactive captcha. On a
headless server there is no human to click it, so we hand the challenge to
2captcha's ``AmazonTaskProxyless`` and get back an ``aws-waf-token`` that drops
straight into the httpx cookie jar — no Chromium required.

Flow:
  1. Read the WAF interstitial HTML (the body of the blocked response).
  2. Pull ``gokuProps`` (key / iv / context) and the challenge.js / captcha.js
     script URLs out of it.
  3. ``createTask`` -> poll ``getTaskResult`` on api.2captcha.com.
  4. Return ``{"aws-waf-token": <token>}`` for the caller to set as a cookie.
"""

from __future__ import annotations

import asyncio
import json
import logging
import re

import httpx

from app.config import settings

log = logging.getLogger("scraper.captcha")

# ``window.gokuProps = {"key": "...", "iv": "...", "context": "..."}`` — the
# object AWS WAF injects into the challenge page. Match the first balanced-ish
# brace group after the gokuProps marker (it has no nested objects).
_GOKU_RE = re.compile(r"gokuProps\s*[:=]\s*(\{[^{}]*\})", re.DOTALL)
_CHALLENGE_RE = re.compile(r'src=["\'](https://[^"\']+/challenge\.js)["\']')
_CAPTCHA_RE = re.compile(r'src=["\'](https://[^"\']+/captcha\.js)["\']')


class CaptchaError(RuntimeError):
    """Raised when the page can't be parsed or 2captcha fails / times out."""


class TwoCaptchaSolver:
    def __init__(self) -> None:
        self._base = settings.twocaptcha_base_url.rstrip("/")
        self._key = settings.twocaptcha_api_key

    @property
    def enabled(self) -> bool:
        return bool(self._key)

    # ── challenge parsing ────────────────────────────────────────────────────
    @staticmethod
    def _build_task(html: str, page_url: str) -> dict:
        match = _GOKU_RE.search(html or "")
        if not match:
            raise CaptchaError("gokuProps not found in WAF page")
        try:
            goku = json.loads(match.group(1))
        except json.JSONDecodeError as exc:
            raise CaptchaError(f"could not parse gokuProps: {exc}") from exc

        key, iv, context = goku.get("key"), goku.get("iv"), goku.get("context")
        if not (key and iv and context):
            raise CaptchaError(f"incomplete gokuProps: {sorted(goku)}")

        task = {
            "type": "AmazonTaskProxyless",
            "websiteURL": page_url,
            "websiteKey": key,
            "iv": iv,
            "context": context,
            # Ask 2captcha to return a ready-to-use aws-waf-token cookie instead
            # of the raw captcha_voucher / existing_token pair.
            "cookieSolution": True,
        }
        if (challenge := _CHALLENGE_RE.search(html)) is not None:
            task["challengeScript"] = challenge.group(1)
        if (captcha := _CAPTCHA_RE.search(html)) is not None:
            task["captchaScript"] = captcha.group(1)
        return task

    # ── solving ──────────────────────────────────────────────────────────────
    async def solve_aws_waf(self, page_url: str, html: str) -> dict[str, str]:
        if not self.enabled:
            raise CaptchaError("2captcha api key not configured")

        task = self._build_task(html, page_url)
        async with httpx.AsyncClient(base_url=self._base, timeout=30) as client:
            created = await self._post(client, "/createTask", {"task": task})
            task_id = created.get("taskId")
            if created.get("errorId") or not task_id:
                raise CaptchaError(f"createTask failed: {created}")
            log.info("2captcha task %s created for %s", task_id, page_url)

            loop = asyncio.get_event_loop()
            deadline = loop.time() + settings.captcha_timeout
            while loop.time() < deadline:
                await asyncio.sleep(settings.captcha_poll_interval)
                result = await self._post(client, "/getTaskResult", {"taskId": task_id})
                if result.get("errorId"):
                    raise CaptchaError(f"getTaskResult failed: {result}")
                if result.get("status") == "ready":
                    token = self._extract_token(result.get("solution", {}))
                    log.info("2captcha solved AWS WAF for %s", page_url)
                    return {"aws-waf-token": token}

        raise CaptchaError(f"2captcha timed out after {settings.captcha_timeout}s")

    async def _post(self, client: httpx.AsyncClient, path: str, body: dict) -> dict:
        resp = await client.post(path, json={"clientKey": self._key, **body})
        resp.raise_for_status()
        return resp.json()

    @staticmethod
    def _extract_token(solution: dict) -> str:
        # The token can come back in a few shapes depending on the task options
        # and the 2captcha version:
        #   {"cookie": "aws-waf-token=...; Path=/; ..."}  (cookieSolution)
        #   {"token": "..."}                              (anti-captcha-style)
        #   {"existing_token": "...", "captcha_voucher": "..."}  (raw)
        cookie = solution.get("cookie")
        if cookie:
            if "aws-waf-token=" in cookie:
                return cookie.split("aws-waf-token=", 1)[1].split(";", 1)[0].strip()
            return cookie.strip()
        for field in ("token", "existing_token"):
            if solution.get(field):
                return str(solution[field]).strip()
        raise CaptchaError(f"no usable token in solution: {sorted(solution)}")


# Process-wide singleton.
solver = TwoCaptchaSolver()
