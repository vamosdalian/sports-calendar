"use client";
import { usePathname, useRouter } from "next/navigation";
import { localeOptions, type Locale } from "../lib/site";

type LanguageSwitcherProps = {
  localePaths?: Partial<Record<Locale, string>>;
};

export function LanguageSwitcher({ localePaths }: LanguageSwitcherProps) {
  const router = useRouter();
  const pathname = usePathname();
  const safeLocalePaths = localePaths ?? {};
  const options = localeOptions.filter((option) => safeLocalePaths[option.code]);
  const pathLocale = pathname.split("/").filter(Boolean)[0] as Locale | undefined;
  const currentLocale = options.some((option) => option.code === pathLocale) ? pathLocale : undefined;
  const selectedLocale = options.some((option) => option.code === currentLocale)
    ? currentLocale
    : options[0]?.code;

  if (options.length === 0) {
    return null;
  }

  return (
    <select
      aria-label="Language selector"
      className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white outline-none"
      value={selectedLocale}
      onChange={(event) => {
        const target = safeLocalePaths[event.target.value as Locale];
        if (target) {
          router.replace(target);
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