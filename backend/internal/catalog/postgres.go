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
	return rowToProduct(row.ID, row.Name, row.Description, row.PriceCents,
		row.ImageUrl, row.Manufacturer, row.CrewAmount, row.MaxSpeed,
		row.Category, row.StockQuantity, row.IsActive, row.IsFeatured,
		row.CreatedAt, row.UpdatedAt), nil
}

// ListActive returns every active product ordered by created_at DESC.
func (p *Postgres) ListActive(ctx context.Context) ([]Product, error) {
	rows, err := p.q.ListActiveProducts(ctx)
	if err != nil {
		return nil, fmt.Errorf("postgres: list active: %w", err)
	}
	out := make([]Product, 0, len(rows))
	for _, r := range rows {
		out = append(out, rowToProduct(r.ID, r.Name, r.Description, r.PriceCents,
			r.ImageUrl, r.Manufacturer, r.CrewAmount, r.MaxSpeed,
			r.Category, r.StockQuantity, r.IsActive, r.IsFeatured,
			r.CreatedAt, r.UpdatedAt))
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
	return rowToProduct(row.ID, row.Name, row.Description, row.PriceCents,
		row.ImageUrl, row.Manufacturer, row.CrewAmount, row.MaxSpeed,
		row.Category, row.StockQuantity, row.IsActive, row.IsFeatured,
		row.CreatedAt, row.UpdatedAt), nil
}

// DeleteAll truncates the products table. Seeder-only helper.
func (p *Postgres) DeleteAll(ctx context.Context) error {
	if err := p.q.TruncateProducts(ctx); err != nil {
		return fmt.Errorf("postgres: truncate products: %w", err)
	}
	return nil
}

// rowToProduct translates individual column values into the domain Product.
// It accepts fields explicitly so it can serve all sqlc per-query row types
// (GetProductByIDRow, ListActiveProductsRow, InsertProductRow, etc.) without
// requiring a separate converter for each generated struct.
func rowToProduct(
	id uuid.UUID,
	name string,
	description string,
	priceCents int64,
	imageUrl *string,
	manufacturer *string,
	crewAmount *int32,
	maxSpeed *string,
	category string,
	stockQuantity int32,
	isActive bool,
	isFeatured bool,
	createdAt time.Time,
	updatedAt time.Time,
) Product {
	return Product{
		ID:            id,
		Name:          name,
		Description:   description,
		PriceCents:    priceCents,
		ImageURL:      imageUrl,
		Manufacturer:  manufacturer,
		CrewAmount:    crewAmount,
		MaxSpeed:      maxSpeed,
		Category:      Category(category),
		StockQuantity: stockQuantity,
		IsActive:      isActive,
		IsFeatured:    isFeatured,
		CreatedAt:     createdAt,
		UpdatedAt:     updatedAt,
	}
}
