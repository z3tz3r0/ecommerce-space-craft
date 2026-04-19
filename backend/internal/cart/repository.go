package cart

import (
	"context"

	"github.com/google/uuid"
)

// ProductSnapshot is the repository-layer view of a product that the cart
// service needs: enough to validate stock and render lines. It is NOT the
// catalog Product — keeping a parallel type preserves bounded-context
// independence between cart and catalog.
//
// Exported so external packages — the spec-extraction binary cmd/openapi,
// in particular — can implement no-op Repository fakes without needing
// access to package-private types.
type ProductSnapshot struct {
	ID            uuid.UUID
	Name          string
	PriceCents    int64
	ImageURL      *string
	StockQuantity int32
	IsActive      bool
}

// Repository is the storage-facing interface the cart Service depends on.
type Repository interface {
	// GetItems returns the user's current cart, joined against live products
	// (inactive products are filtered out).
	GetItems(ctx context.Context, userID uuid.UUID) ([]Item, error)

	// GetProduct returns the product snapshot used for stock validation.
	// Returns ErrProductNotFound if the product is missing or inactive.
	GetProduct(ctx context.Context, productID uuid.UUID) (ProductSnapshot, error)

	// GetItemQuantity returns the quantity of a specific cart line, or 0
	// if the line does not exist.
	GetItemQuantity(ctx context.Context, userID, productID uuid.UUID) (int32, error)

	// UpsertItem inserts or updates a cart line to the given quantity.
	UpsertItem(ctx context.Context, userID, productID uuid.UUID, quantity int32) error

	// DeleteItem removes the cart line for the given (userID, productID).
	DeleteItem(ctx context.Context, userID, productID uuid.UUID) error
}
