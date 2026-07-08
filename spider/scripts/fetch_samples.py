"""Fetch real Transfermarkt pages (reusing the cached WAF token in the
persistent browser profile) and save them locally for parser calibration.

Run with the backend stopped so the browser profile isn't locked:
    ./venv/bin/python scripts/fetch_samples.py
"""

import asyncio
import pathlib

from app.scraper.client import fetcher

OUT = pathlib.Path("scripts/samples")
OUT.mkdir(parents=True, exist_ok=True)

# Argentina Liga Profesional 2025 — the season already scraped successfully.
PAGES = {
    "competition_clubs": "/x/startseite/wettbewerb/AR1N/plus/?saison_id=2025",
    "fixtures": "/x/gesamtspielplan/wettbewerb/AR1N/saison_id/2025",
    # Boca Juniors squad (id 189)
    "club_squad": "/x/kader/verein/189/saison_id/2025/plus/1",
}


async def main() -> None:
    await fetcher.start()
    try:
        for name, path in PAGES.items():
            tree = await fetcher.fetch(path)
            html = tree.html or ""
            (OUT / f"{name}.html").write_text(html, encoding="utf-8")
            print(f"{name}: {len(html)} bytes -> scripts/samples/{name}.html")
    finally:
        await fetcher.close()


if __name__ == "__main__":
    asyncio.run(main())
