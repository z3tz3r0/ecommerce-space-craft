// Package cart is the shopping-cart bounded context. Items are keyed on
// (user_id, product_id) with quantities clamped to each product's live
// stock. Guest carts live client-side and enter this context only through
// the Merge method during signup/login.
package cart

import (
	"errors"

	"github.com/google/uuid"
)

// Item is one row in the user's cart, enriched with the joined product
// fields the frontend needs to render without a second roundtrip.
type Item struct {
	ProductID     uuid.UUID `json:"productId"`
	Name          string    `json:"name"`
	PriceCents    int64     `json:"priceCents"`
	ImageURL      *string   `json:"imageUrl,omitempty"`
	Quantity      int32     `json:"quantity"`
	StockQuantity int32     `json:"stockQuantity"`
}

// Cart is a user's current cart state.
type Cart struct {
	Items []Item `json:"items"`
}

// MergeItem is the guest-cart line shape accepted by the merge endpoint.
type MergeItem struct {
	ProductID uuid.UUID `json:"productId"`
	Quantity  int32     `json:"quantity"`
}

// Sentinel errors exposed by the cart context.
var (
	ErrProductNotFound = errors.New("cart: product not found or inactive")
	ErrInvalidQuantity = errors.New("cart: quantity must be >= 1")
	ErrOverStock       = errors.New("cart: quantity exceeds available stock")
)
