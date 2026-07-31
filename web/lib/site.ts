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

export function toTutorialPath(locale: Locale, slug: string) {
  return `/${locale}/tutorials/${slug}/`;
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
