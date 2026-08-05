package service

import "testing"

func TestValidateLeagueProviderRef(t *testing.T) {
	tests := []struct {
		name        string
		provider    string
		externalRef string
		wantError   bool
	}{
		{name: "spider with external ref", provider: "spider", externalRef: "GB1", wantError: false},
		{name: "spider without external ref", provider: "spider", wantError: true},
		{name: "manual without external ref", provider: "manual", wantError: false},
		{name: "unknown provider", provider: "unknown", wantError: true},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			err := validateLeagueProviderRef(test.provider, test.externalRef)
			if (err != nil) != test.wantError {
				t.Fatalf("validateLeagueProviderRef() error = %v, wantError = %v", err, test.wantError)
			}
		})
	}
}

func TestNormalizeLeagueProviderDefaultsToSpider(t *testing.T) {
	if got := normalizeLeagueProvider("  "); got != "spider" {
		t.Fatalf("normalizeLeagueProvider() = %q, want spider", got)
	}
	if got := normalizeLeagueProvider(" MANUAL "); got != "manual" {
		t.Fatalf("normalizeLeagueProvider() = %q, want manual", got)
	}
}
