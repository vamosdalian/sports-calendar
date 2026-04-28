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

export function toTutorialPath(locale: Locale, slug: string) {
  return `/${locale}/tutorials/${slug}/`;
}

export function localizedDateLocale(locale: Locale) {
  return getLocaleOption(locale).dateLocale;
}
