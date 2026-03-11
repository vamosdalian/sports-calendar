"use client";

import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";

import { localeOptions, type Locale } from "../lib/site";

type LanguageSwitcherProps = {
  localePaths?: Partial<Record<Locale, string>>;
};

export function LanguageSwitcher({ localePaths }: LanguageSwitcherProps) {
  const currentLocale = useLocale() as Locale;
  const router = useRouter();
  const safeLocalePaths = localePaths ?? {};
  const options = localeOptions.filter((option) => safeLocalePaths[option.code]);

  if (options.length === 0) {
    return null;
  }

  return (
    <select
      aria-label="Language selector"
      className="border border-white/20 bg-white/10 px-3 py-2 text-sm text-white outline-none"
      defaultValue={currentLocale}
      onChange={(event) => {
        const target = safeLocalePaths[event.target.value as Locale];
        if (target) {
          router.push(target);
        }
      }}
    >
      {options.map((option) => (
        <option key={option.code} value={option.code} className="text-ink">
          {option.label}
        </option>
      ))}
    </select>
  );
}