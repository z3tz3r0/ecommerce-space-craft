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

// FakeProduct mirrors ProductSnapshot for test construction. Field names
// match ProductSnapshot exactly so we can convert with a direct type cast.
type FakeProduct struct {
	ID            uuid.UUID
	Name          string
	PriceCents    int64
	ImageURL      *string
	StockQuantity int32
	IsActive      bool
}

// FakeRepoAdapter lets tests supply behavior for each Repository method.
// Any unset callback falls back to a sensible default.
type FakeRepoAdapter struct {
	GetItems        func(ctx context.Context, userID uuid.UUID) ([]Item, error)
	GetProduct      func(ctx context.Context, productID uuid.UUID) (FakeProduct, error)
	GetItemQuantity func(ctx context.Context, userID, productID uuid.UUID) (int32, error)
	UpsertItem      func(ctx context.Context, userID, productID uuid.UUID, quantity int32) error
	DeleteItem      func(ctx context.Context, userID, productID uuid.UUID) error
}

// NewServiceFake builds a Service backed by an in-memory fake repository.
// The *testing.T parameter is discarded but required so the signature
// makes it visually clear at the call site that this is test-only wiring.
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

func (f fakeRepoImpl) GetProduct(ctx context.Context, productID uuid.UUID) (ProductSnapshot, error) {
	if f.a.GetProduct == nil {
		return ProductSnapshot{}, ErrProductNotFound
	}
	p, err := f.a.GetProduct(ctx, productID)
	if err != nil {
		return ProductSnapshot{}, err
	}
	return ProductSnapshot(p), nil
}

func (f fakeRepoImpl) GetItemQuantity(ctx context.Context, userID, productID uuid.UUID) (int32, error) {
	if f.a.GetItemQuantity == nil {
		return 0, nil
	}
	return f.a.GetItemQuantity(ctx, userID, productID)
}

func (f fakeRepoImpl) UpsertItem(ctx context.Context, userID, productID uuid.UUID, quantity int32) error {
	if f.a.UpsertItem == nil {
		return nil
	}
	return f.a.UpsertItem(ctx, userID, productID, quantity)
}

func (f fakeRepoImpl) DeleteItem(ctx context.Context, userID, productID uuid.UUID) error {
	if f.a.DeleteItem == nil {
		return nil
	}
	return f.a.DeleteItem(ctx, userID, productID)
}
