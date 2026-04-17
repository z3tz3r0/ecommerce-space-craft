// Package config loads and validates runtime configuration from environment variables.
package config

import (
	"errors"
	"fmt"
	"log/slog"
	"os"
	"strings"
)

type Config struct {
	DatabaseURL string
	Port        string
	Environment string
	LogLevel    slog.Level
	CORSOrigins []string
}

func Load() (Config, error) {
	cfg := Config{
		DatabaseURL: os.Getenv("DATABASE_URL"),
		Port:        os.Getenv("PORT"),
		Environment: os.Getenv("ENVIRONMENT"),
	}

	if cfg.DatabaseURL == "" {
		return Config{}, errors.New("config: DATABASE_URL is required")
	}
	if cfg.Port == "" {
		cfg.Port = "8080"
	}
	if cfg.Environment == "" {
		cfg.Environment = "dev"
	}

	lvl, err := parseLogLevel(os.Getenv("LOG_LEVEL"))
	if err != nil {
		return Config{}, err
	}
	cfg.LogLevel = lvl

	cfg.CORSOrigins = parseOrigins(os.Getenv("CORS_ORIGINS"))

	return cfg, nil
}

func parseLogLevel(s string) (slog.Level, error) {
	switch strings.ToLower(strings.TrimSpace(s)) {
	case "", "info":
		return slog.LevelInfo, nil
	case "debug":
		return slog.LevelDebug, nil
	case "warn", "warning":
		return slog.LevelWarn, nil
	case "error":
		return slog.LevelError, nil
	default:
		return 0, fmt.Errorf("config: LOG_LEVEL %q invalid (expected debug|info|warn|error)", s)
	}
}

func parseOrigins(s string) []string {
	if s == "" {
		return nil
	}
	parts := strings.Split(s, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if trimmed := strings.TrimSpace(p); trimmed != "" {
			out = append(out, trimmed)
		}
	}
	return out
}
