package cart

import (
	"context"
	"testing"

	"github.com/google/uuid"
)

// This file lives in package cart (not cart_test) so external test files
// in package cart_test can call cart.NewServiceFake — but the *_test.go
// suffix keeps it out of regular builds, so the fake implementation does
// NOT ship in cmd/api or any production binary.

// FakeRepoAdapter lets tests supply behavior for each Repository method.
// Any unset callback falls back to a sensible zero-value default.
type FakeRepoAdapter struct {
	GetItems   func(ctx context.Context, userID uuid.UUID) ([]Item, error)
	AddItem    func(ctx context.Context, userID, productID uuid.UUID, delta int32) (Item, error)
	SetItem    func(ctx context.Context, userID, productID uuid.UUID, quantity int32) (Item, error)
	DeleteItem func(ctx context.Context, userID, productID uuid.UUID) error
	MergeItems func(ctx context.Context, userID uuid.UUID, items []MergeItem) (Cart, error)
}

// NewServiceFake builds a Service backed by an in-memory fake Repository.
// The *testing.T parameter is discarded but required so the signature makes
// it visually clear at the call site that this is test-only wiring.
func NewServiceFake(_ *testing.T, a FakeRepoAdapter) *Service {
	return NewService(fakeRepoImpl{a: a})
}

type fakeRepoImpl struct{ a FakeRepoAdapter }

func (f fakeRepoImpl) GetItems(ctx context.Context, userID uuid.UUID) ([]Item, error) {
	if f.a.GetItems == nil {
		return nil, nil
	}
	return f.a.GetItems(ctx, userID)
}

func (f fakeRepoImpl) AddItem(ctx context.Context, userID, productID uuid.UUID, delta int32) (Item, error) {
	if f.a.AddItem == nil {
		return Item{}, ErrProductNotFound
	}
	return f.a.AddItem(ctx, userID, productID, delta)
}

func (f fakeRepoImpl) SetItem(ctx context.Context, userID, productID uuid.UUID, quantity int32) (Item, error) {
	if f.a.SetItem == nil {
		return Item{}, ErrProductNotFound
	}
	return f.a.SetItem(ctx, userID, productID, quantity)
}

func (f fakeRepoImpl) DeleteItem(ctx context.Context, userID, productID uuid.UUID) error {
	if f.a.DeleteItem == nil {
		return nil
	}
	return f.a.DeleteItem(ctx, userID, productID)
}

func (f fakeRepoImpl) MergeItems(ctx context.Context, userID uuid.UUID, items []MergeItem) (Cart, error) {
	if f.a.MergeItems == nil {
		return Cart{}, nil
	}
	return f.a.MergeItems(ctx, userID, items)
}
