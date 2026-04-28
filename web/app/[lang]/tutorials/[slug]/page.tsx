import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { LanguageSwitcher } from "../../../../components/language-switcher";
import { TimeZoneSelector } from "../../../../components/time-zone-selector";
import { getTutorial, getTutorialSlugs } from "../../../../lib/tutorials";
import { isLocale, locales, type Locale, toPath, toTutorialPath } from "../../../../lib/site";

export const revalidate = 3600;

export function generateStaticParams() {
  return locales.flatMap((lang) => getTutorialSlugs().map((slug) => ({ lang, slug })));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!isLocale(lang)) {
    return {};
  }

  const tutorial = getTutorial(lang, slug);
  if (!tutorial) {
    return {};
  }

  const localePaths = Object.fromEntries(
    locales.map((entry) => [entry, toTutorialPath(entry, tutorial.slug)]),
  ) as Record<Locale, string>;

  return {
    title: `${tutorial.title} | sports-calendar.com`,
    description: tutorial.description,
    alternates: {
      canonical: localePaths[lang],
      languages: localePaths,
    },
  };
}

export default async function TutorialPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}) {
  const { lang, slug } = await params;
  if (!isLocale(lang)) {
    notFound();
  }

  const locale = lang as Locale;
  const tutorial = getTutorial(locale, slug);
  if (!tutorial) {
    notFound();
  }

  setRequestLocale(locale);
  const t = await getTranslations({ locale });
  const localePaths = Object.fromEntries(
    locales.map((entry) => [entry, toTutorialPath(entry, tutorial.slug)]),
  ) as Record<Locale, string>;
  const homeHref = toPath(locale);

  return (
    <div>
      <header className="mx-auto w-full max-w-[1200px] bg-header text-white">
        <div className="flex items-center justify-between gap-4 px-4 py-5 sm:px-6 lg:px-8">
          <Link className="block" href={homeHref}>
            <span className="block text-sm text-white/58">{t("siteName")}</span>
            <span className="mt-1 block text-lg font-medium text-white">{tutorial.title}</span>
          </Link>
          <LanguageSwitcher localePaths={localePaths} />
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1200px] bg-panel px-5 py-6 text-ink sm:px-6 lg:py-8">
        <div className="mx-auto max-w-[920px]">
          <nav className="mb-5 text-sm text-ink/70">
            <Link className="underline underline-offset-2 hover:text-ink" href={homeHref}>
              {t("siteName")}
            </Link>
            <span className="px-2">/</span>
            <span>{locale === "zh" ? "教程" : "Tutorials"}</span>
          </nav>

          <section className="border border-ink/10 bg-white/70 p-6 sm:p-8">
            <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">{tutorial.title}</h1>
            <p className="mt-4 max-w-[720px] text-base leading-7 text-ink/80">{tutorial.intro}</p>
            {tutorial.note ? (
              <p className="mt-4 border-l-4 border-header/30 bg-header/5 px-4 py-3 text-sm leading-6 text-ink/78">
                {tutorial.note}
              </p>
            ) : null}
          </section>

          <section className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
            {tutorial.steps.map((step, index) => (
              <article key={step.imageSrc} className="flex h-full flex-col border border-ink/10 bg-white/80 p-5 sm:p-6">
                <div className="mb-4 flex items-baseline gap-3">
                  <span className="inline-flex h-9 min-w-9 items-center justify-center bg-header px-3 text-sm font-semibold text-white">
                    {index + 1}
                  </span>
                  <div>
                    <h2 className="text-xl font-semibold text-ink">{step.title}</h2>
                    <p className="mt-2 text-sm leading-6 text-ink/75">{step.body}</p>
                  </div>
                </div>

                <div className="mt-auto overflow-hidden border border-ink/10 bg-[#eef3f7]">
                  <Image
                    alt={step.imageAlt}
                    className="h-auto w-full object-cover object-top"
                    height={2532}
                    priority={index === 0}
                    src={step.imageSrc}
                    width={1170}
                  />
                </div>
              </article>
            ))}
          </section>
        </div>
      </main>

      <footer className="mx-auto w-full max-w-[1200px] bg-header text-white">
        <div className="flex flex-col gap-4 px-4 py-6 text-sm text-white/80 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <div className="flex flex-col gap-2">
            <span>{t("siteName")}</span>
            <span>{locale === "zh" ? "iPhone 订阅教程" : "iPhone subscription guide"}</span>
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
