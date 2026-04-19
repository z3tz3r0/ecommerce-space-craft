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
	pool *pgxpool.Pool
	q    *cartdb.Queries
}

var _ Repository = (*Postgres)(nil)

// NewPostgres wraps a pgxpool.Pool with the sqlc-generated Queries.
func NewPostgres(pool *pgxpool.Pool) *Postgres {
	return &Postgres{pool: pool, q: cartdb.New(pool)}
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

// AddItem implements the atomic add-and-clamp described on Repository.
func (p *Postgres) AddItem(ctx context.Context, userID, productID uuid.UUID, delta int32) (Item, error) {
	var result Item
	err := pgx.BeginFunc(ctx, p.pool, func(tx pgx.Tx) error {
		q := p.q.WithTx(tx)
		prod, err := q.LockProductForCart(ctx, productID)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return ErrProductNotFound
			}
			return fmt.Errorf("postgres: lock product: %w", err)
		}
		if !prod.IsActive {
			return ErrProductNotFound
		}
		existing, err := q.GetCartItemQuantity(ctx, cartdb.GetCartItemQuantityParams{
			UserID:    userID,
			ProductID: productID,
		})
		if err != nil && !errors.Is(err, pgx.ErrNoRows) {
			return fmt.Errorf("postgres: get existing quantity: %w", err)
		}
		target := existing + delta
		if target > prod.StockQuantity {
			target = prod.StockQuantity
		}
		if _, err := q.UpsertCartItem(ctx, cartdb.UpsertCartItemParams{
			UserID:    userID,
			ProductID: productID,
			Quantity:  target,
		}); err != nil {
			return fmt.Errorf("postgres: upsert cart item: %w", err)
		}
		result = Item{
			ProductID:     productID,
			Name:          prod.Name,
			PriceCents:    prod.PriceCents,
			ImageURL:      prod.ImageUrl,
			Quantity:      target,
			StockQuantity: prod.StockQuantity,
		}
		return nil
	})
	return result, err
}

// SetItem implements the atomic set-with-stock-check described on Repository.
func (p *Postgres) SetItem(ctx context.Context, userID, productID uuid.UUID, quantity int32) (Item, error) {
	var result Item
	err := pgx.BeginFunc(ctx, p.pool, func(tx pgx.Tx) error {
		q := p.q.WithTx(tx)
		prod, err := q.LockProductForCart(ctx, productID)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return ErrProductNotFound
			}
			return fmt.Errorf("postgres: lock product: %w", err)
		}
		if !prod.IsActive {
			return ErrProductNotFound
		}
		if quantity > prod.StockQuantity {
			return ErrOverStock
		}
		if _, err := q.UpsertCartItem(ctx, cartdb.UpsertCartItemParams{
			UserID:    userID,
			ProductID: productID,
			Quantity:  quantity,
		}); err != nil {
			return fmt.Errorf("postgres: upsert cart item: %w", err)
		}
		result = Item{
			ProductID:     productID,
			Name:          prod.Name,
			PriceCents:    prod.PriceCents,
			ImageURL:      prod.ImageUrl,
			Quantity:      quantity,
			StockQuantity: prod.StockQuantity,
		}
		return nil
	})
	return result, err
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

// MergeItems applies a batch of guest items inside one transaction.
// Per-item N+1 round-trips remain (validate + read existing + upsert) — the
// win here is atomicity (all-or-nothing) and that each product row is
// FOR-UPDATE locked so concurrent merges/adds can't race the clamp.
// Reading the resulting cart happens after commit so it sees the post-merge
// state across all items.
func (p *Postgres) MergeItems(ctx context.Context, userID uuid.UUID, items []MergeItem) (Cart, error) {
	err := pgx.BeginFunc(ctx, p.pool, func(tx pgx.Tx) error {
		q := p.q.WithTx(tx)
		for _, in := range items {
			if in.Quantity < 1 {
				continue
			}
			prod, err := q.LockProductForCart(ctx, in.ProductID)
			if err != nil {
				if errors.Is(err, pgx.ErrNoRows) {
					continue
				}
				return fmt.Errorf("postgres: merge lock product: %w", err)
			}
			if !prod.IsActive {
				continue
			}
			existing, err := q.GetCartItemQuantity(ctx, cartdb.GetCartItemQuantityParams{
				UserID:    userID,
				ProductID: in.ProductID,
			})
			if err != nil && !errors.Is(err, pgx.ErrNoRows) {
				return fmt.Errorf("postgres: merge get existing: %w", err)
			}
			target := existing + in.Quantity
			if target > prod.StockQuantity {
				target = prod.StockQuantity
			}
			if _, err := q.UpsertCartItem(ctx, cartdb.UpsertCartItemParams{
				UserID:    userID,
				ProductID: in.ProductID,
				Quantity:  target,
			}); err != nil {
				return fmt.Errorf("postgres: merge upsert: %w", err)
			}
		}
		return nil
	})
	if err != nil {
		return Cart{}, err
	}
	out, err := p.GetItems(ctx, userID)
	if err != nil {
		return Cart{}, fmt.Errorf("postgres: merge get final cart: %w", err)
	}
	if out == nil {
		out = []Item{}
	}
	return Cart{Items: out}, nil
}

// CreateInput / Create / DeleteAll are intentionally NOT here — the cart
// repository never inserts products. Catalog owns that.
