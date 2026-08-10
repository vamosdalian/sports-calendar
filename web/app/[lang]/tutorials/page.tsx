import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { LanguageSwitcher } from "../../../components/language-switcher";
import { TimeZoneSelector } from "../../../components/time-zone-selector";
import { TutorialCard } from "../../../components/tutorial-ui";
import { buildSocialMetadata } from "../../../lib/social-metadata";
import { getTutorialIndexCopy, getTutorials } from "../../../lib/tutorials";
import {
  isLocale,
  locales,
  toAlternates,
  toPath,
  toTutorialIndexPath,
  toTutorialPath,
  type Locale,
} from "../../../lib/site";

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) {
    return {};
  }

  const copy = getTutorialIndexCopy(lang);
  const title = `${copy.eyebrow} | sports-calendar.com`;
  const alternates = toAlternates(lang, toTutorialIndexPath);

  return {
    title,
    description: copy.description,
    alternates,
    ...buildSocialMetadata({
      canonicalPath: alternates.canonical,
      description: copy.description,
      imageAlt: copy.title,
      locale: lang,
      title,
    }),
  };
}

export default async function TutorialsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) {
    notFound();
  }

  const locale = lang as Locale;
  setRequestLocale(locale);
  const t = await getTranslations({ locale });
  const copy = getTutorialIndexCopy(locale);
  const tutorials = getTutorials(locale);
  const localePaths = Object.fromEntries(
    locales.map((entry) => [entry, toTutorialIndexPath(entry)]),
  ) as Record<Locale, string>;
  const homeHref = toPath(locale);

  return (
    <div>
      <header className="mx-auto w-full max-w-[1200px] bg-header text-white">
        <div className="flex items-center justify-between gap-4 px-4 py-5 sm:px-6 lg:px-8">
          <Link className="block" href={homeHref}>
            <span className="block text-sm text-white/58">{t("siteName")}</span>
            <span className="mt-1 block text-lg font-medium text-white">{copy.eyebrow}</span>
          </Link>
          <LanguageSwitcher localePaths={localePaths} />
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1200px] bg-panel px-5 py-7 text-ink sm:px-6 lg:py-10">
        <div className="mx-auto max-w-[1040px]">
          <nav className="mb-5 text-sm text-ink/70">
            <Link className="underline underline-offset-2 hover:text-ink" href={homeHref}>
              {t("siteName")}
            </Link>
            <span className="px-2">/</span>
            <span>{copy.eyebrow}</span>
          </nav>

          <section className="overflow-hidden rounded-[2rem] border border-ink/10 bg-white/78 p-7 shadow-panel sm:p-10">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-header/70">{copy.eyebrow}</p>
            <h1 className="mt-3 max-w-[760px] text-3xl font-semibold tracking-tight text-ink sm:text-5xl sm:leading-[1.08]">
              {copy.title}
            </h1>
            <p className="mt-5 max-w-[780px] text-base leading-7 text-ink/75 sm:text-lg sm:leading-8">
              {copy.description}
            </p>
          </section>

          <section className="mt-8">
            <div className="max-w-[760px]">
              <h2 className="text-2xl font-semibold tracking-tight text-ink">{copy.chooseTitle}</h2>
              <p className="mt-2 text-sm leading-6 text-ink/70 sm:text-base">{copy.chooseBody}</p>
            </div>

            <aside className="mt-5 rounded-2xl border border-amber-700/15 bg-amber-50/90 px-5 py-4 text-amber-950">
              <p className="font-semibold">{copy.importantTitle}</p>
              <p className="mt-1 text-sm leading-6 text-amber-950/75">{copy.importantBody}</p>
            </aside>

            <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
              {tutorials.map((tutorial) => (
                <TutorialCard
                  availabilityLabel={copy.availabilityLabel}
                  durationLabel={copy.durationLabel}
                  href={toTutorialPath(locale, tutorial.slug)}
                  key={tutorial.slug}
                  linkTypeLabel={copy.linkTypeLabel}
                  locale={locale}
                  openGuideLabel={copy.openGuideLabel}
                  tutorial={tutorial}
                />
              ))}
            </div>
          </section>

          <section className="mt-10 rounded-[2rem] border border-ink/10 bg-header p-7 text-white sm:p-9">
            <h2 className="text-2xl font-semibold tracking-tight">{copy.principlesTitle}</h2>
            <div className="mt-6 grid gap-6 md:grid-cols-3">
              {copy.principles.map((principle, index) => (
                <article key={principle.title}>
                  <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-white/12 px-2 text-sm font-semibold text-white">
                    {index + 1}
                  </span>
                  <h3 className="mt-4 font-semibold text-white">{principle.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-white/68">{principle.body}</p>
                </article>
              ))}
            </div>
          </section>
        </div>
      </main>

      <footer className="mx-auto w-full max-w-[1200px] bg-header text-white">
        <div className="flex flex-col gap-4 px-4 py-6 text-sm text-white/80 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <div className="flex flex-col gap-2">
            <span>{t("siteName")}</span>
            <span>{copy.eyebrow}</span>
          </div>
          <div className="flex flex-col gap-3 text-left md:ml-auto md:items-end md:text-right">
            <TimeZoneSelector browserDefaultLabel={t("browserDefaultLabel")} />
            <div>
              <span>{t("contactUsLabel")}: </span>
              <Link
                aria-label={t("contactEmailAriaLabel")}
                className="font-medium text-white underline underline-offset-2 transition hover:text-white/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                href="mailto:support@sports-calendar.com"
              >
                support@sports-calendar.com
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
