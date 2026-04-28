export function formatSeasonDisplay(seasonSlug: string, seasonLabel: string) {
  const candidate = seasonLabel.trim() || seasonSlug.trim();
  const yearRangeMatch = candidate.match(/^(\d{4})[-/](\d{2}|\d{4})$/);

  if (!yearRangeMatch) {
    return candidate;
  }

  const [, startYear, rawEndYear] = yearRangeMatch;
  const endYear = rawEndYear.length === 4 ? rawEndYear.slice(-2) : rawEndYear;
  return `${startYear}/${endYear}`;
}
