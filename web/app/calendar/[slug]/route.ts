import { NextResponse } from "next/server";

const DEFAULT_ICS_URL = "https://api.sports-calendar.com/ics/football/csl/2026/matches.ics";

export async function GET(_: Request, context: { params: Promise<{ slug: string }> }) {
  const params = await context.params;
  const slug = params.slug.toLowerCase();

  const league = inferLeagueFromLegacySlug(slug);
  if (!league) {
    return NextResponse.redirect(DEFAULT_ICS_URL, 302);
  }

  const target = `https://api.sports-calendar.com/ics/football/${league}/2026/matches.ics`;
  return NextResponse.redirect(target, 302);
}

function inferLeagueFromLegacySlug(slug: string): string | null {
  if (slug.startsWith("csl_")) {
    return "csl";
  }
  if (slug.startsWith("pl_")) {
    return "pl";
  }
  if (slug.startsWith("f1_")) {
    return "f1";
  }
  return null;
}
