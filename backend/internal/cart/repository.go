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
//
// AddItem / SetItem / MergeItems are intentionally coarse-grained: they
// own the read-clamp-write sequence so it can run atomically (transaction
// + row lock on the product) and the Service stays free of TOCTOU concerns.
type Repository interface {
	// GetItems returns the user's current cart, joined against live products
	// (inactive products are filtered out).
	GetItems(ctx context.Context, userID uuid.UUID) ([]Item, error)

	// AddItem atomically adds delta to the cart line for productID, clamping
	// the resulting quantity to the product's current stock. Creates the line
	// if it doesn't exist. Returns ErrProductNotFound if the product is
	// missing or inactive.
	AddItem(ctx context.Context, userID, productID uuid.UUID, delta int32) (Item, error)

	// SetItem atomically replaces the cart line's quantity. Returns
	// ErrProductNotFound if missing/inactive, ErrOverStock if quantity
	// exceeds current stock.
	SetItem(ctx context.Context, userID, productID uuid.UUID, quantity int32) (Item, error)

	// DeleteItem removes the cart line for the given (userID, productID).
	DeleteItem(ctx context.Context, userID, productID uuid.UUID) error

	// MergeItems applies a batch of guest items inside one transaction.
	// For each input, sums with the existing server quantity and clamps to
	// stock. Inputs whose product is missing or inactive are silently
	// skipped. Returns the resulting full cart.
	MergeItems(ctx context.Context, userID uuid.UUID, items []MergeItem) (Cart, error)
}
