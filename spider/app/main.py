from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.db import init_db
from app.routers import crawl, data, tree
from app.scraper.captcha import CaptchaError
from app.scraper.client import FetchError, fetcher
from app.storage import ensure_bucket
from app.worker import worker

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
log = logging.getLogger("app")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    # The competition catalogue is discovered from Transfermarkt on demand
    # (POST /api/competitions/sync), not seeded from a hardcoded list.
    try:
        await ensure_bucket()
    except Exception as exc:  # storage is optional for the API to boot
        log.warning("could not ensure bucket: %s", exc)
    worker.start()
    log.info("startup complete (QPS limit = %s)", settings.scraper_qps)
    yield
    await worker.stop()
    await fetcher.close()


app = FastAPI(title="Transfermarkt Spider", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tree.router)
app.include_router(crawl.router)
app.include_router(data.router)


@app.exception_handler(CaptchaError)
async def captcha_error_handler(request: Request, exc: CaptchaError):
    """AWS WAF blocked us and 2captcha could not recover a token after retries.
    Surface a clean 424 (Failed Dependency) instead of a 500 crash."""
    log.warning("captcha recovery failed for %s: %s", request.url.path, exc)
    return JSONResponse(
        status_code=424,
        content={
            "error": {
                "code": "waf_unsolved",
                "message": f"AWS WAF token could not be recovered via 2captcha: {exc}",
            }
        },
    )


@app.exception_handler(FetchError)
async def fetch_error_handler(request: Request, exc: FetchError):
    """Transfermarkt returned an HTTP error (502, 500, 404, ...). Surface it as
    a 502 rather than letting an error page be parsed into an empty result."""
    log.warning("upstream fetch failed for %s: %s", request.url.path, exc)
    return JSONResponse(
        status_code=502,
        content={
            "error": {
                "code": "upstream_error",
                "message": str(exc),
            }
        },
    )


@app.get("/api/health")
async def health():
    return {"status": "ok", "qps": settings.scraper_qps}


@app.get("/api/browser/status")
async def browser_status():
    """Whether the scraper is currently blocked on a human captcha solve."""
    return fetcher.state.as_dict()
