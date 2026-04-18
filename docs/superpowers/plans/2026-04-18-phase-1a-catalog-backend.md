# Phase 1a — Catalog Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an `is_featured` column to the `products` table and expose a `?featured=true&limit=N` variant on `GET /api/products`, so the frontend can render a curated featured section on the home page.

**Architecture:** Additive only. New goose migration with a partial index on featured rows. Existing sqlc queries get the new column added to their `SELECT` lists; one new `:many` query (`ListFeaturedProducts`) is added. New `Service.ListFeatured(ctx, limit)` method clamps `limit` to `[1, 24]` with default `12`. The Huma handler reads `featured` and `limit` query params and routes to the appropriate service method. Seed JSON gets an `isFeatured` field; 4 of 15 products are marked featured. OpenAPI spec regenerated and committed; the frontend codegen (Plan 1b) consumes it after merge.

**Tech Stack:** Go 1.24+, Huma v2, sqlc v1.30, pgx/v5, goose, testify. No new dependencies.

**Spec reference:** [`docs/superpowers/specs/2026-04-18-phase-1-catalog-design.md`](../specs/2026-04-18-phase-1-catalog-design.md) Section 1.

---

## Task 1: Goose migration + sqlc query updates + Go regeneration

**Files:**
- Create: `backend/migrations/20260418120000_add_products_is_featured.sql`
- Modify: `backend/internal/catalog/queries.sql`
- Modify: `backend/internal/catalog/postgres.go` (add `IsFeatured` to `rowToProduct`)
- Modify: `backend/internal/catalog/domain.go` (add `IsFeatured bool` field)
- Regenerate: `backend/internal/catalog/db/models.go`, `backend/internal/catalog/db/queries.sql.go`

- [ ] **Step 1: Create branch**

```bash
cd /home/z3tz3r0/Projects/ecommerce-space-craft
git checkout main && git pull
git checkout -b phase-1a/catalog-backend
```

- [ ] **Step 2: Write the goose migration**

Create `backend/migrations/20260418120000_add_products_is_featured.sql`:

```sql
-- +goose Up
ALTER TABLE products
  ADD COLUMN is_featured BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX idx_products_featured
  ON products (is_featured)
  WHERE is_featured = true;

-- +goose Down
DROP INDEX IF EXISTS idx_products_featured;
ALTER TABLE products DROP COLUMN IF EXISTS is_featured;
```

- [ ] **Step 3: Apply migration locally to verify it parses**

Run: `make migrate-up`
Expected output: includes `OK   20260418120000_add_products_is_featured.sql`

If `DATABASE_URL` is not set locally, source `backend/.env` first: `set -a; source backend/.env; set +a; make migrate-up`.

- [ ] **Step 4: Roll back and reapply to confirm down migration works**

```bash
make migrate-down
make migrate-up
```

Expected: both succeed, `make migrate-status` shows the new migration as applied.

- [ ] **Step 5: Update sqlc queries to include is_featured + add featured query**

Replace the entire contents of `backend/internal/catalog/queries.sql`:

```sql
-- name: GetProductByID :one
SELECT
    id, name, description, price_cents, image_url,
    manufacturer, crew_amount, max_speed, category,
    stock_quantity, is_active, is_featured, created_at, updated_at
FROM products
WHERE id = $1 AND is_active = true;

-- name: ListActiveProducts :many
SELECT
    id, name, description, price_cents, image_url,
    manufacturer, crew_amount, max_speed, category,
    stock_quantity, is_active, is_featured, created_at, updated_at
FROM products
WHERE is_active = true
ORDER BY created_at DESC;

-- name: ListFeaturedProducts :many
SELECT
    id, name, description, price_cents, image_url,
    manufacturer, crew_amount, max_speed, category,
    stock_quantity, is_active, is_featured, created_at, updated_at
FROM products
WHERE is_active = true AND is_featured = true
ORDER BY created_at DESC
LIMIT $1;

-- name: InsertProduct :one
INSERT INTO products (
    name, description, price_cents, image_url,
    manufacturer, crew_amount, max_speed, category,
    stock_quantity, is_active, is_featured
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
)
RETURNING id, name, description, price_cents, image_url,
    manufacturer, crew_amount, max_speed, category,
    stock_quantity, is_active, is_featured, created_at, updated_at;

-- name: TruncateProducts :exec
TRUNCATE products;
```

- [ ] **Step 6: Regenerate sqlc Go code**

Run: `make sqlc-generate`
Expected: no output on success. Verify the change with:
```bash
git diff backend/internal/catalog/db/models.go backend/internal/catalog/db/queries.sql.go
```
Both files should now include `IsFeatured bool` in the `Product` struct and on every query that returns it. A new `ListFeaturedProducts` function should exist.

- [ ] **Step 7: Add IsFeatured to the domain Product struct**

Modify `backend/internal/catalog/domain.go` — replace the existing `Product` struct (lines 36-50) with:

```go
// Product is a spacecraft offered in the store.
type Product struct {
	ID            uuid.UUID `json:"id"`
	Name          string    `json:"name"`
	Description   string    `json:"description"`
	PriceCents    int64     `json:"priceCents"`
	ImageURL      *string   `json:"imageUrl,omitempty"`
	Manufacturer  *string   `json:"manufacturer,omitempty"`
	CrewAmount    *int32    `json:"crewAmount,omitempty"`
	MaxSpeed      *string   `json:"maxSpeed,omitempty"`
	Category      Category  `json:"category"`
	StockQuantity int32     `json:"stockQuantity"`
	IsActive      bool      `json:"isActive"`
	IsFeatured    bool      `json:"isFeatured"`
	CreatedAt     time.Time `json:"createdAt"`
	UpdatedAt     time.Time `json:"updatedAt"`
}
```

- [ ] **Step 8: Update rowToProduct mapping**

Modify `backend/internal/catalog/postgres.go` — in `rowToProduct` (lines 95-111), add the `IsFeatured` field after `IsActive`:

```go
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
		IsFeatured:    r.IsFeatured,
		CreatedAt:     r.CreatedAt,
		UpdatedAt:     r.UpdatedAt,
	}
}
```

- [ ] **Step 9: Update CreateInput + Create to pass IsFeatured**

Modify `backend/internal/catalog/postgres.go`:

In `CreateInput` (lines 51-62), add `IsFeatured bool` after `IsActive`:

```go
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
```

In `Create` (lines 67-84), add `IsFeatured: in.IsFeatured` to the `InsertProductParams` struct literal:

```go
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
	return rowToProduct(row), nil
}
```

- [ ] **Step 10: Verify build**

Run: `cd backend && go build ./...`
Expected: exit 0, no output.

- [ ] **Step 11: Commit**

```bash
cd /home/z3tz3r0/Projects/ecommerce-space-craft
git add backend/migrations/20260418120000_add_products_is_featured.sql \
        backend/internal/catalog/queries.sql \
        backend/internal/catalog/db/models.go \
        backend/internal/catalog/db/queries.sql.go \
        backend/internal/catalog/domain.go \
        backend/internal/catalog/postgres.go
git commit -m "feat(catalog): add is_featured column and sqlc plumbing"
```

---

## Task 2: ListFeatured repository method + service + tests

**Files:**
- Modify: `backend/internal/catalog/repository.go` (extend interface)
- Modify: `backend/internal/catalog/postgres.go` (implement repo method)
- Modify: `backend/internal/catalog/service.go` (add ListFeatured)
- Modify: `backend/internal/catalog/service_test.go` (mockRepo extension + new tests)

- [ ] **Step 1: Extend Repository interface**

Replace the contents of `backend/internal/catalog/repository.go`:

```go
package catalog

import (
	"context"

	"github.com/google/uuid"
)

// Repository is the storage-facing interface the catalog Service depends on.
// Implementations must be safe for concurrent use.
type Repository interface {
	GetByID(ctx context.Context, id uuid.UUID) (Product, error)
	ListActive(ctx context.Context) ([]Product, error)
	ListFeatured(ctx context.Context, limit int32) ([]Product, error)
}
```

- [ ] **Step 2: Implement ListFeatured on Postgres**

Modify `backend/internal/catalog/postgres.go`. Add this method after `ListActive` (around line 49):

```go
// ListFeatured returns at most `limit` featured + active products,
// ordered by created_at DESC.
func (p *Postgres) ListFeatured(ctx context.Context, limit int32) ([]Product, error) {
	rows, err := p.q.ListFeaturedProducts(ctx, limit)
	if err != nil {
		return nil, fmt.Errorf("postgres: list featured: %w", err)
	}
	out := make([]Product, 0, len(rows))
	for _, r := range rows {
		out = append(out, rowToProduct(r))
	}
	return out, nil
}
```

- [ ] **Step 3: Add Service.ListFeatured with limit clamping**

Modify `backend/internal/catalog/service.go`. Append at the end of the file (after `ListActive`):

```go
// Featured limits.
const (
	defaultFeaturedLimit int32 = 12
	maxFeaturedLimit     int32 = 24
)

// ListFeatured returns featured active products, capped to `limit` items.
// A non-positive limit becomes the default (12); a too-large limit is clamped to 24.
func (s *Service) ListFeatured(ctx context.Context, limit int32) ([]Product, error) {
	if limit <= 0 {
		limit = defaultFeaturedLimit
	}
	if limit > maxFeaturedLimit {
		limit = maxFeaturedLimit
	}
	ps, err := s.repo.ListFeatured(ctx, limit)
	if err != nil {
		return nil, fmt.Errorf("catalog: list featured: %w", err)
	}
	return ps, nil
}
```

- [ ] **Step 4: Build to verify (mockRepo will fail to satisfy the interface — expected)**

Run: `cd backend && go build ./...`
Expected: build error mentioning `mockRepo does not implement Repository (missing ListFeatured method)`. This is the failing-test setup; we'll add the test next.

- [ ] **Step 5: Extend mockRepo + write failing tests for ListFeatured**

Modify `backend/internal/catalog/service_test.go`. Add `listFeaturedFn` to the `mockRepo` struct (around line 17) and add a method:

```go
type mockRepo struct {
	getByIDFn      func(ctx context.Context, id uuid.UUID) (catalog.Product, error)
	listActiveFn   func(ctx context.Context) ([]catalog.Product, error)
	listFeaturedFn func(ctx context.Context, limit int32) ([]catalog.Product, error)
}

func (m mockRepo) GetByID(ctx context.Context, id uuid.UUID) (catalog.Product, error) {
	return m.getByIDFn(ctx, id)
}

func (m mockRepo) ListActive(ctx context.Context) ([]catalog.Product, error) {
	return m.listActiveFn(ctx)
}

func (m mockRepo) ListFeatured(ctx context.Context, limit int32) ([]catalog.Product, error) {
	return m.listFeaturedFn(ctx, limit)
}
```

Then append five new tests at the bottom of the file:

```go
func TestService_ListFeatured_DefaultLimit_When_LimitZero(t *testing.T) {
	var captured int32
	repo := mockRepo{
		listFeaturedFn: func(_ context.Context, limit int32) ([]catalog.Product, error) {
			captured = limit
			return nil, nil
		},
	}
	svc := catalog.NewService(repo)

	_, err := svc.ListFeatured(context.Background(), 0)
	require.NoError(t, err)
	require.Equal(t, int32(12), captured)
}

func TestService_ListFeatured_DefaultLimit_When_LimitNegative(t *testing.T) {
	var captured int32
	repo := mockRepo{
		listFeaturedFn: func(_ context.Context, limit int32) ([]catalog.Product, error) {
			captured = limit
			return nil, nil
		},
	}
	svc := catalog.NewService(repo)

	_, err := svc.ListFeatured(context.Background(), -5)
	require.NoError(t, err)
	require.Equal(t, int32(12), captured)
}

func TestService_ListFeatured_HonoursCustomLimit(t *testing.T) {
	var captured int32
	repo := mockRepo{
		listFeaturedFn: func(_ context.Context, limit int32) ([]catalog.Product, error) {
			captured = limit
			return nil, nil
		},
	}
	svc := catalog.NewService(repo)

	_, err := svc.ListFeatured(context.Background(), 7)
	require.NoError(t, err)
	require.Equal(t, int32(7), captured)
}

func TestService_ListFeatured_ClampsLimitToMax(t *testing.T) {
	var captured int32
	repo := mockRepo{
		listFeaturedFn: func(_ context.Context, limit int32) ([]catalog.Product, error) {
			captured = limit
			return nil, nil
		},
	}
	svc := catalog.NewService(repo)

	_, err := svc.ListFeatured(context.Background(), 100)
	require.NoError(t, err)
	require.Equal(t, int32(24), captured)
}

func TestService_ListFeatured_PropagatesRepoError(t *testing.T) {
	boom := errors.New("db exploded")
	repo := mockRepo{
		listFeaturedFn: func(_ context.Context, _ int32) ([]catalog.Product, error) {
			return nil, boom
		},
	}
	svc := catalog.NewService(repo)

	_, err := svc.ListFeatured(context.Background(), 5)
	require.Error(t, err)
	require.ErrorIs(t, err, boom)
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd backend && go test ./internal/catalog/... -race -count=1 -v -run TestService_ListFeatured`
Expected: 5 PASSes — `TestService_ListFeatured_DefaultLimit_When_LimitZero`, `_When_LimitNegative`, `_HonoursCustomLimit`, `_ClampsLimitToMax`, `_PropagatesRepoError`.

- [ ] **Step 7: Run the full backend test suite to confirm no regressions**

Run: `make test-backend`
Expected: all tests pass with `-race -count=1`. The pre-existing 5 service tests (`GetByID_*`, `ListActive_*`) still pass.

- [ ] **Step 8: Commit**

```bash
git add backend/internal/catalog/repository.go \
        backend/internal/catalog/postgres.go \
        backend/internal/catalog/service.go \
        backend/internal/catalog/service_test.go
git commit -m "feat(catalog): add Service.ListFeatured with limit clamping"
```

---

## Task 3: Handler `?featured=true&limit=N` query param

**Files:**
- Modify: `backend/internal/catalog/handler.go`
- Modify: `backend/cmd/openapi/main.go` (add ListFeatured to nopRepo)

- [ ] **Step 1: Update the nopRepo in cmd/openapi to satisfy the new interface method**

Modify `backend/cmd/openapi/main.go`. Append a new method on `nopRepo` (after the existing `ListActive` stub, around line 47):

```go
func (nopRepo) ListFeatured(_ context.Context, _ int32) ([]catalog.Product, error) {
	return nil, nil
}
```

- [ ] **Step 2: Replace the handler.go contents**

Replace the entirety of `backend/internal/catalog/handler.go`:

```go
package catalog

import (
	"context"
	"log/slog"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
)

// Register registers all catalog endpoints on the given Huma API.
func Register(api huma.API, svc *Service, logger *slog.Logger) {
	huma.Register(api, huma.Operation{
		OperationID: "listProducts",
		Method:      http.MethodGet,
		Path:        "/api/products",
		Summary:     "List active products, optionally filtered to featured only",
		Tags:        []string{"Catalog"},
	}, func(ctx context.Context, in *ListProductsInput) (*ListProductsOutput, error) {
		if in.Featured {
			products, err := svc.ListFeatured(ctx, in.Limit)
			if err != nil {
				return nil, mapError(logger, err)
			}
			return &ListProductsOutput{Body: products}, nil
		}
		products, err := svc.ListActive(ctx)
		if err != nil {
			return nil, mapError(logger, err)
		}
		return &ListProductsOutput{Body: products}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "getProduct",
		Method:      http.MethodGet,
		Path:        "/api/products/{id}",
		Summary:     "Fetch a single product by id",
		Tags:        []string{"Catalog"},
	}, func(ctx context.Context, in *GetProductInput) (*GetProductOutput, error) {
		p, err := svc.GetByID(ctx, in.ID)
		if err != nil {
			return nil, mapError(logger, err)
		}
		return &GetProductOutput{Body: p}, nil
	})
}

// ListProductsInput is the Huma input for the catalog list endpoint.
//
// When Featured is false (the default), Limit is ignored and ALL active
// products are returned. When Featured is true, Limit caps the result count;
// the service applies a default of 12 and a hard ceiling of 24.
type ListProductsInput struct {
	Featured bool  `query:"featured" doc:"Return only featured products"`
	Limit    int32 `query:"limit" minimum:"0" maximum:"24" doc:"Optional cap on featured results (default 12, max 24); ignored when featured is false"`
}

// GetProductInput is the Huma input for fetching a single product.
type GetProductInput struct {
	ID string `path:"id" doc:"Product UUID"`
}

// GetProductOutput wraps a single Product.
type GetProductOutput struct {
	Body Product
}

// ListProductsOutput wraps the product list.
type ListProductsOutput struct {
	Body []Product
}
```

- [ ] **Step 3: Build to verify**

Run: `cd backend && go build ./...`
Expected: exit 0, no output.

- [ ] **Step 4: Run the full backend test suite**

Run: `make test-backend`
Expected: all tests pass.

- [ ] **Step 5: Sanity-check the new endpoint against a local DB**

If a local Postgres + applied migration is available, start the API:

```bash
make dev-backend &
sleep 3
curl -s 'http://localhost:8080/api/products?featured=true' | head -c 200
curl -s 'http://localhost:8080/api/products?featured=true&limit=2' | head -c 200
curl -s 'http://localhost:8080/api/products' | head -c 200
kill %1
```

Expected: each call returns a JSON array (possibly empty since seed hasn't been re-run yet — that's Task 4). All return HTTP 200.

If no local DB is configured, skip this step — CI will exercise it after deploy.

- [ ] **Step 6: Commit**

```bash
git add backend/internal/catalog/handler.go backend/cmd/openapi/main.go
git commit -m "feat(catalog): handle ?featured=true&limit=N query params"
```

---

## Task 4: Seed data — mark 4 products featured

**Files:**
- Modify: `backend/data/products.json` (add `isFeatured: true` to 4 products from 4 distinct categories)
- Modify: `backend/cmd/seed/main.go` (pass `IsFeatured` to `CreateInput`)

- [ ] **Step 1: Inspect the current seed data to pick 4 products from 4 different categories**

Run: `cat backend/data/products.json | head -80`

Identify 4 products spanning 4 distinct `category` values (Fighter, Freighter, Shuttle, Speeder, Cruiser, or Capital Ship). Note their array indices — the seed file order is the insertion order, which combined with `created_at DESC` ordering in the featured query determines display order on the home page.

- [ ] **Step 2: Add the IsFeatured field to the seedProduct struct**

Modify `backend/cmd/seed/main.go`. In the `seedProduct` struct (around lines 21-32), add `IsFeatured` after `IsActive`:

```go
type seedProduct struct {
	Name          string  `json:"name"`
	Description   string  `json:"description"`
	PriceCents    int64   `json:"priceCents"`
	ImageURL      *string `json:"imageUrl,omitempty"`
	Manufacturer  *string `json:"manufacturer,omitempty"`
	CrewAmount    *int32  `json:"crewAmount,omitempty"`
	MaxSpeed      *string `json:"maxSpeed,omitempty"`
	Category      string  `json:"category"`
	StockQuantity int32   `json:"stockQuantity"`
	IsActive      bool    `json:"isActive"`
	IsFeatured    bool    `json:"isFeatured,omitempty"`
}
```

- [ ] **Step 3: Pass IsFeatured into the CreateInput call**

In `backend/cmd/seed/main.go`, the loop at the bottom of `main()` calls `store.Create(ctx, catalog.CreateInput{...})`. Locate this block and add `IsFeatured: it.IsFeatured` to the `CreateInput` literal (after `IsActive`).

The full updated `Create` block:

```go
for _, it := range items {
	if _, err := store.Create(ctx, catalog.CreateInput{
		Name:          it.Name,
		Description:   it.Description,
		PriceCents:    it.PriceCents,
		ImageURL:      it.ImageURL,
		Manufacturer:  it.Manufacturer,
		CrewAmount:    it.CrewAmount,
		MaxSpeed:      it.MaxSpeed,
		Category:      catalog.Category(it.Category),
		StockQuantity: it.StockQuantity,
		IsActive:      it.IsActive,
		IsFeatured:    it.IsFeatured,
	}); err != nil {
		log.Fatalf("create %q: %v", it.Name, err)
	}
}
```

(If the existing block uses different formatting, preserve the existing style — just add the `IsFeatured` line.)

- [ ] **Step 4: Mark 4 products featured in products.json**

Add `"isFeatured": true` to **exactly 4 products** in `backend/data/products.json`. Pick one product each from 4 distinct categories so the home featured section shows variety.

For each chosen product, add the field as the last property in its JSON object. Example diff for one product:

```diff
   {
     "name": "X-Wing T-65",
     "description": "...",
     "priceCents": 12500000,
     "category": "Fighter",
     "stockQuantity": 8,
-    "isActive": true
+    "isActive": true,
+    "isFeatured": true
   }
```

Repeat for 3 more products in 3 different categories. The other 11 products do not need the field — Go's `omitempty` + JSON unmarshal default to `false`.

- [ ] **Step 5: Verify the JSON parses**

Run: `jq 'length' backend/data/products.json`
Expected: `15`.

Then verify exactly 4 are featured:

```bash
jq '[.[] | select(.isFeatured == true)] | length' backend/data/products.json
```

Expected: `4`.

And that they span 4 distinct categories:

```bash
jq '[.[] | select(.isFeatured == true) | .category] | unique | length' backend/data/products.json
```

Expected: `4`.

- [ ] **Step 6: Run the seed locally to verify it works end-to-end**

If a local Postgres is available with the migration applied:

```bash
make seed-destroy
make seed
```

Expected: `truncated products` then no errors. Verify in psql:

```sql
SELECT count(*) FROM products;                          -- 15
SELECT count(*) FROM products WHERE is_featured = true; -- 4
SELECT category FROM products WHERE is_featured = true ORDER BY name;
```

If no local DB is available, skip — CI + Render production will exercise it.

- [ ] **Step 7: Build to verify everything still compiles**

Run: `cd backend && go build ./...`
Expected: exit 0, no output.

- [ ] **Step 8: Commit**

```bash
git add backend/cmd/seed/main.go backend/data/products.json
git commit -m "feat(seed): mark 4 products as featured across 4 categories"
```

---

## Task 5: Regenerate OpenAPI spec + push + PR + CI + merge + deploy verify

**Files:**
- Regenerate: `backend/openapi.json`

- [ ] **Step 1: Regenerate OpenAPI spec**

Run: `make openapi-dump`
Expected: `backend/openapi.json` updated. Verify the diff includes the new `isFeatured` field on the `Product` schema and the new `featured` and `limit` query parameters on the `listProducts` operation:

```bash
git diff backend/openapi.json | head -60
```

Look for: `"isFeatured":{"type":"boolean"}`, `"name":"featured"`, `"name":"limit"`.

- [ ] **Step 2: Run lint + format on backend**

```bash
make fmt-backend
make lint-backend
```

Expected: format applies trivial changes (likely none); lint exits 0.

- [ ] **Step 3: Run the full backend test suite one more time**

Run: `make test-backend`
Expected: all tests pass.

- [ ] **Step 4: Commit the regenerated OpenAPI spec**

```bash
git add backend/openapi.json
git commit -m "chore(codegen): regenerate openapi spec for is_featured + featured filter"
```

- [ ] **Step 5: Push the branch and open a PR**

```bash
git push --set-upstream origin phase-1a/catalog-backend
gh pr create --title "phase 1a — catalog backend: is_featured + ?featured query" --body "$(cat <<'EOF'
## Summary
- Adds `is_featured` boolean column to `products` (migration `20260418120000`).
- Partial index on `is_featured WHERE is_featured = true` for cheap home-page reads.
- `GET /api/products?featured=true&limit=N` returns only featured active products. Default `limit` 12, hard ceiling 24.
- 4 of 15 seed products marked featured across 4 distinct categories.
- OpenAPI spec regenerated; frontend codegen (Plan 1b) consumes it after merge.

Spec: `docs/superpowers/specs/2026-04-18-phase-1-catalog-design.md` Section 1.

## Test plan
- [x] `make test-backend` — all green incl. 5 new `Service_ListFeatured_*` tests.
- [x] Migration up/down round-trips locally.
- [x] Seed JSON parses; 4 featured products span 4 categories.
- [ ] CI green.
- [ ] Render auto-deploy completes; goose applies new migration on boot.
- [ ] Smoke test: `curl https://spacecraft-api.onrender.com/api/products?featured=true | jq 'length'` returns `4`.
- [ ] Smoke test: `curl https://spacecraft-api.onrender.com/api/products | jq 'length'` returns `15`.
EOF
)"
```

- [ ] **Step 6: Watch CI**

```bash
gh pr checks --watch
```

Expected: all checks green. If a check fails, read the log:

```bash
gh run view --log-failed
```

Investigate and push fixes as additional commits on the same branch. Do **not** force-push.

- [ ] **Step 7: Merge to main**

Once CI is green and the PR is approved (self-approve in this single-developer setup):

```bash
gh pr merge --squash --delete-branch
git checkout main && git pull
```

- [ ] **Step 8: Watch the Render deploy**

Open the Render dashboard and monitor the deploy of the `spacecraft-api` service. Expected:
- Build succeeds.
- `goose up` applies `20260418120000_add_products_is_featured.sql` cleanly.
- Service comes healthy within 60-90s.

If Render is on the free tier, the service may have been spun down — the first request after deploy can take 30-60s.

- [ ] **Step 9: Re-seed production to mark the 4 featured products**

The `is_featured` column was added with `DEFAULT false`, so existing rows have `false`. To mark the 4 featured products in production, re-run the seeder against the production database. Open the Render shell for the `spacecraft-api` service (Render dashboard → Service → Shell tab) and run:

```bash
go run ./cmd/seed -d   # truncates the products table
go run ./cmd/seed       # re-inserts 15 products incl. is_featured=true on the chosen 4
```

(If you prefer not to truncate, you can also issue an `UPDATE products SET is_featured = true WHERE name IN (...)` directly via Render's psql shell instead.)

- [ ] **Step 10: Smoke test production**

```bash
curl -s 'https://spacecraft-api.onrender.com/api/products' | jq 'length'
# expected: 15

curl -s 'https://spacecraft-api.onrender.com/api/products?featured=true' | jq 'length'
# expected: 4

curl -s 'https://spacecraft-api.onrender.com/api/products?featured=true&limit=2' | jq 'length'
# expected: 2

curl -s 'https://spacecraft-api.onrender.com/api/products?featured=true' | jq '[.[].category] | unique | length'
# expected: 4 (one product per distinct category)
```

If any call fails, retry once after 30 seconds — this is likely a Neon cold start, not a real error.

- [ ] **Step 11: Phase 1a is shipped**

Update `phase_status.md` in memory to record Plan 1a merged + verified. Plan 1b (frontend) can now branch from the freshly updated `main` and consume the regenerated OpenAPI spec.

---

## Self-review (planner-side, performed before saving)

- All five tasks have concrete code blocks for every code-change step.
- No "TBD", "TODO", or hand-wavy "implement appropriately" steps.
- Type consistency: `IsFeatured bool`, `Limit int32`, `defaultFeaturedLimit = 12`, `maxFeaturedLimit = 24` are used the same way in every task that references them.
- Task 1 commits the migration, sqlc updates, and Go regeneration together — these change as a unit.
- Task 2 adds the repo interface method, the Postgres implementation, the Service method, and tests in one task — they are tightly coupled.
- Task 3 commits handler + nopRepo together — handler change forces the nopRepo update.
- Task 4 commits seed code + seed data together.
- Task 5 commits the regenerated OpenAPI alone (codegen artifact) and handles the deploy ritual.
- Spec coverage: every spec section 1.x maps to a task above (1.1 → Task 1; 1.2 → Tasks 1+2; 1.3 → Tasks 2+3; 1.4 → Task 4; 1.5 → Task 2; 1.6 → Task 5). 1.7 is a no-op as the spec states.
- The plan ends with explicit push → PR → CI watch → merge → deploy verify steps as required by `workflow_preference.md`.
