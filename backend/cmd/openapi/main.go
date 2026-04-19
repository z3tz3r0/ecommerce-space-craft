// Command openapi constructs the Huma API identically to cmd/api but dumps
// the OpenAPI spec to stdout without starting the HTTP server.
package main

import (
	"context"
	"fmt"
	"log/slog"
	"os"

	"github.com/alexedwards/scs/v2"
	"github.com/alexedwards/scs/v2/memstore"
	"github.com/google/uuid"

	"github.com/z3tz3r0/ecommerce-space-craft/backend/internal/auth"
	"github.com/z3tz3r0/ecommerce-space-craft/backend/internal/cart"
	"github.com/z3tz3r0/ecommerce-space-craft/backend/internal/catalog"
	"github.com/z3tz3r0/ecommerce-space-craft/backend/internal/platform/logging"
	"github.com/z3tz3r0/ecommerce-space-craft/backend/internal/platform/server"
)

func main() {
	logger := logging.New("dev", slog.LevelError)
	api := server.New("Spacecraft Store API", "0.1.0", logger, nil)

	sess := scs.New()
	sess.Store = memstore.New()

	catalog.Register(api.Huma, catalog.NewService(nopCatalogRepo{}), logger)
	authSvc := auth.NewServiceFake(nil, auth.FakeRepoAdapter{})
	auth.Register(api.Huma, authSvc, sess, logger)
	cart.Register(api.Huma, cart.NewServiceFake(nil, cart.FakeRepoAdapter{}), authSvc, sess, logger)

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

// nopCatalogRepo satisfies catalog.Repository with stubs.
type nopCatalogRepo struct{}

func (nopCatalogRepo) GetByID(_ context.Context, _ uuid.UUID) (catalog.Product, error) {
	return catalog.Product{}, nil
}
func (nopCatalogRepo) ListActive(_ context.Context) ([]catalog.Product, error) { return nil, nil }
func (nopCatalogRepo) ListFeatured(_ context.Context, _ int32) ([]catalog.Product, error) {
	return nil, nil
}
