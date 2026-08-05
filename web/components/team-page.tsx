import type { ReactNode } from "react";

import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import {
  formatMatchLocation,
  getCurrentSeasonSlug,
  getLeagueFeedUrl,
  getLeagueSubscriptionUrl,
  getPublicApiBaseUrl,
  getTeamPageData,
  matchLabel,
  type Match,
} from "../lib/catalog";
import { formatSeasonDisplay } from "../lib/season";
import { locales, siteUrl, toPath, toTeamPath, toTutorialPath, type Locale } from "../lib/site";
import { LanguageSwitcher } from "./language-switcher";
import { LocalizedMatchTime } from "./localized-match-time";
import { MatchFixtureLabel } from "./match-fixture-label";
import { TeamMatchList } from "./team-match-list";
import { TeamSubscribeBar } from "./team-subscribe-bar";
import { TimeZoneSelector } from "./time-zone-selector";

type TeamPageProps = {
  locale: Locale;
  sportSlug: string;
  leagueSlug: string;
  seasonSlug: string;
  teamSlug: string;
};

export async function TeamPage({ locale, sportSlug, leagueSlug, seasonSlug, teamSlug }: TeamPageProps) {
  const result = await getTeamPageData(sportSlug, leagueSlug, seasonSlug, teamSlug, locale);
  if (result.kind === "season-not-found") {
    // Same reasoning as the season page: a season that stopped resolving was
    // most likely hidden when the next one opened. Aim at this team's page in
    // the current season rather than the season index — a supporter following
    // an old link wants their own fixtures. If the team is gone too (relegated,
    // renamed), that page redirects on to the season page under team-not-found.
    const currentSeason = await getCurrentSeasonSlug(sportSlug, leagueSlug, locale);
    if (currentSeason && currentSeason !== seasonSlug) {
      permanentRedirect(toTeamPath(locale, sportSlug, leagueSlug, currentSeason, teamSlug));
    }

    notFound();
  }
  if (result.kind === "team-not-found") {
    // The season exists but this team does not — almost always a slug that went
    // stale after a data-source switch. Send those already-shared links to the
    // season page, which still answers the question, rather than a dead end.
    permanentRedirect(toPath(locale, sportSlug, leagueSlug, seasonSlug));
  }

  const data = result.data;
  const t = await getTranslations({ locale });
  const seasonLabel = formatSeasonDisplay(data.season.slug, data.season.label);
  const teamName = data.team.name;
  const leagueName = data.league.name;
  const pageTitle = t("teamTitle", { teamName, seasonLabel });
  // Everything below names the team with the catalog's own spelling rather
  // than the incoming param, so the canonical URL, the internal links and the
  // feed URL agree no matter what form the request arrived in.
  const canonicalTeamSlug = data.team.slug;
  const canonicalUrl = `${siteUrl}${toTeamPath(locale, sportSlug, leagueSlug, seasonSlug, canonicalTeamSlug)}`;
  const localePaths = Object.fromEntries(
    locales.map((entry) => [entry, toTeamPath(entry, sportSlug, leagueSlug, seasonSlug, canonicalTeamSlug)]),
  ) as Record<Locale, string>;

  // The team-scoped feed the backend already supports; no new endpoint needed.
  // Season-less on purpose, so the subscription survives season rollovers.
  const subscriptionUrl = getLeagueSubscriptionUrl(sportSlug, leagueSlug, {
    locale,
    teamSlug: canonicalTeamSlug,
  });
  const subscriptionCopyUrl = getLeagueFeedUrl(sportSlug, leagueSlug, {
    locale,
    teamSlug: canonicalTeamSlug,
  });
  const leaguePath = toPath(locale, sportSlug, leagueSlug, seasonSlug);
  const nextMatch = findNextMatch(data.season.matches);
  const structuredData = buildTeamStructuredData({
    canonicalUrl,
    description: t("metaDescriptionTeam", { teamName, leagueName, seasonLabel }),
    leagueName,
    leagueUrl: `${siteUrl}${leaguePath}`,
    locale,
    matches: data.season.matches,
    pageTitle,
    sportName: data.sport.name,
    teamName,
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

      <main className="mx-auto w-full max-w-[1200px]">
        <section className="bg-panel px-5 py-6 text-ink sm:px-6 lg:rounded-panel lg:py-8">
          <nav aria-label="Breadcrumb" className="text-sm text-ink/60">
            <Link className="underline underline-offset-2 transition hover:text-ink" href={leaguePath}>
              {leagueName} {seasonLabel}
            </Link>
            <span className="mx-2 text-ink/40">/</span>
            <span className="text-ink/80">{teamName}</span>
          </nav>

          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{pageTitle}</h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-ink/75">
            {t("teamSubscribeLead", { teamName })}
          </p>

          <div className="mt-5">
            <TeamSubscribeBar
              copySubscriptionLinkLabel={t("copySubscriptionLinkLabel")}
              subscribeLabel={t("subscribeLabel")}
              subscriptionCopyUrl={subscriptionCopyUrl}
              subscriptionLinkCopiedLabel={t("subscriptionLinkCopiedLabel")}
              subscriptionUrl={subscriptionUrl}
            />
          </div>

          {nextMatch ? (
            <div className="mt-6 rounded-2xl bg-white/45 px-4 py-3">
              <span className="text-xs font-medium uppercase tracking-wide text-ink/55">
                {t("nextMatchLabel")}
              </span>
              <div className="mt-1 flex flex-col gap-1 text-sm sm:flex-row sm:items-center">
                <LocalizedMatchTime
                  className="font-medium text-ink"
                  startsAt={nextMatch.startsAt}
                  kickoffTimeTBD={nextMatch.kickoffTimeTBD}
                  matchDate={nextMatch.matchDate}
                  locale={locale}
                />
                <span className="hidden text-ink/45 sm:inline sm:mx-2">/</span>
                <span className="text-ink/75">
                  <MatchFixtureLabel match={nextMatch} teamSlug={canonicalTeamSlug} />
                </span>
              </div>
            </div>
          ) : null}

          <TeamMatchList
            apiBaseUrl={getPublicApiBaseUrl()}
            countLabel={t("teamMatchCountLabel", { count: data.season.matches.length })}
            emptyLabel={t("noMatches")}
            leagueSlug={leagueSlug}
            locale={locale}
            matches={data.season.matches}
            seasonSlug={seasonSlug}
            sportSlug={sportSlug}
            teamSlug={canonicalTeamSlug}
            title={t("teamFixturesLabel")}
          />

          <InfoSection title={t("otherTeamsLabel", { leagueName })}>
            <ul className="flex flex-wrap gap-2 text-sm">
              {data.otherTeams.map((team) => (
                <li key={team.slug}>
                  <Link
                    className="inline-flex rounded-full bg-white/45 px-3 py-1.5 text-ink/80 transition hover:bg-white/70"
                    href={toTeamPath(locale, sportSlug, leagueSlug, seasonSlug, team.slug)}
                  >
                    {team.name}
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-4">
              <Link
                className="text-sm text-blue-700 underline underline-offset-2 transition hover:text-blue-800"
                href={leaguePath}
              >
                {t("backToLeagueLabel", { leagueName })}
              </Link>
            </p>
          </InfoSection>

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
            <span>{teamName} · {leagueName} · {data.season.label}</span>
          </div>
          <div className="flex flex-col gap-3 text-left md:ml-auto md:items-end md:text-right">
            <TimeZoneSelector browserDefaultLabel={t("browserDefaultLabel")} />
            <div>
              <span>{t("contactUsLabel")}: </span>
              <Link
                aria-label={t("contactEmailAriaLabel")}
                className="font-medium text-white underline underline-offset-2 transition hover:text-white/80"
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

function findNextMatch(matches: Match[]) {
  const now = Date.now();
  return (
    [...matches]
      .filter((match) => match.status === "scheduled" && new Date(match.startsAt).getTime() >= now)
      .sort((left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime())[0] ?? null
  );
}

function buildTeamStructuredData({
  canonicalUrl,
  description,
  leagueName,
  leagueUrl,
  locale,
  matches,
  pageTitle,
  sportName,
  teamName,
}: {
  canonicalUrl: string;
  description: string;
  leagueName: string;
  leagueUrl: string;
  locale: Locale;
  matches: Match[];
  pageTitle: string;
  sportName: string;
  teamName: string;
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
            name: leagueName,
            item: leagueUrl,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: teamName,
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
          "@type": "SportsTeam",
          name: teamName,
          sport: sportName,
          memberOf: {
            "@type": "SportsOrganization",
            name: leagueName,
          },
        },
        mainEntity: {
          "@type": "ItemList",
          name: pageTitle,
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
    eventStatus:
      match.status === "cancelled"
        ? "https://schema.org/EventCancelled"
        : match.status === "postponed"
          ? "https://schema.org/EventPostponed"
          : "https://schema.org/EventScheduled",
    sport: sportName,
    ...(location ? { location: { "@type": "Place", name: location } } : {}),
    ...(match.homeTeam && match.awayTeam
      ? {
          competitor: [
            { "@type": "SportsTeam", name: match.homeTeam.name },
            { "@type": "SportsTeam", name: match.awayTeam.name },
          ],
        }
      : {}),
  };
}
