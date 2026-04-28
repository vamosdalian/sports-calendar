import type { ReactNode } from "react";

import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { formatMatchLocation, getLeagueSeasons, getLeagues, getSeasonFeedUrl, getSeasonPageData, getSeasonSubscriptionUrl, matchLabel, type Match, type Team } from "../lib/catalog";
import { formatSeasonDisplay } from "../lib/season";
import { locales, siteUrl, type Locale, toPath, toTutorialPath } from "../lib/site";
import { LanguageSwitcher } from "./language-switcher";
import { LeagueSeasonNav } from "./league-season-nav";
import { SeasonCalendarContent } from "./season-calendar-content";
import { TimeZoneSelector } from "./time-zone-selector";

type SeasonPageProps = {
  locale: Locale;
  sportSlug: string;
  leagueSlug: string;
  seasonSlug: string;
};

export async function SeasonPage({ locale, sportSlug, leagueSlug, seasonSlug }: SeasonPageProps) {
  const data = await getSeasonPageData(sportSlug, leagueSlug, seasonSlug, locale);
  if (!data) {
    notFound();
  }

  const t = await getTranslations({ locale });
  const localePaths = Object.fromEntries(
    locales.map((entry) => [entry, toPath(entry, sportSlug, leagueSlug, seasonSlug)]),
  ) as Record<Locale, string>;
  const [directory, seasonsData] = await Promise.all([
    getLeagues(locale),
    getLeagueSeasons(sportSlug, leagueSlug, locale),
  ]);
  if (!seasonsData) {
    notFound();
  }

  const competitionLabel = t("competitionLabel");
  const seasonNavLabel = t("seasonLabel");
  const competitions = directory.items.flatMap((sport) =>
    sport.leagues.map((league) => ({
      key: `${sport.sportSlug}-${league.leagueSlug}`,
      name: league.leagueName,
      href: toPath(
        locale,
        sport.sportSlug,
        league.leagueSlug,
        league.defaultSeason?.slug ?? seasonSlug,
      ),
      active: sport.sportSlug === sportSlug && league.leagueSlug === leagueSlug,
    })),
  );
  const seasons = seasonsData.seasons.map((season) => ({
    key: season.slug,
    name: season.label,
    href: toPath(locale, sportSlug, leagueSlug, season.slug),
    active: season.slug === seasonSlug,
  }));
  const leagueName = data.league.name;
  const seasonLabel = formatSeasonDisplay(data.season.slug, data.season.label);
  const pageTitle = t("seasonTitle", { leagueName, seasonLabel });
  const weekLabels = t.raw("weekDays") as string[];
  const subscriptionUrl = getSeasonSubscriptionUrl(sportSlug, leagueSlug, seasonSlug, { locale });
  const subscriptionCopyUrl = getSeasonFeedUrl(sportSlug, leagueSlug, seasonSlug, { locale });
  const teamOptions = buildTeamOptions(data.season.matches, locale);
  const notes = data.season.notes.trim();
  const canonicalUrl = `${siteUrl}${toPath(locale, sportSlug, leagueSlug, seasonSlug)}`;
  const structuredData = buildSeasonStructuredData({
    canonicalUrl,
    description: data.season.calendarDescription,
    leagueName: data.league.name,
    locale,
    matches: data.season.matches,
    pageTitle,
    sportName: data.sport.name,
  });

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <header className="mx-auto w-full max-w-[1200px] bg-header text-white">
        <div className="flex items-center justify-between gap-4 px-4 py-5 sm:px-6 lg:px-8">
          <Link className="block" href={toPath(locale)}>
            <span className="block text-sm text-white/58">{t("siteName")}</span>
            <span className="mt-1 block text-lg font-medium text-white">{t("homeTitle")}</span>
          </Link>
          <LanguageSwitcher localePaths={localePaths} />
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1200px] grid gap-0 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="bg-aside px-5 py-6 text-ink sm:px-6 lg:rounded-l-panel lg:py-8">
          <LeagueSeasonNav
            competitionLabel={competitionLabel}
            competitions={competitions}
            seasonLabel={seasonNavLabel}
            seasons={seasons}
          />
        </aside>

        <section className="bg-panel px-5 py-6 text-ink sm:px-6 lg:rounded-r-panel lg:py-8">
          <SeasonCalendarContent
            allTeamsLabel={t("allTeamsLabel")}
            leagueCalendarLabel={t("leagueCalendarLabel")}
            locale={locale}
            matches={data.season.matches}
            noMatchesLabel={t("noMatches")}
            copySubscriptionLinkLabel={t("copySubscriptionLinkLabel")}
            seasonSlug={data.season.slug}
            subscribeLabel={t("subscribeLabel")}
            subscriptionBaseUrl={subscriptionUrl}
            subscriptionCopyBaseUrl={subscriptionCopyUrl}
            subscriptionLinkCopiedLabel={t("subscriptionLinkCopiedLabel")}
            pageTitle={pageTitle}
            teamFilterLabel={t("teamFilterLabel")}
            teamOptions={teamOptions}
            weekLabels={weekLabels}
          />

          <InfoSection title={t("leagueDescriptionLabel")}>
            <p className="text-base leading-7 text-ink/75">{data.season.calendarDescription}</p>
          </InfoSection>

          {notes ? (
            <InfoSection title={t("notesLabel")}>
              <p className="text-base leading-7 text-ink/75">{notes}</p>
            </InfoSection>
          ) : null}

          <InfoSection title={t("otherLabel")}>
              <Link
                className="text-sm text-blue-700 underline underline-offset-2 transition hover:text-blue-800"
                href={toTutorialPath(locale, "how-to-subscribe-ios")}
              >
                {t("iosTutorialLinkLabel")}
              </Link>
          </InfoSection>
        </section>
      </main>

      <footer className="mx-auto w-full max-w-[1200px] bg-header text-white">
        <div className="flex flex-col gap-4 px-4 py-6 text-sm text-white/80 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <div className="flex flex-col gap-2">
            <span>{t("siteName")}</span>
            <span>{data.league.name} · {data.season.label}</span>
          </div>
          <div className="flex flex-col gap-3 text-left md:ml-auto md:items-end md:text-right">
            <TimeZoneSelector
              browserDefaultLabel={t("browserDefaultLabel")}
            />
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

function InfoSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-6 bg-transparent p-0">
      <h2 className="bg-aside px-5 py-3 text-sm font-medium text-ink/80">{title}</h2>
      <div className="pt-4">{children}</div>
    </section>
  );
}

function buildTeamOptions(matches: Match[], locale: Locale) {
  const teamsBySlug = new Map<string, string>();

  for (const match of matches) {
    if (match.homeTeam?.slug && match.homeTeam.name) {
      teamsBySlug.set(match.homeTeam.slug, match.homeTeam.name);
    }
    if (match.awayTeam?.slug && match.awayTeam.name) {
      teamsBySlug.set(match.awayTeam.slug, match.awayTeam.name);
    }
  }

  const collator = new Intl.Collator(locale, { sensitivity: "base" });
  return Array.from(teamsBySlug.entries(), ([slug, name]) => ({ slug, name })).sort((left, right) =>
    collator.compare(left.name, right.name),
  );
}

function buildSeasonStructuredData({
  canonicalUrl,
  description,
  leagueName,
  locale,
  matches,
  pageTitle,
  sportName,
}: {
  canonicalUrl: string;
  description: string;
  leagueName: string;
  locale: Locale;
  matches: Match[];
  pageTitle: string;
  sportName: string;
}) {
  const featuredMatches = matches.slice(0, 50);

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "sports-calendar.com",
            item: `${siteUrl}${toPath(locale)}`,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: pageTitle,
            item: canonicalUrl,
          },
        ],
      },
      {
        "@type": "CollectionPage",
        "@id": `${canonicalUrl}#collection`,
        url: canonicalUrl,
        name: pageTitle,
        description,
        inLanguage: locale,
        isPartOf: {
          "@type": "WebSite",
          "@id": `${siteUrl}/#website`,
          url: siteUrl,
          name: "sports-calendar.com",
        },
        about: {
          "@type": "SportsOrganization",
          name: leagueName,
          sport: sportName,
        },
        mainEntity: {
          "@type": "ItemList",
          name: `${pageTitle} fixtures`,
          numberOfItems: featuredMatches.length,
          itemListElement: featuredMatches.map((match, index) => ({
            "@type": "ListItem",
            position: index + 1,
            item: buildSportsEventStructuredData(match, sportName),
          })),
        },
      },
    ],
  };
}

function buildSportsEventStructuredData(match: Match, sportName: string) {
  const location = formatMatchLocation(match);

  return {
    "@type": "SportsEvent",
    name: matchLabel(match),
    startDate: match.startsAt,
    eventStatus: toEventStatus(match.status),
    sport: sportName,
    location: location
      ? {
          "@type": "Place",
          name: location,
          address: {
            "@type": "PostalAddress",
            addressLocality: match.city || undefined,
            addressCountry: match.country || undefined,
          },
        }
      : undefined,
    competitor: [match.homeTeam, match.awayTeam]
      .filter((team): team is Team => Boolean(team))
      .map((team) => ({
        "@type": "SportsTeam",
        name: team.name,
      })),
  };
}

function toEventStatus(status: string) {
  if (status === "finished") {
    return "https://schema.org/EventCompleted";
  }

  return "https://schema.org/EventScheduled";
}
