package cart

import (
	"context"
	"fmt"

	"github.com/google/uuid"
)

// Service holds business logic for the cart bounded context.
//
// Stock-clamping and stock-overflow detection live in the Repository so the
// read-then-write sequence stays atomic. Service is responsible only for
// input validation and forwarding.
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

// Add increments the cart line for productID by the given quantity. The
// repository performs the read, sum, and clamp atomically.
func (s *Service) Add(ctx context.Context, userID, productID uuid.UUID, quantity int32) (Item, error) {
	if quantity < 1 {
		return Item{}, ErrInvalidQuantity
	}
	return s.repo.AddItem(ctx, userID, productID, quantity)
}

// Set replaces the cart line's quantity. The repository validates against
// current stock atomically.
func (s *Service) Set(ctx context.Context, userID, productID uuid.UUID, quantity int32) (Item, error) {
	if quantity < 1 {
		return Item{}, ErrInvalidQuantity
	}
	return s.repo.SetItem(ctx, userID, productID, quantity)
}

// Remove deletes the cart line.
func (s *Service) Remove(ctx context.Context, userID, productID uuid.UUID) error {
	if err := s.repo.DeleteItem(ctx, userID, productID); err != nil {
		return fmt.Errorf("cart: delete: %w", err)
	}
	return nil
}

// Merge folds the given guest items into the user's cart atomically.
func (s *Service) Merge(ctx context.Context, userID uuid.UUID, items []MergeItem) (Cart, error) {
	cart, err := s.repo.MergeItems(ctx, userID, items)
	if err != nil {
		return Cart{}, fmt.Errorf("cart: merge: %w", err)
	}
	return cart, nil
}
