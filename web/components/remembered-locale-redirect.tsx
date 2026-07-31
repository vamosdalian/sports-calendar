"use client";

import { useEffect } from "react";

import { useRouter } from "next/navigation";

import { defaultLocale, isLocale, localeCookieName, toPath } from "../lib/site";

/**
 * Sends a returning visitor who lands on `/` to the locale they last chose.
 *
 * The old middleware did this on the server, reading the cookie before the
 * response was built. A static export serves `/` as one prebuilt file to
 * everyone, so the check happens here instead — and only on `/`, never on the
 * explicit `/en/` and `/zh/` URLs, which are requests for a specific language.
 *
 * Crawlers do not carry the cookie, so they always index `/` as English, which
 * matches what the page actually contains.
 */
export function RememberedLocaleRedirect() {
  const router = useRouter();

  useEffect(() => {
    const match = document.cookie.match(new RegExp(`(?:^|; )${localeCookieName}=([^;]*)`));
    const remembered = match ? decodeURIComponent(match[1]) : null;

    if (!remembered || !isLocale(remembered) || remembered === defaultLocale) {
      return;
    }

    router.replace(toPath(remembered));
  }, [router]);

  return null;
}
