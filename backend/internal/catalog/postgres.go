package catalog

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	catalogdb "github.com/z3tz3r0/ecommerce-space-craft/backend/internal/catalog/db"
)

// Postgres is the pgx/sqlc-backed implementation of Repository.
type Postgres struct {
	q *catalogdb.Queries
}

var _ Repository = (*Postgres)(nil)

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
	return rowToProduct(productRow{
		id:            row.ID,
		name:          row.Name,
		description:   row.Description,
		priceCents:    row.PriceCents,
		imageUrl:      row.ImageUrl,
		manufacturer:  row.Manufacturer,
		crewAmount:    row.CrewAmount,
		maxSpeed:      row.MaxSpeed,
		category:      row.Category,
		stockQuantity: row.StockQuantity,
		isActive:      row.IsActive,
		isFeatured:    row.IsFeatured,
		createdAt:     row.CreatedAt,
		updatedAt:     row.UpdatedAt,
	}), nil
}

// ListActive returns every active product ordered by created_at DESC.
func (p *Postgres) ListActive(ctx context.Context) ([]Product, error) {
	rows, err := p.q.ListActiveProducts(ctx)
	if err != nil {
		return nil, fmt.Errorf("postgres: list active: %w", err)
	}
	out := make([]Product, 0, len(rows))
	for _, r := range rows {
		out = append(out, rowToProduct(productRow{
			id:            r.ID,
			name:          r.Name,
			description:   r.Description,
			priceCents:    r.PriceCents,
			imageUrl:      r.ImageUrl,
			manufacturer:  r.Manufacturer,
			crewAmount:    r.CrewAmount,
			maxSpeed:      r.MaxSpeed,
			category:      r.Category,
			stockQuantity: r.StockQuantity,
			isActive:      r.IsActive,
			isFeatured:    r.IsFeatured,
			createdAt:     r.CreatedAt,
			updatedAt:     r.UpdatedAt,
		}))
	}
	return out, nil
}

// ListFeatured returns at most `limit` featured + active products,
// ordered by created_at DESC.
func (p *Postgres) ListFeatured(ctx context.Context, limit int32) ([]Product, error) {
	rows, err := p.q.ListFeaturedProducts(ctx, limit)
	if err != nil {
		return nil, fmt.Errorf("postgres: list featured: %w", err)
	}
	out := make([]Product, 0, len(rows))
	for _, r := range rows {
		out = append(out, rowToProduct(productRow{
			id:            r.ID,
			name:          r.Name,
			description:   r.Description,
			priceCents:    r.PriceCents,
			imageUrl:      r.ImageUrl,
			manufacturer:  r.Manufacturer,
			crewAmount:    r.CrewAmount,
			maxSpeed:      r.MaxSpeed,
			category:      r.Category,
			stockQuantity: r.StockQuantity,
			isActive:      r.IsActive,
			isFeatured:    r.IsFeatured,
			createdAt:     r.CreatedAt,
			updatedAt:     r.UpdatedAt,
		}))
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
	IsFeatured    bool
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
		IsFeatured:    in.IsFeatured,
	})
	if err != nil {
		return Product{}, fmt.Errorf("postgres: insert product: %w", err)
	}
	return rowToProduct(productRow{
		id:            row.ID,
		name:          row.Name,
		description:   row.Description,
		priceCents:    row.PriceCents,
		imageUrl:      row.ImageUrl,
		manufacturer:  row.Manufacturer,
		crewAmount:    row.CrewAmount,
		maxSpeed:      row.MaxSpeed,
		category:      row.Category,
		stockQuantity: row.StockQuantity,
		isActive:      row.IsActive,
		isFeatured:    row.IsFeatured,
		createdAt:     row.CreatedAt,
		updatedAt:     row.UpdatedAt,
	}), nil
}

// DeleteAll truncates the products table. Seeder-only helper.
func (p *Postgres) DeleteAll(ctx context.Context) error {
	if err := p.q.TruncateProducts(ctx); err != nil {
		return fmt.Errorf("postgres: truncate products: %w", err)
	}
	return nil
}

// productRow is a package-private intermediary that every sqlc per-query row
// type maps into before being converted to the domain Product. Named-field
// assignment at every call site eliminates the positional-argument landmine
// that would arise from boolean/string args of identical types.
type productRow struct {
	id            uuid.UUID
	name          string
	description   string
	priceCents    int64
	imageUrl      *string
	manufacturer  *string
	crewAmount    *int32
	maxSpeed      *string
	category      string
	stockQuantity int32
	isActive      bool
	isFeatured    bool
	createdAt     time.Time
	updatedAt     time.Time
}

// rowToProduct translates a productRow intermediary into the domain Product.
func rowToProduct(r productRow) Product {
	return Product{
		ID:            r.id,
		Name:          r.name,
		Description:   r.description,
		PriceCents:    r.priceCents,
		ImageURL:      r.imageUrl,
		Manufacturer:  r.manufacturer,
		CrewAmount:    r.crewAmount,
		MaxSpeed:      r.maxSpeed,
		Category:      Category(r.category),
		StockQuantity: r.stockQuantity,
		IsActive:      r.isActive,
		IsFeatured:    r.isFeatured,
		CreatedAt:     r.createdAt,
		UpdatedAt:     r.updatedAt,
	}
}
