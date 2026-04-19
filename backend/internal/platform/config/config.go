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

// parseLogLevel accepts exactly the four canonical level names. We
// intentionally validate the input ourselves before delegating to
// slog.Level.UnmarshalText, because UnmarshalText also accepts numeric
// offsets like "INFO+2" or "ERROR-8" — useful for slog itself, but a
// surprise in a config knob whose error message advertises only the
// four standard names.
func parseLogLevel(s string) (slog.Level, error) {
	trimmed := strings.TrimSpace(s)
	if trimmed == "" {
		return slog.LevelInfo, nil
	}
	normalized := strings.ToUpper(trimmed)
	if normalized == "WARNING" {
		normalized = "WARN"
	}
	switch normalized {
	case "DEBUG", "INFO", "WARN", "ERROR":
		// fall through to slog parsing
	default:
		return 0, fmt.Errorf("config: LOG_LEVEL %q invalid (expected debug|info|warn|error)", s)
	}
	var lvl slog.Level
	if err := lvl.UnmarshalText([]byte(normalized)); err != nil {
		return 0, fmt.Errorf("config: LOG_LEVEL %q invalid: %w", s, err)
	}
	return lvl, nil
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
