import Link from "next/link";

import type { Locale } from "../lib/site";

type LanguageSwitcherProps = {
  currentLocale: Locale;
  alternatePath: string;
  label: string;
};

export function LanguageSwitcher({ currentLocale, alternatePath, label }: LanguageSwitcherProps) {
  const nextLocale: Locale = currentLocale === "en" ? "zh" : "en";

  return (
    <div className="flex items-center gap-3 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm text-white">
      <span className="text-white/70">{label}</span>
      <Link className="font-semibold tracking-wide text-white" href={alternatePath}>
        {nextLocale.toUpperCase()}
      </Link>
    </div>
  );
}