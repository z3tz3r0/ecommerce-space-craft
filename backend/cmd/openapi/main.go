// Command openapi constructs the Huma API identically to cmd/api but dumps
// the OpenAPI spec to stdout without starting the HTTP server. This lets the
// frontend regenerate its typed client without a running backend.
package main

import (
	"context"
	"fmt"
	"log/slog"
	"os"

	"github.com/google/uuid"

	"github.com/z3tz3r0/ecommerce-space-craft/backend/internal/catalog"
	"github.com/z3tz3r0/ecommerce-space-craft/backend/internal/platform/logging"
	"github.com/z3tz3r0/ecommerce-space-craft/backend/internal/platform/server"
)

func main() {
	logger := logging.New("dev", slog.LevelError)
	api := server.New("Spacecraft Store API", "0.1.0", logger, nil)

	// Register the same routes cmd/api registers, backed by a no-op repo.
	// The spec only depends on handler signatures, not service internals.
	catalog.Register(api.Huma, catalog.NewService(nopRepo{}), logger)

	out, err := api.Huma.OpenAPI().MarshalJSON()
	if err != nil {
		fmt.Fprintln(os.Stderr, "openapi marshal:", err)
		os.Exit(1)
	}
	if _, err := os.Stdout.Write(out); err != nil {
		fmt.Fprintln(os.Stderr, "openapi write:", err)
		os.Exit(1)
	}
}

// nopRepo satisfies catalog.Repository with stubs. Used only at spec-dump time
// when handlers are never actually invoked.
type nopRepo struct{}

func (nopRepo) GetByID(_ context.Context, _ uuid.UUID) (catalog.Product, error) {
	return catalog.Product{}, nil
}

func (nopRepo) ListActive(_ context.Context) ([]catalog.Product, error) {
	return nil, nil
}
