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
    <div className="relative inline-block">
      <select
        aria-label="Language selector"
        className="h-9 appearance-none rounded-full border border-white/20 bg-white/10 px-4 pr-10 text-sm font-medium leading-5 text-white outline-none"
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
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/80"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4.5 6.5L8 10l3.5-3.5" />
      </svg>
    </div>
  );
}