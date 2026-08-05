package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadDefaultsRateLimitTo128QPS(t *testing.T) {
	path := filepath.Join(t.TempDir(), "config.yaml")
	content := []byte(`
database:
  host: localhost
  dbname: sports_calendar
  user: sports_calendar
adminAuth:
  secret: test-secret
`)
	if err := os.WriteFile(path, content, 0o600); err != nil {
		t.Fatalf("write config: %v", err)
	}

	cfg, err := Load(path)
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	if cfg.RateLimit.RequestsPerSecond != 128 {
		t.Fatalf("requestsPerSecond = %v, want 128", cfg.RateLimit.RequestsPerSecond)
	}
	if cfg.RateLimit.Burst != 256 {
		t.Fatalf("burst = %d, want 256", cfg.RateLimit.Burst)
	}
}
