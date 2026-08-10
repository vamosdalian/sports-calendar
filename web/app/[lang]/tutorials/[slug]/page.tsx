import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { LanguageSwitcher } from "../../../../components/language-switcher";
import { TimeZoneSelector } from "../../../../components/time-zone-selector";
import { TutorialMark, TutorialPath } from "../../../../components/tutorial-ui";
import { buildSocialMetadata } from "../../../../lib/social-metadata";
import { getTutorial, getTutorialSlugs } from "../../../../lib/tutorials";
import {
  isLocale,
  locales,
  toAlternates,
  toPath,
  toTutorialIndexPath,
  toTutorialPath,
  type Locale,
} from "../../../../lib/site";

const pageCopy = {
  en: {
    tutorials: "Calendar subscription guides",
    prerequisites: "Before you start",
    steps: "Follow these steps",
    stepLabel: "Step",
    pathLabel: "Button path",
    resultLabel: "What happens next",
    notes: "Good to know",
    source: "Provider instructions",
    allGuides: "View all calendar guides",
    duration: "Time",
    method: "Method",
    where: "Where",
  },
  zh: {
    tutorials: "日历订阅教程",
    prerequisites: "开始前的准备",
    steps: "按以下步骤操作",
    stepLabel: "步骤",
    pathLabel: "按钮路径",
    resultLabel: "完成结果",
    notes: "注意事项",
    source: "服务商官方说明",
    allGuides: "查看全部日历教程",
    duration: "耗时",
    method: "方式",
    where: "完成位置",
  },
} as const;

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

  const title = `${tutorial.title} | sports-calendar.com`;
  const alternates = toAlternates(lang, (entry) => toTutorialPath(entry, tutorial.slug));

  return {
    title,
    description: tutorial.description,
    alternates,
    ...buildSocialMetadata({
      canonicalPath: alternates.canonical,
      description: tutorial.description,
      imageAlt: tutorial.title,
      locale: lang,
      title,
    }),
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
  const copy = pageCopy[locale];
  const localePaths = Object.fromEntries(
    locales.map((entry) => [entry, toTutorialPath(entry, tutorial.slug)]),
  ) as Record<Locale, string>;
  const homeHref = toPath(locale);
  const tutorialsHref = toTutorialIndexPath(locale);

  return (
    <div>
      <header className="mx-auto w-full max-w-[1200px] bg-header text-white">
        <div className="flex items-center justify-between gap-4 px-4 py-5 sm:px-6 lg:px-8">
          <Link className="block" href={homeHref}>
            <span className="block text-sm text-white/58">{t("siteName")}</span>
            <span className="mt-1 block text-lg font-medium text-white">{copy.tutorials}</span>
          </Link>
          <LanguageSwitcher localePaths={localePaths} />
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1200px] bg-panel px-5 py-7 text-ink sm:px-6 lg:py-10">
        <div className="mx-auto max-w-[960px]">
          <nav className="mb-5 flex flex-wrap items-center gap-2 text-sm text-ink/70">
            <Link className="underline underline-offset-2 hover:text-ink" href={homeHref}>
              {t("siteName")}
            </Link>
            <span>/</span>
            <Link className="underline underline-offset-2 hover:text-ink" href={tutorialsHref}>
              {copy.tutorials}
            </Link>
            <span>/</span>
            <span>{tutorial.service}</span>
          </nav>

          <section className="overflow-hidden rounded-[2rem] border border-ink/10 bg-white/80 p-7 shadow-panel sm:p-10">
            <div className="flex items-start gap-4">
              <TutorialMark tutorial={tutorial} />
              <div>
                <p className="text-sm font-medium text-ink/58">
                  {tutorial.service} · {tutorial.device}
                </p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-5xl sm:leading-[1.08]">
                  {tutorial.title}
                </h1>
              </div>
            </div>

            <p className="mt-6 max-w-[760px] text-base leading-7 text-ink/76 sm:text-lg sm:leading-8">
              {tutorial.intro}
            </p>

            <dl className="mt-7 grid gap-3 border-t border-ink/10 pt-6 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-ink/50">{copy.duration}</dt>
                <dd className="mt-1 font-medium text-ink">{tutorial.duration}</dd>
              </div>
              <div>
                <dt className="text-ink/50">{copy.method}</dt>
                <dd className="mt-1 font-medium text-ink">{tutorial.linkType}</dd>
              </div>
              <div>
                <dt className="text-ink/50">{copy.where}</dt>
                <dd className="mt-1 font-medium text-ink">{tutorial.availability}</dd>
              </div>
            </dl>
          </section>

          <section className="mt-7 rounded-3xl border border-ink/10 bg-header p-6 text-white sm:p-8">
            <h2 className="text-xl font-semibold">{copy.prerequisites}</h2>
            <ul className="mt-4 grid gap-3">
              {tutorial.prerequisites.map((item) => (
                <li className="flex gap-3 text-sm leading-6 text-white/75" key={item}>
                  <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-panel" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-9">
            <h2 className="text-2xl font-semibold tracking-tight text-ink">{copy.steps}</h2>
            <div className="mt-5 grid gap-5">
              {tutorial.steps.map((step, index) => (
                <article className="rounded-3xl border border-ink/10 bg-white/84 p-6 shadow-sm sm:p-7" key={step.title}>
                  <div className="flex items-start gap-4">
                    <span className="inline-flex h-10 min-w-10 shrink-0 items-center justify-center rounded-2xl bg-header px-3 text-sm font-semibold text-white">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink/45">
                        {copy.stepLabel} {index + 1}
                      </p>
                      <h3 className="mt-1 text-xl font-semibold tracking-tight text-ink">{step.title}</h3>
                      <p className="mt-3 text-sm leading-6 text-ink/72 sm:text-base sm:leading-7">{step.body}</p>
                    </div>
                  </div>

                  <div className="mt-6 rounded-2xl bg-shell/75 p-4 sm:ml-14 sm:p-5">
                    <TutorialPath label={copy.pathLabel} path={step.path} />
                    <div className="mt-4 border-t border-ink/10 pt-4 text-sm leading-6">
                      <span className="font-semibold text-ink">{copy.resultLabel}：</span>
                      <span className="text-ink/70">{step.result}</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="mt-7 grid gap-5 md:grid-cols-[1fr_0.72fr]">
            <article className="rounded-3xl border border-amber-700/15 bg-amber-50/90 p-6 text-amber-950 sm:p-7">
              <h2 className="text-xl font-semibold">{copy.notes}</h2>
              <ul className="mt-4 grid gap-3">
                {tutorial.notes.map((note) => (
                  <li className="flex gap-3 text-sm leading-6 text-amber-950/75" key={note}>
                    <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-700/60" />
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            </article>

            <article className="flex flex-col rounded-3xl border border-ink/10 bg-white/75 p-6 sm:p-7">
              <h2 className="text-xl font-semibold text-ink">{copy.source}</h2>
              <p className="mt-3 text-sm leading-6 text-ink/65">{tutorial.source.label}</p>
              <a
                className="mt-5 inline-flex min-h-11 items-center justify-between rounded-2xl border border-header/20 bg-white px-4 py-3 text-sm font-semibold text-header transition hover:bg-header/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-header md:mt-auto"
                href={tutorial.source.href}
                rel="noreferrer"
                target="_blank"
              >
                <span>{copy.source}</span>
                <span aria-hidden="true">↗</span>
              </a>
            </article>
          </section>

          <p className="mt-8 text-center">
            <Link className="text-sm font-semibold text-header underline underline-offset-4 hover:text-header/75" href={tutorialsHref}>
              ← {copy.allGuides}
            </Link>
          </p>
        </div>
      </main>

      <footer className="mx-auto w-full max-w-[1200px] bg-header text-white">
        <div className="flex flex-col gap-4 px-4 py-6 text-sm text-white/80 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <div className="flex flex-col gap-2">
            <span>{t("siteName")}</span>
            <span>{tutorial.service} · {tutorial.device}</span>
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
