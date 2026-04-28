"use client";

import { useEffect } from "react";

import { useRouter } from "next/navigation";

type LegacyLeagueRedirectProps = {
  leagueRoutes: Record<string, string>;
};

export function LegacyLeagueRedirect({ leagueRoutes }: LegacyLeagueRedirectProps) {
  const router = useRouter();

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const league = searchParams.get("league");
    if (!league) {
      return;
    }

    const target = leagueRoutes[league];
    if (!target) {
      return;
    }

    const nextSearchParams = new URLSearchParams(searchParams.toString());
    nextSearchParams.delete("league");

    const query = nextSearchParams.toString();
    router.replace(query ? `${target}?${query}` : target);
  }, [leagueRoutes, router]);

  return null;
}
