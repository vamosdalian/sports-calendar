package config

import (
	"fmt"
	"net/url"
	"os"
	"strings"

	"gopkg.in/yaml.v3"
)

type Config struct {
	Server    ServerConfig    `yaml:"server"`
	RateLimit RateLimitConfig `yaml:"rateLimit"`
	Database  DatabaseConfig  `yaml:"database"`
	AdminAuth AdminAuthConfig `yaml:"adminAuth"`
	Spider    SpiderConfig    `yaml:"spider"`
	Site      SiteConfig      `yaml:"site"`
	Analytics AnalyticsConfig `yaml:"analytics"`
}

// AnalyticsConfig controls ICS fetch analytics. SubscriberSalt is mixed into
// the pseudonymous subscriber digest so a stored hash cannot be brute-forced
// back to an IP address. It must stay stable across restarts: changing it
// makes every returning client look new and resets distinct-subscriber counts.
// When omitted it is derived from the admin auth secret, which is already
// persistent and deployment-specific.
type AnalyticsConfig struct {
	Enabled        *bool  `yaml:"enabled"`
	SubscriberSalt string `yaml:"subscriberSalt"`
}

// IsEnabled reports whether fetch analytics should run. Absent config means on.
func (c AnalyticsConfig) IsEnabled() bool {
	return c.Enabled == nil || *c.Enabled
}

// SiteConfig points generated content back at the public web app. WebBaseURL is
// where an expired team feed sends subscribers to re-subscribe, so it must be
// the address users actually browse, not the API host.
type SiteConfig struct {
	WebBaseURL string `yaml:"webBaseURL"`
}

type ServerConfig struct {
	Port int `yaml:"port"`
}

type RateLimitConfig struct {
	RequestsPerSecond float64 `yaml:"requestsPerSecond"`
	Burst             int     `yaml:"burst"`
}

type DatabaseConfig struct {
	Host     string `yaml:"host"`
	Port     int    `yaml:"port"`
	DBName   string `yaml:"dbname"`
	User     string `yaml:"user"`
	Password string `yaml:"password"`
	SSLMode  string `yaml:"sslmode"`
}

type AdminAuthConfig struct {
	Secret         string `yaml:"secret"`
	TokenTTLMinute int    `yaml:"tokenTTLMinutes"`
}

// SpiderConfig points at the sports-spider (Transfermarkt crawler) backend.
// It plays two roles: the only automatic sync data source and the target of
// the admin-only reverse proxy. UpstreamURL is required --
// main() refuses to start without it, because there would be nothing to sync
// from. The crawler is never exposed publicly; the admin console reaches it only
// through the authenticated /api/spider/* proxy. TimeoutSeconds bounds each HTTP
// call the sync fetcher makes to it.
type SpiderConfig struct {
	UpstreamURL    string `yaml:"upstreamURL"`
	TimeoutSeconds int    `yaml:"timeoutSeconds"`
}

func Load(path string) (Config, error) {
	content, err := os.ReadFile(path)
	if err != nil {
		return Config{}, fmt.Errorf("read config: %w", err)
	}

	var cfg Config
	if err := yaml.Unmarshal(content, &cfg); err != nil {
		return Config{}, fmt.Errorf("decode config: %w", err)
	}

	if cfg.Server.Port == 0 {
		cfg.Server.Port = 8080
	}
	if cfg.RateLimit.RequestsPerSecond <= 0 {
		cfg.RateLimit.RequestsPerSecond = 128
	}
	if cfg.RateLimit.Burst <= 0 {
		cfg.RateLimit.Burst = 256
	}

	if cfg.Database.Port == 0 {
		cfg.Database.Port = 5432
	}
	if cfg.Database.SSLMode == "" {
		cfg.Database.SSLMode = "disable"
	}
	if cfg.Database.Host == "" || cfg.Database.DBName == "" || cfg.Database.User == "" {
		return Config{}, fmt.Errorf("database host, dbname, and user are required")
	}

	if cfg.Spider.TimeoutSeconds <= 0 {
		cfg.Spider.TimeoutSeconds = 30
	}
	if cfg.AdminAuth.Secret == "" {
		return Config{}, fmt.Errorf("adminAuth secret is required")
	}
	if cfg.AdminAuth.TokenTTLMinute <= 0 {
		cfg.AdminAuth.TokenTTLMinute = 30
	}
	if cfg.Site.WebBaseURL == "" {
		cfg.Site.WebBaseURL = "https://sports-calendar.com"
	}
	cfg.Site.WebBaseURL = strings.TrimRight(cfg.Site.WebBaseURL, "/")

	if cfg.Analytics.SubscriberSalt == "" {
		// Derive from the admin secret rather than generating randomly: a
		// random salt would change on every restart and silently reset the
		// distinct-subscriber counts.
		cfg.Analytics.SubscriberSalt = "ics-analytics:" + cfg.AdminAuth.Secret
	}

	return cfg, nil
}

func (c DatabaseConfig) ConnectionString() string {
	query := url.Values{}
	query.Set("sslmode", c.SSLMode)

	uri := &url.URL{
		Scheme:   "postgres",
		User:     url.UserPassword(c.User, c.Password),
		Host:     fmt.Sprintf("%s:%d", c.Host, c.Port),
		Path:     c.DBName,
		RawQuery: query.Encode(),
	}
	return uri.String()
}
