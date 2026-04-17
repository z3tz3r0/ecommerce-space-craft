package catalog

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	catalogdb "github.com/z3tz3r0/ecommerce-space-craft/backend/internal/catalog/db"
)

// Postgres is the pgx/sqlc-backed implementation of Repository.
type Postgres struct {
	q *catalogdb.Queries
}

// NewPostgres wraps a pgxpool.Pool with the sqlc-generated Queries.
func NewPostgres(pool *pgxpool.Pool) *Postgres {
	return &Postgres{q: catalogdb.New(pool)}
}

// GetByID returns the product with the given UUID, or ErrProductNotFound.
func (p *Postgres) GetByID(ctx context.Context, id uuid.UUID) (Product, error) {
	row, err := p.q.GetProductByID(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Product{}, ErrProductNotFound
		}
		return Product{}, fmt.Errorf("postgres: get product: %w", err)
	}
	return rowToProduct(row), nil
}

// ListActive returns every active product ordered by created_at DESC.
func (p *Postgres) ListActive(ctx context.Context) ([]Product, error) {
	rows, err := p.q.ListActiveProducts(ctx)
	if err != nil {
		return nil, fmt.Errorf("postgres: list active: %w", err)
	}
	out := make([]Product, 0, len(rows))
	for _, r := range rows {
		out = append(out, rowToProduct(r))
	}
	return out, nil
}

// CreateInput is the shape required to insert a new Product.
type CreateInput struct {
	Name          string
	Description   string
	PriceCents    int64
	ImageURL      *string
	Manufacturer  *string
	CrewAmount    *int32
	MaxSpeed      *string
	Category      Category
	StockQuantity int32
	IsActive      bool
}

// Create inserts a new Product and returns the persisted row. This is used by
// the seeder and (later) the admin UI — it is intentionally NOT part of the
// read-only Repository interface consumed by Service.
func (p *Postgres) Create(ctx context.Context, in CreateInput) (Product, error) {
	row, err := p.q.InsertProduct(ctx, catalogdb.InsertProductParams{
		Name:          in.Name,
		Description:   in.Description,
		PriceCents:    in.PriceCents,
		ImageUrl:      in.ImageURL,
		Manufacturer:  in.Manufacturer,
		CrewAmount:    in.CrewAmount,
		MaxSpeed:      in.MaxSpeed,
		Category:      string(in.Category),
		StockQuantity: in.StockQuantity,
		IsActive:      in.IsActive,
	})
	if err != nil {
		return Product{}, fmt.Errorf("postgres: insert product: %w", err)
	}
	return rowToProduct(row), nil
}

// DeleteAll truncates the products table. Seeder-only helper.
func (p *Postgres) DeleteAll(ctx context.Context) error {
	if err := p.q.TruncateProducts(ctx); err != nil {
		return fmt.Errorf("postgres: truncate products: %w", err)
	}
	return nil
}

// rowToProduct translates the sqlc row type into the domain Product.
func rowToProduct(r catalogdb.Product) Product {
	return Product{
		ID:            r.ID,
		Name:          r.Name,
		Description:   r.Description,
		PriceCents:    r.PriceCents,
		ImageURL:      r.ImageUrl,
		Manufacturer:  r.Manufacturer,
		CrewAmount:    r.CrewAmount,
		MaxSpeed:      r.MaxSpeed,
		Category:      Category(r.Category),
		StockQuantity: r.StockQuantity,
		IsActive:      r.IsActive,
		CreatedAt:     r.CreatedAt,
		UpdatedAt:     r.UpdatedAt,
	}
}
