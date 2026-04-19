package config_test

import (
	"log/slog"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/z3tz3r0/ecommerce-space-craft/backend/internal/platform/config"
)

func TestLoad_RequiredVars(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://u:p@h/d")
	t.Setenv("PORT", "8080")
	t.Setenv("ENVIRONMENT", "dev")
	t.Setenv("LOG_LEVEL", "debug")
	t.Setenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000")

	cfg, err := config.Load()
	require.NoError(t, err)
	require.Equal(t, "postgres://u:p@h/d", cfg.DatabaseURL)
	require.Equal(t, "8080", cfg.Port)
	require.Equal(t, "dev", cfg.Environment)
	require.Equal(t, slog.LevelDebug, cfg.LogLevel)
	require.Equal(t, []string{"http://localhost:5173", "http://localhost:3000"}, cfg.CORSOrigins)
}

func TestLoad_MissingDatabaseURL(t *testing.T) {
	t.Setenv("DATABASE_URL", "")
	t.Setenv("PORT", "8080")
	t.Setenv("ENVIRONMENT", "dev")
	t.Setenv("LOG_LEVEL", "info")
	t.Setenv("CORS_ORIGINS", "http://localhost:5173")

	_, err := config.Load()
	require.ErrorContains(t, err, "DATABASE_URL")
}

func TestLoad_InvalidLogLevel(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://u:p@h/d")
	t.Setenv("PORT", "8080")
	t.Setenv("ENVIRONMENT", "dev")
	t.Setenv("LOG_LEVEL", "nonsense")
	t.Setenv("CORS_ORIGINS", "http://localhost:5173")

	_, err := config.Load()
	require.ErrorContains(t, err, "LOG_LEVEL")
}

func TestLoad_DefaultsPortAndEnvironment(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://u:p@h/d")
	t.Setenv("PORT", "")
	t.Setenv("ENVIRONMENT", "")
	t.Setenv("LOG_LEVEL", "info")
	t.Setenv("CORS_ORIGINS", "http://localhost:5173")

	cfg, err := config.Load()
	require.NoError(t, err)
	require.Equal(t, "8080", cfg.Port)
	require.Equal(t, "dev", cfg.Environment)
}

func TestLoad_EnvironmentNormalization(t *testing.T) {
	cases := []struct {
		in   string
		want string
	}{
		{"dev", "dev"},
		{"DEV", "dev"},
		{"development", "dev"},
		{"Development", "dev"},
		{"prod", "production"}, // Render blueprint historically used "prod"
		{"PROD", "production"},
		{"production", "production"},
		{"Production", "production"},
		{"  prod  ", "production"}, // whitespace tolerated
	}
	for _, tc := range cases {
		t.Run(tc.in, func(t *testing.T) {
			t.Setenv("DATABASE_URL", "postgres://u:p@h/d")
			t.Setenv("ENVIRONMENT", tc.in)
			t.Setenv("LOG_LEVEL", "info")
			t.Setenv("CORS_ORIGINS", "http://localhost:5173")
			cfg, err := config.Load()
			require.NoError(t, err)
			require.Equal(t, tc.want, cfg.Environment,
				"every consumer compares Environment against the canonical 'production' literal — normalize at config.Load")
		})
	}
}

func TestLoad_InvalidEnvironment(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://u:p@h/d")
	t.Setenv("ENVIRONMENT", "staging") // not yet supported
	t.Setenv("LOG_LEVEL", "info")
	t.Setenv("CORS_ORIGINS", "http://localhost:5173")
	_, err := config.Load()
	require.ErrorContains(t, err, "ENVIRONMENT")
}
