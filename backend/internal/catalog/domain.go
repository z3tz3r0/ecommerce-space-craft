// Package catalog is the products bounded context.
package catalog

import (
	"errors"
	"time"

	"github.com/google/uuid"
)

// Category is a spacecraft category with a fixed allowed set.
type Category string

const (
	CategoryFighter     Category = "Fighter"
	CategoryFreighter   Category = "Freighter"
	CategoryShuttle     Category = "Shuttle"
	CategorySpeeder     Category = "Speeder"
	CategoryCruiser     Category = "Cruiser"
	CategoryCapitalShip Category = "Capital Ship"
)

// AllCategories returns every valid category in enum-declaration order.
func AllCategories() []Category {
	return []Category{
		CategoryFighter,
		CategoryFreighter,
		CategoryShuttle,
		CategorySpeeder,
		CategoryCruiser,
		CategoryCapitalShip,
	}
}

// Product is a spacecraft offered in the store.
type Product struct {
	ID            uuid.UUID `json:"id"`
	Name          string    `json:"name"`
	Description   string    `json:"description"`
	PriceCents    int32     `json:"priceCents"`
	ImageURL      *string   `json:"imageUrl,omitempty"`
	Manufacturer  *string   `json:"manufacturer,omitempty"`
	CrewAmount    *int32    `json:"crewAmount,omitempty"`
	MaxSpeed      *string   `json:"maxSpeed,omitempty"`
	Category      Category  `json:"category"`
	StockQuantity int32     `json:"stockQuantity"`
	IsActive      bool      `json:"isActive"`
	CreatedAt     time.Time `json:"createdAt"`
	UpdatedAt     time.Time `json:"updatedAt"`
}

// Sentinel errors exposed by the catalog context.
var (
	ErrProductNotFound = errors.New("product not found")
	ErrInvalidID       = errors.New("invalid product id")
)
