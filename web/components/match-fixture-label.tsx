import { matchLabel, matchLabelParts, type Match } from "../lib/catalog";

type MatchFixtureLabelProps = {
  match: Match;
  teamSlug: string;
};

/**
 * A fixture line with one team's name in bold. Team pages used to tag every row
 * with a home/away badge; the fixture already reads home-first, so emphasising
 * the team whose page this is carries the same information without the badge.
 */
export function MatchFixtureLabel({ match, teamSlug }: MatchFixtureLabelProps) {
  const parts = matchLabelParts(match);
  if (!parts) {
    return <>{matchLabel(match)}</>;
  }

  const emphasis = "font-semibold text-ink";
  return (
    <>
      <span className={parts.homeTeam.slug === teamSlug ? emphasis : undefined}>
        {parts.homeTeam.name}
      </span>
      {` ${parts.separator} `}
      <span className={parts.awayTeam.slug === teamSlug ? emphasis : undefined}>
        {parts.awayTeam.name}
      </span>
    </>
  );
}
