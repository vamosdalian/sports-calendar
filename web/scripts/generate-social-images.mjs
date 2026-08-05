import { mkdir, readdir, unlink } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import sharp from "sharp";

const WIDTH = 1200;
const HEIGHT = 630;
const API_BASE_URL = (
  process.env.SPORTS_CALENDAR_API_BASE_URL ?? "https://api.sports-calendar.com"
).replace(/\/$/, "");
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const outputDirectory = path.resolve(scriptDirectory, "../public/social");
const SOCIAL_FONT_FAMILY =
  "WenQuanYi Micro Hei, PingFang SC, Hiragino Sans GB, Microsoft YaHei, sans-serif";

await mkdir(outputDirectory, { recursive: true });
await Promise.all(
  (await readdir(outputDirectory))
    .filter((filename) => filename.endsWith(".png"))
    .map((filename) => unlink(path.join(outputDirectory, filename))),
);

const locales = {
  en: {
    siteTagline: "Sports calendars for competitions worldwide",
    directoryLabel: "Football",
    competitionLabel: "Competition",
    seasonLabel: "Season",
    subscribeLabel: "Add to calendar",
    calendarSuffix: "calendar",
    months: ["July", "August", "September"],
    weekdays: ["M", "T", "W", "T", "F", "S", "S"],
  },
  zh: {
    siteTagline: "覆盖全球的体育赛事日历",
    directoryLabel: "足球",
    competitionLabel: "赛事",
    seasonLabel: "赛季",
    subscribeLabel: "添加到日历",
    calendarSuffix: "赛季日历",
    months: ["七月", "八月", "九月"],
    weekdays: ["一", "二", "三", "四", "五", "六", "日"],
  },
};
let generatedCount = 0;

for (const [locale, copy] of Object.entries(locales)) {
  const directory = await fetchJson(`${API_BASE_URL}/api/leagues?lang=${locale}`);
  const leagues = (directory.items ?? []).flatMap((sport) =>
    (sport.leagues ?? []).map((league) => ({ ...league, sportSlug: sport.sportSlug })),
  );

  await renderHomeCard({
    filename: `home-${locale}.png`,
    copy,
    leagueNames: leagues.slice(0, 7).map((league) => league.leagueName),
    locale,
  });

  for (const league of leagues) {
    if (!isSafeSlug(league.sportSlug) || !isSafeSlug(league.leagueSlug) || !league.leagueName) {
      throw new Error(`Cannot generate social image for invalid league ${JSON.stringify(league)}`);
    }

    const seasonsPayload = await fetchJson(
      `${API_BASE_URL}/api/${encodeURIComponent(league.sportSlug)}/${encodeURIComponent(league.leagueSlug)}/seasons?lang=${locale}`,
    );
    const seasons = seasonsPayload.seasons?.length
      ? seasonsPayload.seasons
      : league.defaultSeason
        ? [league.defaultSeason]
        : [];

    for (const season of seasons) {
      if (!isSafeSlug(season.slug)) {
        throw new Error(`Cannot generate social image for invalid season ${JSON.stringify(season)}`);
      }

      await renderLeagueCard({
        filename: `league-${league.leagueSlug}-${season.slug}-${locale}.png`,
        copy,
        leagueName: league.leagueName,
        leagueNames: [league, ...leagues.filter((entry) => entry.leagueSlug !== league.leagueSlug)]
          .slice(0, 5)
          .map((entry) => entry.leagueName),
        locale,
        season: formatSeason(season.label ?? season.slug),
      });

      generatedCount += 1;
    }
  }

  generatedCount += 1;
}

console.log(`social-images: generated ${generatedCount} cards in ${outputDirectory}`);

async function renderHomeCard({ filename, copy, leagueNames, locale }) {
  const tileWidth = 316;
  const tiles = leagueNames.slice(0, 6).map((name, index) => {
    const x = 76 + (index % 3) * 340;
    const y = 276 + Math.floor(index / 3) * 92;
    return `
      <rect x="${x}" y="${y}" width="${tileWidth}" height="64" fill="#ffffff" fill-opacity="0.27" stroke="#ffffff" stroke-opacity="0.42"/>
      ${textElement(name, x + 22, y + 41, { fontSize: 21, fill: "#102132" })}`;
  }).join("");

  await writeSvg(filename, `
    ${pageBackground()}
    ${siteHeader(copy, locale)}
    <rect x="32" y="148" width="1136" height="450" fill="#9CD5FF"/>
    <rect x="72" y="188" width="1056" height="58" fill="#7AAACE"/>
    ${textElement(copy.directoryLabel, 98, 226, { fontSize: 23, fill: "#102132", fontWeight: 600 })}
    ${tiles}
    ${textElement("Apple Calendar · Google Calendar · Outlook", 76, 548, { fontSize: 18, fill: "#102132", fillOpacity: 0.7 })}
  `);
}

async function renderLeagueCard({ filename, copy, leagueName, leagueNames, locale, season }) {
  const title = `${leagueName}${season ? ` ${season}` : ""} ${copy.calendarSuffix}`;
  const titleSize = title.length > 38 ? 27 : title.length > 28 ? 30 : 34;
  const leagueNav = leagueNames.slice(0, 4).map((name, index) => navItem(name, 54, 236 + index * 53, index === 0)).join("");
  const calendarCards = copy.months.map((month, index) => monthCard(288 + index * 282, 270, month, copy.weekdays, index)).join("");

  await writeSvg(filename, `
    ${pageBackground()}
    ${siteHeader(copy, locale)}
    <rect x="32" y="148" width="220" height="450" fill="#7AAACE"/>
    <rect x="252" y="148" width="916" height="450" fill="#9CD5FF"/>

    ${textElement(copy.competitionLabel, 54, 202, { fontSize: 17, fill: "#102132", fillOpacity: 0.72, fontWeight: 600 })}
    ${leagueNav}
    ${textElement(copy.seasonLabel, 54, 478, { fontSize: 17, fill: "#102132", fillOpacity: 0.72, fontWeight: 600 })}
    ${navItem(season || "-", 54, 500, true)}

    ${textElement(title, 288, 218, { fontSize: titleSize, fill: "#102132", fontWeight: 600 })}
    <rect x="958" y="177" width="170" height="52" fill="#355872"/>
    ${textElement(copy.subscribeLabel, 1043, 210, { fontSize: 18, fill: "#ffffff", fontWeight: 500, textAnchor: "middle" })}
    ${calendarCards}
  `);
}

function pageBackground() {
  return `<rect width="1200" height="630" fill="#F7F8F0"/>`;
}

function textElement(
  value,
  x,
  y,
  { fontSize, fill, fillOpacity = 1, fontWeight = 400, textAnchor = "start" },
) {
  return `<text x="${x}" y="${y}" font-family="${SOCIAL_FONT_FAMILY}" font-size="${fontSize}" font-weight="${fontWeight}" text-anchor="${textAnchor}" fill="${fill}" fill-opacity="${fillOpacity}">${escapeXml(value)}</text>`;
}

function siteHeader(copy, locale) {
  return `
    <rect x="32" y="24" width="1136" height="124" fill="#355872"/>
    ${textElement("sports-calendar.com", 72, 72, { fontSize: 18, fill: "#ffffff", fillOpacity: 0.9 })}
    ${textElement(copy.siteTagline, 72, 112, { fontSize: 25, fill: "#ffffff", fontWeight: 600 })}
    <rect x="1040" y="62" width="88" height="44" fill="#ffffff" fill-opacity="0.08" stroke="#ffffff" stroke-opacity="0.28"/>
    ${textElement(locale === "zh" ? "中文" : "EN", 1084, 91, { fontSize: 17, fill: "#ffffff", textAnchor: "middle" })}`;
}

function navItem(label, x, y, active) {
  return `
    <rect x="${x}" y="${y}" width="166" height="40" fill="${active ? "#355872" : "#ffffff"}" fill-opacity="${active ? "1" : "0.25"}" stroke="${active ? "#355872" : "#ffffff"}" stroke-opacity="${active ? "1" : "0.42"}"/>
    ${textElement(truncate(label, 18), x + 15, y + 27, { fontSize: 16, fill: active ? "#ffffff" : "#102132" })}`;
}

function monthCard(x, y, month, weekdays, variant) {
  const cell = 26;
  const gap = 5;
  const startX = x + 22;
  const weekdayRow = weekdays.map((day, index) => textElement(
    day,
    startX + index * (cell + gap) + cell / 2,
    y + 77,
    { fontSize: 12, fill: "#102132", fillOpacity: 0.5, textAnchor: "middle" },
  )).join("");
  const matchDays = new Set([[1, 5, 9, 13, 18, 24, 29], [4, 8, 12, 17, 22, 25, 30], [2, 6, 11, 15, 20, 23, 28]][variant]);
  const days = Array.from({ length: 35 }, (_, index) => {
    const dayNumber = index - 1;
    const day = dayNumber >= 1 && dayNumber <= 31 ? String(dayNumber) : "";
    const active = day !== "" && matchDays.has(dayNumber);
    const cx = startX + (index % 7) * (cell + gap);
    const cy = y + 92 + Math.floor(index / 7) * (cell + gap);
    return `
      <rect x="${cx}" y="${cy}" width="${cell}" height="${cell}" fill="${active ? "#355872" : "#ffffff"}" fill-opacity="${active ? "1" : "0.48"}"/>
      ${day ? textElement(day, cx + cell / 2, cy + 18, { fontSize: 12, fill: active ? "#ffffff" : "#102132", textAnchor: "middle" }) : ""}`;
  }).join("");

  return `
    <rect x="${x}" y="${y}" width="250" height="262" fill="#ffffff" fill-opacity="0.35" stroke="#102132" stroke-opacity="0.08"/>
    ${textElement(month, x + 125, y + 42, { fontSize: 18, fill: "#102132", textAnchor: "middle" })}
    ${weekdayRow}
    ${days}`;
}

async function writeSvg(filename, content) {
  const svg = `
    <svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      ${content}
    </svg>`;

  await sharp(Buffer.from(svg)).png({ compressionLevel: 9, palette: true }).toFile(path.join(outputDirectory, filename));
}

async function fetchJson(url) {
  let lastError;

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return await response.json();
      }
      lastError = new Error(`HTTP ${response.status} for ${url}`);
    } catch (error) {
      lastError = error;
    }

    if (attempt < 5) {
      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** (attempt - 1)));
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`Failed to fetch ${url}`);
}

function isSafeSlug(value) {
  return typeof value === "string" && /^[a-z0-9-]+$/.test(value);
}

function formatSeason(value) {
  const match = String(value).match(/^(\d{4})-(\d{4})$/);
  return match ? `${match[1]}/${match[2].slice(2)}` : String(value);
}

function truncate(value, maxLength) {
  const text = String(value);
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
