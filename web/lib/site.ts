export const siteUrl = "https://sports-calendar.com";
export const localeOptions = [
  {
    code: "en",
    label: "English",
    dateLocale: "en-GB",
  },
  {
    code: "zh",
    label: "中文",
    dateLocale: "zh-CN",
  },
] as const;

export type Locale = (typeof localeOptions)[number]["code"];

export const locales = localeOptions.map((option) => option.code) as Locale[];
export const defaultLocale: Locale = "en";
export const localeCookieName = "NEXT_LOCALE";

export function isLocale(value: string): value is Locale {
  return localeOptions.some((option) => option.code === value);
}

export function getLocaleOption(locale: Locale) {
  return localeOptions.find((option) => option.code === locale) ?? localeOptions[0];
}

/**
 * Turn a URL path segment back into the slug the catalog spells it with.
 *
 * Static export hands a page its params still percent-encoded: Next writes the
 * file to `.../teams/atlético-de-madrid/` but the route receives
 * `atl%C3%A9tico-de-madrid`. Every comparison against a catalog slug then
 * fails, and the seven teams whose names carry an accent rendered an empty
 * shell — the team lookup missed, the page redirected, and a static export has
 * no way to serve a redirect.
 *
 * Slugs are the contract behind the ICS feed URLs, so this decodes the request
 * rather than re-slugifying the data.
 */
export function decodeRouteSegment(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    // A stray `%` that is not a valid escape. There is nothing to decode, and
    // throwing here would fail the whole export over one bad URL.
    return value;
  }
}

/** {@link decodeRouteSegment} over every param of a route. */
export function decodeRouteParams<T extends Record<string, string>>(params: T): T {
  return Object.fromEntries(
    Object.entries(params).map(([key, value]) => [key, decodeRouteSegment(value)]),
  ) as T;
}

export function toPath(locale: Locale, sport?: string, league?: string, season?: string) {
  if (!sport || !league || !season) {
    return `/${locale}/`;
  }

  return `/${locale}/${sport}/${league}/${season}/`;
}

/**
 * Team pages live under an explicit `teams/` segment rather than directly
 * under the season. A bare `[team]` segment would swallow every other path
 * below the season, colliding with anything added later (per-match pages).
 */
export function toTeamPath(locale: Locale, sport: string, league: string, season: string, team: string) {
  return `/${locale}/${sport}/${league}/${season}/teams/${team}/`;
}

/**
 * An absolute URL for the sitemap.
 *
 * Percent-encoded, because that is the form the sitemap protocol asks for and
 * — more usefully — the form Next emits in `<link rel="canonical">`, which
 * resolves paths through `metadataBase`. A team whose slug carries an accent
 * would otherwise be listed as `.../atlético-de-madrid/` while its own page
 * claims `.../atl%C3%A9tico-de-madrid/` as canonical. The two are the same URL,
 * but there is no reason to make a crawler prove it.
 */
export function toSitemapUrl(path: string) {
  return `${siteUrl}${encodeURI(path)}`;
}

export function toTutorialPath(locale: Locale, slug: string) {
  return `/${locale}/tutorials/${slug}/`;
}

export function toTutorialIndexPath(locale: Locale) {
  return `/${locale}/tutorials/`;
}

export function localizedDateLocale(locale: Locale) {
  return getLocaleOption(locale).dateLocale;
}

/**
 * The `canonical` + `languages` pair for a page that exists in every locale.
 *
 * `x-default` names the default locale's URL rather than a locale-less one:
 * only the home page has a locale-less URL that answers without redirecting,
 * and hreflang is supposed to point at final URLs. The home page passes its
 * own `/` explicitly for that reason.
 *
 * Without `x-default`, a searcher whose language matches neither `en` nor `zh`
 * has no annotated page to be sent to.
 */
export function toAlternates(
  locale: Locale,
  pathForLocale: (entry: Locale) => string,
  xDefault: string = pathForLocale(defaultLocale),
) {
  const languages: Record<string, string> = { "x-default": xDefault };
  for (const entry of locales) {
    languages[entry] = pathForLocale(entry);
  }

  return {
    canonical: pathForLocale(locale),
    languages,
  };
}
