package cart

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	cartdb "github.com/z3tz3r0/ecommerce-space-craft/backend/internal/cart/db"
)

// Postgres is the pgx/sqlc-backed implementation of Repository.
type Postgres struct {
	q *cartdb.Queries
}

var _ Repository = (*Postgres)(nil)

// NewPostgres wraps a pgxpool.Pool with the sqlc-generated Queries.
func NewPostgres(pool *pgxpool.Pool) *Postgres {
	return &Postgres{q: cartdb.New(pool)}
}

// GetItems returns the user's cart lines joined against active products.
func (p *Postgres) GetItems(ctx context.Context, userID uuid.UUID) ([]Item, error) {
	rows, err := p.q.GetCartItems(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("postgres: get cart items: %w", err)
	}
	out := make([]Item, 0, len(rows))
	for _, r := range rows {
		out = append(out, Item{
			ProductID:     r.ProductID,
			Name:          r.Name,
			PriceCents:    r.PriceCents,
			ImageURL:      r.ImageUrl,
			Quantity:      r.Quantity,
			StockQuantity: r.StockQuantity,
		})
	}
	return out, nil
}

// GetProduct returns the live product snapshot or ErrProductNotFound.
func (p *Postgres) GetProduct(ctx context.Context, productID uuid.UUID) (productSnapshot, error) {
	row, err := p.q.GetProductForCart(ctx, productID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return productSnapshot{}, ErrProductNotFound
		}
		return productSnapshot{}, fmt.Errorf("postgres: get product for cart: %w", err)
	}
	if !row.IsActive {
		return productSnapshot{}, ErrProductNotFound
	}
	return productSnapshot{
		ID:            row.ID,
		Name:          row.Name,
		PriceCents:    row.PriceCents,
		ImageURL:      row.ImageUrl,
		StockQuantity: row.StockQuantity,
		IsActive:      row.IsActive,
	}, nil
}

// GetItemQuantity returns the current quantity of a cart line, or 0 if none.
func (p *Postgres) GetItemQuantity(ctx context.Context, userID, productID uuid.UUID) (int32, error) {
	q, err := p.q.GetCartItemQuantity(ctx, cartdb.GetCartItemQuantityParams{
		UserID:    userID,
		ProductID: productID,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return 0, nil
		}
		return 0, fmt.Errorf("postgres: get cart item quantity: %w", err)
	}
	return q, nil
}

// UpsertItem inserts or updates the cart line to the given quantity.
func (p *Postgres) UpsertItem(ctx context.Context, userID, productID uuid.UUID, quantity int32) error {
	_, err := p.q.UpsertCartItem(ctx, cartdb.UpsertCartItemParams{
		UserID:    userID,
		ProductID: productID,
		Quantity:  quantity,
	})
	if err != nil {
		return fmt.Errorf("postgres: upsert cart item: %w", err)
	}
	return nil
}

// DeleteItem removes a cart line.
func (p *Postgres) DeleteItem(ctx context.Context, userID, productID uuid.UUID) error {
	if err := p.q.DeleteCartItem(ctx, cartdb.DeleteCartItemParams{
		UserID:    userID,
		ProductID: productID,
	}); err != nil {
		return fmt.Errorf("postgres: delete cart item: %w", err)
	}
	return nil
}
