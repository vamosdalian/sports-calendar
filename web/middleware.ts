import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";

import { routing } from "./i18n/routing";
import { isLocale, localeCookieName, toPath, type Locale } from "./lib/site";

const intlMiddleware = createMiddleware(routing);

export default function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const cookieLocale = getCookieLocale(request);
  const localeFromPath = getLocaleFromPath(pathname);

  if (localeFromPath) {
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
