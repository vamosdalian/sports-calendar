package syncer

import (
	"context"
	"strings"
	"unicode"

	"github.com/vamosdalian/sports-calendar/backend/internal/domain"
)

// SnapshotFetcher fetches a league's fixtures/teams for a sync run. The spider
// (Transfermarkt crawler) is the only implementation.
type SnapshotFetcher interface {
	FetchLeagueSnapshot(ctx context.Context, target domain.LeagueSyncTarget) (domain.LeagueSnapshot, error)
}

// englishText wraps a plain string as an English-only localized value, or an
// empty map when blank.
func englishText(value string) domain.LocalizedText {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return emptyLocalizedText()
	}
	return domain.LocalizedText{"en": trimmed}
}

func emptyLocalizedText() domain.LocalizedText {
	return domain.LocalizedText{}
}

// slugify lowercases value and collapses every run of non-alphanumeric
// characters into a single dash, falling back to fallback when the result is
// empty.
func slugify(value, fallback string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return strings.ToLower(strings.TrimSpace(fallback))
	}

	var builder strings.Builder
	lastDash := false
	for _, char := range strings.ToLower(trimmed) {
		switch {
		case unicode.IsLetter(char) || unicode.IsDigit(char):
			builder.WriteRune(char)
			lastDash = false
		case !lastDash:
			builder.WriteByte('-')
			lastDash = true
		}
	}

	slug := strings.Trim(builder.String(), "-")
	if slug != "" {
		return slug
	}
	return strings.ToLower(strings.TrimSpace(fallback))
}
