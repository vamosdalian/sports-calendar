import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";

import { routing } from "./i18n/routing";
import { isLocale, localeCookieName, toPath, toTeamPath, type Locale } from "./lib/site";

const intlMiddleware = createMiddleware(routing);

export default function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const cookieLocale = getCookieLocale(request);
  const localeFromPath = getLocaleFromPath(pathname);

  if (localeFromPath) {
    const legacyTeamRedirect = redirectLegacyTeamFilter(request, localeFromPath);
    if (legacyTeamRedirect) {
      return syncLocaleCookie(request, legacyTeamRedirect, localeFromPath);
    }

    return syncLocaleCookie(request, intlMiddleware(request), localeFromPath);
  }

  if (cookieLocale) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = pathname === "/" ? toPath(cookieLocale) : `/${cookieLocale}${pathname}`;
    return syncLocaleCookie(request, NextResponse.redirect(redirectUrl), cookieLocale);
  }

  if (pathname === "/") {
    return NextResponse.next();
  }

  return intlMiddleware(request);
}

/**
 * Send the old `?team=` filter URLs to the team's own page.
 *
 * Team fixtures used to be a client-side filter on the season page behind a
 * query string. Those links are already shared and bookmarked, so they get a
 * permanent redirect rather than being dropped — and redirecting also stops the
 * query-string variant from serving the same content as the team page, which
 * would read as duplicate content.
 *
 * This lives in middleware on purpose. Reading searchParams inside the season
 * page would opt it out of static rendering and force a full server render on
 * every request — the same thing that put the Worker over its resource limit
 * once already.
 */
function redirectLegacyTeamFilter(request: NextRequest, locale: Locale) {
  const teamSlug = request.nextUrl.searchParams.get("team");
  if (!teamSlug) {
    return null;
  }

  // Only the season page carries this parameter: /<locale>/<sport>/<league>/<season>
  const segments = request.nextUrl.pathname.split("/").filter(Boolean);
  if (segments.length !== 4) {
    return null;
  }

  const [, sport, league, season] = segments;
  const target = request.nextUrl.clone();
  target.pathname = toTeamPath(locale, sport, league, season, teamSlug);
  // Keep any other parameters (time zone, campaign tags) but drop the one the
  // path now expresses.
  target.searchParams.delete("team");

  return NextResponse.redirect(target, 301);
}

function getCookieLocale(request: NextRequest): Locale | null {
  const value = request.cookies.get(localeCookieName)?.value;
  return value && isLocale(value) ? value : null;
}

function getLocaleFromPath(pathname: string): Locale | null {
  const segment = pathname.split("/").filter(Boolean)[0];
  return segment && isLocale(segment) ? segment : null;
}

function syncLocaleCookie(request: NextRequest, response: NextResponse, locale: Locale) {
  response.cookies.set(localeCookieName, locale, {
    path: request.nextUrl.basePath || "/",
    sameSite: "lax",
  });

  return response;
}

export const config = {
  // Match all paths except Next.js internals and static files (anything with a dot extension)
  matcher: ["/((?!_next|_vercel|.*\\..*).*)"],
};
