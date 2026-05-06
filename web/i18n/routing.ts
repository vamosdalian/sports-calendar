import { defineRouting } from "next-intl/routing";

import { locales, defaultLocale } from "../lib/site";

export const routing = defineRouting({
  locales,
  defaultLocale,
  localeDetection: false,
});
