package cart

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"github.com/google/uuid"
)

// Service holds business logic for the cart bounded context.
type Service struct {
	repo Repository
}

// NewService constructs a Service wrapping the given Repository.
func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

// Get returns the user's current cart.
func (s *Service) Get(ctx context.Context, userID uuid.UUID) (Cart, error) {
	items, err := s.repo.GetItems(ctx, userID)
	if err != nil {
		return Cart{}, fmt.Errorf("cart: get: %w", err)
	}
	if items == nil {
		items = []Item{}
	}
	return Cart{Items: items}, nil
}

// Add increments the cart line for productID by the given quantity,
// clamping to the product's live stock. Creates the line if it doesn't
// exist. Returns the resulting line.
func (s *Service) Add(ctx context.Context, userID, productID uuid.UUID, quantity int32) (Item, error) {
	if quantity < 1 {
		return Item{}, ErrInvalidQuantity
	}
	prod, err := s.repo.GetProduct(ctx, productID)
	if err != nil {
		return Item{}, err
	}
	existing, err := s.repo.GetItemQuantity(ctx, userID, productID)
	if err != nil {
		return Item{}, fmt.Errorf("cart: get existing quantity: %w", err)
	}
	target := existing + quantity
	if target > prod.StockQuantity {
		target = prod.StockQuantity
	}
	if err := s.repo.UpsertItem(ctx, userID, productID, target); err != nil {
		return Item{}, fmt.Errorf("cart: upsert: %w", err)
	}
	return Item{
		ProductID:     prod.ID,
		Name:          prod.Name,
		PriceCents:    prod.PriceCents,
		ImageURL:      prod.ImageURL,
		Quantity:      target,
		StockQuantity: prod.StockQuantity,
	}, nil
}

// Set replaces the cart line's quantity. Rejects quantities <1 or above
// live stock.
func (s *Service) Set(ctx context.Context, userID, productID uuid.UUID, quantity int32) (Item, error) {
	if quantity < 1 {
		return Item{}, ErrInvalidQuantity
	}
	prod, err := s.repo.GetProduct(ctx, productID)
	if err != nil {
		return Item{}, err
	}
	if quantity > prod.StockQuantity {
		return Item{}, ErrOverStock
	}
	if err := s.repo.UpsertItem(ctx, userID, productID, quantity); err != nil {
		return Item{}, fmt.Errorf("cart: upsert: %w", err)
	}
	return Item{
		ProductID:     prod.ID,
		Name:          prod.Name,
		PriceCents:    prod.PriceCents,
		ImageURL:      prod.ImageURL,
		Quantity:      quantity,
		StockQuantity: prod.StockQuantity,
	}, nil
}

// Remove deletes the cart line.
func (s *Service) Remove(ctx context.Context, userID, productID uuid.UUID) error {
	if err := s.repo.DeleteItem(ctx, userID, productID); err != nil {
		return fmt.Errorf("cart: delete: %w", err)
	}
	return nil
}

// Merge adds the given guest items to the user's cart additively — for
// each input (productID, quantity), sum with the existing server quantity
// and clamp to live stock. Products that don't exist or are inactive are
// silently skipped. Returns the resulting full cart.
func (s *Service) Merge(ctx context.Context, userID uuid.UUID, items []MergeItem) (Cart, error) {
	for _, in := range items {
		if in.Quantity < 1 {
			continue
		}
		prod, err := s.repo.GetProduct(ctx, in.ProductID)
		if err != nil {
			if errors.Is(err, ErrProductNotFound) {
				continue
			}
			return Cart{}, fmt.Errorf("cart: merge get product: %w", err)
		}
		existing, err := s.repo.GetItemQuantity(ctx, userID, in.ProductID)
		if err != nil {
			return Cart{}, fmt.Errorf("cart: merge get existing: %w", err)
		}
		target := existing + in.Quantity
		if target > prod.StockQuantity {
			target = prod.StockQuantity
		}
		if err := s.repo.UpsertItem(ctx, userID, in.ProductID, target); err != nil {
			return Cart{}, fmt.Errorf("cart: merge upsert: %w", err)
		}
	}
	return s.Get(ctx, userID)
}

// --- test-only helpers -------------------------------------------------
// Exported so *_test.go files can construct fakes without touching the
// package-private Repository / productSnapshot types. The *testing.T
// parameter on NewServiceFake prevents misuse from non-test code.

type FakeProduct struct {
	ID            uuid.UUID
	Name          string
	PriceCents    int64
	ImageURL      *string
	StockQuantity int32
	IsActive      bool
}

type FakeRepoAdapter struct {
	GetItems        func(ctx context.Context, userID uuid.UUID) ([]Item, error)
	GetProduct      func(ctx context.Context, productID uuid.UUID) (FakeProduct, error)
	GetItemQuantity func(ctx context.Context, userID, productID uuid.UUID) (int32, error)
	UpsertItem      func(ctx context.Context, userID, productID uuid.UUID, quantity int32) error
	DeleteItem      func(ctx context.Context, userID, productID uuid.UUID) error
}

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

func (f fakeRepoImpl) GetProduct(ctx context.Context, productID uuid.UUID) (productSnapshot, error) {
	if f.a.GetProduct == nil {
		return productSnapshot{}, ErrProductNotFound
	}
	p, err := f.a.GetProduct(ctx, productID)
	if err != nil {
		return productSnapshot{}, err
	}
	return productSnapshot(p), nil
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
