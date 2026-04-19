// Package authtest provides fake auth.Repository implementations for tests.
//
// It lives in its own package so cross-package tests (e.g. cart_test) can
// import it. cmd/api and cmd/openapi never import authtest, so the fake
// implementation does NOT ship in any production binary.
package authtest

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/z3tz3r0/ecommerce-space-craft/backend/internal/auth"
)

// Record mirrors auth.UserRecord for test construction.
type Record struct {
	ID           uuid.UUID
	Email        string
	PasswordHash string
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

// Adapter lets tests supply behavior for each Repository method.
// Any unset callback falls back to a sensible default (typically
// auth.ErrUserNotFound so tests can omit methods they don't exercise).
type Adapter struct {
	Create     func(ctx context.Context, email, hash string) (Record, error)
	GetByEmail func(ctx context.Context, email string) (Record, error)
	GetByID    func(ctx context.Context, id uuid.UUID) (Record, error)
}

// NewService builds an auth.Service backed by an in-memory fake Repository.
// The *testing.T parameter is discarded but required so the signature makes
// it visually clear at the call site that this is test-only wiring.
func NewService(_ *testing.T, a Adapter) *auth.Service {
	return auth.NewService(repo{a: a})
}

type repo struct{ a Adapter }

func (r repo) CreateUser(ctx context.Context, email, hash string) (auth.UserRecord, error) {
	if r.a.Create == nil {
		return auth.UserRecord{}, fmt.Errorf("authtest: Create not configured")
	}
	rec, err := r.a.Create(ctx, email, hash)
	return auth.UserRecord(rec), err
}

func (r repo) GetUserByEmail(ctx context.Context, email string) (auth.UserRecord, error) {
	if r.a.GetByEmail == nil {
		return auth.UserRecord{}, auth.ErrUserNotFound
	}
	rec, err := r.a.GetByEmail(ctx, email)
	return auth.UserRecord(rec), err
}

func (r repo) GetUserByID(ctx context.Context, id uuid.UUID) (auth.UserRecord, error) {
	if r.a.GetByID == nil {
		return auth.UserRecord{}, auth.ErrUserNotFound
	}
	rec, err := r.a.GetByID(ctx, id)
	return auth.UserRecord(rec), err
}
