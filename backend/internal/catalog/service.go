package catalog

import (
	"context"
	"fmt"

	"github.com/google/uuid"
)

// Service holds business logic for the catalog bounded context.
type Service struct {
	repo Repository
}

// NewService constructs a Service wrapping the given Repository.
func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

// GetByID validates the string id and fetches the product from the repository.
func (s *Service) GetByID(ctx context.Context, id string) (Product, error) {
	uid, err := uuid.Parse(id)
	if err != nil {
		return Product{}, fmt.Errorf("catalog: parse id %q: %w", id, ErrInvalidID)
	}
	p, err := s.repo.GetByID(ctx, uid)
	if err != nil {
		return Product{}, fmt.Errorf("catalog: get product %s: %w", uid, err)
	}
	return p, nil
}

// ListActive returns every active product ordered most-recent-first.
func (s *Service) ListActive(ctx context.Context) ([]Product, error) {
	ps, err := s.repo.ListActive(ctx)
	if err != nil {
		return nil, fmt.Errorf("catalog: list active: %w", err)
	}
	return ps, nil
}
