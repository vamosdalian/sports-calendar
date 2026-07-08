# ── Backend image: FastAPI + scraper worker ──────────────────────────────────
# Runs the API and the in-process crawl worker. Captcha is solved unattended via
# 2captcha (CAPTCHA_PROVIDER=2captcha), so no display/Chromium is needed at
# runtime. The headful-browser fallback (CAPTCHA_PROVIDER=browser) needs a real
# display and does NOT work in this headless container — keep 2captcha funded.
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Build deps for asyncpg / selectolax wheels are already prebuilt, but keep
# curl for the healthcheck.
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install -r requirements.txt

COPY app ./app

EXPOSE 8000

# A non-root user; the persistent browser-profile/cookie dir is mounted at
# /app/.browser_profile and must be writable.
RUN useradd --create-home --uid 10001 spider \
    && mkdir -p /app/.browser_profile \
    && chown -R spider:spider /app
USER spider

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
    CMD curl -fsS http://localhost:8000/api/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
