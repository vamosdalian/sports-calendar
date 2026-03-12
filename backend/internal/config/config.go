package config

import (
	"fmt"
	"net/url"
	"os"

	"gopkg.in/yaml.v3"
)

type Config struct {
	Server    ServerConfig    `yaml:"server"`
	RateLimit RateLimitConfig `yaml:"rateLimit"`
	Database  DatabaseConfig  `yaml:"database"`
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
