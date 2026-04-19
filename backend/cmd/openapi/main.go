// Command openapi constructs the Huma API identically to cmd/api but dumps
// the OpenAPI spec to stdout without starting the HTTP server.
//
// Each context's Service requires a Repository. Spec extraction never calls
// the handlers, so the implementations below return zero values / nil — they
// exist only to satisfy the interface for registration.
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
	authSvc := auth.NewService(nopAuthRepo{})
	auth.Register(api.Huma, authSvc, sess, logger)
	cart.Register(api.Huma, cart.NewService(nopCartRepo{}), authSvc, sess, logger)

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

// nopAuthRepo satisfies auth.Repository with stubs.
type nopAuthRepo struct{}

func (nopAuthRepo) CreateUser(_ context.Context, _, _ string) (auth.UserRecord, error) {
	return auth.UserRecord{}, nil
}
func (nopAuthRepo) GetUserByEmail(_ context.Context, _ string) (auth.UserRecord, error) {
	return auth.UserRecord{}, nil
}
func (nopAuthRepo) GetUserByID(_ context.Context, _ uuid.UUID) (auth.UserRecord, error) {
	return auth.UserRecord{}, nil
}

// nopCartRepo satisfies cart.Repository with stubs.
type nopCartRepo struct{}

func (nopCartRepo) GetItems(_ context.Context, _ uuid.UUID) ([]cart.Item, error) { return nil, nil }
func (nopCartRepo) AddItem(_ context.Context, _, _ uuid.UUID, _ int32) (cart.Item, error) {
	return cart.Item{}, nil
}
func (nopCartRepo) SetItem(_ context.Context, _, _ uuid.UUID, _ int32) (cart.Item, error) {
	return cart.Item{}, nil
}
func (nopCartRepo) DeleteItem(_ context.Context, _, _ uuid.UUID) error { return nil }
func (nopCartRepo) MergeItems(_ context.Context, _ uuid.UUID, _ []cart.MergeItem) (cart.Cart, error) {
	return cart.Cart{}, nil
}
