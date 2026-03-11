package config

import (
	"fmt"
	"os"
	"path/filepath"

	"gopkg.in/yaml.v3"
)

type Config struct {
	Server    ServerConfig    `yaml:"server"`
	RateLimit RateLimitConfig `yaml:"rateLimit"`
	Data      DataConfig      `yaml:"data"`
}

type ServerConfig struct {
	Port int `yaml:"port"`
}

type RateLimitConfig struct {
	RequestsPerSecond float64 `yaml:"requestsPerSecond"`
	Burst             int     `yaml:"burst"`
}

type DataConfig struct {
	MockFile string `yaml:"mockFile"`
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

	configDir := filepath.Dir(path)
	if cfg.Data.MockFile != "" && !filepath.IsAbs(cfg.Data.MockFile) {
		cfg.Data.MockFile = filepath.Clean(filepath.Join(configDir, cfg.Data.MockFile))
	}

	return cfg, nil
}
