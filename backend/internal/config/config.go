package config

import (
	"fmt"
	"net/url"
	"os"

	"gopkg.in/yaml.v3"
)

type Config struct {
	Server      ServerConfig      `yaml:"server"`
	RateLimit   RateLimitConfig   `yaml:"rateLimit"`
	Database    DatabaseConfig    `yaml:"database"`
	TheSportsDB TheSportsDBConfig `yaml:"theSportsDB"`
	AdminAuth   AdminAuthConfig   `yaml:"adminAuth"`
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

type TheSportsDBConfig struct {
	BaseURL        string `yaml:"baseURL"`
	APIKey         string `yaml:"apiKey"`
	TimeoutSeconds int    `yaml:"timeoutSeconds"`
}

type AdminAuthConfig struct {
	Secret         string `yaml:"secret"`
	TokenTTLMinute int    `yaml:"tokenTTLMinutes"`
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
		cfg.RateLimit.RequestsPerSecond = 8
	}
	if cfg.RateLimit.Burst <= 0 {
		cfg.RateLimit.Burst = 16
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

	if cfg.TheSportsDB.BaseURL == "" {
		cfg.TheSportsDB.BaseURL = "https://www.thesportsdb.com"
	}
	if cfg.TheSportsDB.TimeoutSeconds <= 0 {
		cfg.TheSportsDB.TimeoutSeconds = 15
	}
	if cfg.TheSportsDB.APIKey == "" {
		return Config{}, fmt.Errorf("theSportsDB apiKey is required")
	}
	if cfg.AdminAuth.Secret == "" {
		return Config{}, fmt.Errorf("adminAuth secret is required")
	}
	if cfg.AdminAuth.TokenTTLMinute <= 0 {
		cfg.AdminAuth.TokenTTLMinute = 30
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
