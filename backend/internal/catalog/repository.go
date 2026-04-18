package catalog

import (
	"context"

	"github.com/google/uuid"
)

// Repository is the storage-facing interface the catalog Service depends on.
// Implementations must be safe for concurrent use.
type Repository interface {
	GetByID(ctx context.Context, id uuid.UUID) (Product, error)
	ListActive(ctx context.Context) ([]Product, error)
	ListFeatured(ctx context.Context, limit int32) ([]Product, error)
}
