package cart

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"slices"

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
		// Refuse the add when there's no headroom — otherwise we'd write a
		// quantity=0 row (stock=0, no existing line) or perform a no-op
		// write that burns a DB round-trip while the client's response says
		// "added". Match Set's behaviour by signalling explicitly.
		if existing >= prod.StockQuantity {
			return ErrOverStock
		}
		target := clampSum(existing, delta, prod.StockQuantity)
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
//
// Lock acquisition order is sorted by ProductID to keep it deterministic:
// two concurrent merges with overlapping products in different input orders
// would otherwise risk a circular FOR UPDATE wait (deadlock).
//
// The final cart read happens INSIDE the transaction so a post-write read
// failure rolls back the whole merge — otherwise a caller retry could
// double-count guest items into the server cart.
func (p *Postgres) MergeItems(ctx context.Context, userID uuid.UUID, items []MergeItem) (Cart, error) {
	sortedItems := make([]MergeItem, len(items))
	copy(sortedItems, items)
	slices.SortFunc(sortedItems, func(a, b MergeItem) int {
		return bytes.Compare(a.ProductID[:], b.ProductID[:])
	})

	var result Cart
	err := pgx.BeginFunc(ctx, p.pool, func(tx pgx.Tx) error {
		q := p.q.WithTx(tx)
		for _, in := range sortedItems {
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
			// Skip silently when there's no room — Merge is best-effort, so
			// out-of-stock guest items just don't make it into the server cart.
			if existing >= prod.StockQuantity {
				continue
			}
			target := clampSum(existing, in.Quantity, prod.StockQuantity)
			if _, err := q.UpsertCartItem(ctx, cartdb.UpsertCartItemParams{
				UserID:    userID,
				ProductID: in.ProductID,
				Quantity:  target,
			}); err != nil {
				return fmt.Errorf("postgres: merge upsert: %w", err)
			}
		}
		rows, err := q.GetCartItems(ctx, userID)
		if err != nil {
			return fmt.Errorf("postgres: merge get final cart: %w", err)
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
		result = Cart{Items: out}
		return nil
	})
	if err != nil {
		return Cart{}, err
	}
	if result.Items == nil {
		result.Items = []Item{}
	}
	return result, nil
}

// clampSum returns min(existing+delta, stock) computed in int64 so the sum
// can't silently wrap an int32 (e.g. a malicious client passing math.MaxInt32
// when existing is already large would otherwise overflow to a negative
// number and bypass the stock check).
func clampSum(existing, delta, stock int32) int32 {
	sum := int64(existing) + int64(delta)
	if sum > int64(stock) {
		return stock
	}
	return int32(sum)
}
