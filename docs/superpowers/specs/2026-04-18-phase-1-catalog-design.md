# Phase 1 — Catalog: Design Spec

**Date:** 2026-04-18
**Status:** Approved (pending user review of this written spec)
**Phase:** 1 of 6
**Owner:** z3tz3r0
**Predecessor:** [Phase 0 — Foundation](./2026-04-17-phase-0-foundation-design.md)

---

## Project context

Phase 0 shipped a foundation-only release: Go + Huma + sqlc + pgx backend on Render, Bun + Vite + React 19 + TS + Tailwind v4 + shadcn/ui FSD frontend on Vercel, with a working catalog read-only endpoint and a HomePage that proves the wire by rendering "Loaded N products". No real user features.

Phase 1 adds the first real user-visible feature surface: **the public catalog**. Users can browse the spacecraft inventory, filter by category, sort by price, search by name, view a single ship's detail, and see featured ships on the home page. No auth, no cart, no checkout — those are Phases 2 and 3.

The discipline established in Phase 0 stays in force:

- **Layout-only Tailwind** — no color, typography, motion utilities through Phase 3. shadcn primitives carry their own neutral defaults; we do not theme them yet. The first styling pass is the opening work of Phase 4.
- **FSD boundaries** enforced by Steiger.
- **Codegen drift = CI failure**; generated files committed.
- **No business logic in `cmd/api/main.go`** — wiring only.
- **DDD-lite** vertical slices on the backend.
- **Phased roadmap** — brainstorm → spec → plan → execute via subagent-driven-development.

## Phase 1 scope

### In scope

| Capability | Notes |
|---|---|
| Catalog page `/products` | Filter sidebar (category multi-select), sort dropdown, search input, responsive product grid. |
| Product detail page `/products/:id` | Hero image, name, price, description, manufacturer, category, crew amount, max speed, stock display. No "Add to cart" — that's Phase 2. |
| Featured section on `/` (home) | 4 featured ships rendered as cards. Replaces the Phase 0 demo "Loaded N products" widget. |
| Stock display | Reusable badge: `In stock` / `Low stock — N left` / `Out of stock`. |
| Out-of-stock products | Visible in catalog list, marked as unavailable (structurally — no Phase 2 cart action yet). |
| URL-as-state | Filters, sort, and search query persist in `?` params. Shareable links. |
| Loading + error UX | Skeleton grid during initial load. Inline retry on error. Empty state with "Clear filters" when filter combo returns 0 results. |
| Stock badge thresholds | `>5` → In stock; `1–5` → Low stock — N left; `0` → Out of stock. |
| Backend: `is_featured` column | New boolean on `products`, partial index. 4 of 15 seeded products marked featured. |

### Explicitly out of scope (deferred)

| Deferral | Why | Picked back up in |
|---|---|---|
| Pagination | 15 products fit on one screen. Adds wiring complexity for zero current value. | Phase 4 polish, if dataset grows past ~50 products. |
| Server-side filter / sort / search | Same — at this dataset size client-side `useMemo` is faster, simpler, and validated by both donor repos and the user's own prior projects. | Phase 4 polish or earlier if needed. |
| "Add to cart" button on detail page | Cart is Phase 2. | Phase 2 (Identity & cart). |
| Wishlist, compare, related-products section on detail page | Phase 5 (engagement) and beyond. | Phase 5. |
| Multi-image product galleries | Current schema has single `image_url`. Adding galleries is a Phase 4+ polish. | Phase 4. |
| Reviews / ratings | Phase 5 (engagement). | Phase 5. |
| Price-range filter | Not in headline deliverables. Stretch goal only if cheap. | Optional Phase 1.5 if user pulls it in. |
| Playwright / E2E tests | Phase 0 already has CI-shape and manual browser-verify ritual. Vitest + RTL is enough for Phase 1. | Phase 4 polish. |
| Featured-section editorial UI (admin) | Admin is Phase 6. Manual seed update for now. | Phase 6. |

---

## Donor research

Before designing from scratch we surveyed GitHub for repos with the same stack shape (Vite + React 19 + TS + TanStack Query + radix/shadcn + Tailwind + Feature-Sliced Design + e-commerce catalog). One stood out as a near-direct stack match.

### Primary donor — `basia-borkowska/terracota-store`

A Polish pottery e-commerce SPA. Stack: Vite + React + TS + `@tanstack/react-query` + `@radix-ui/react-*` + `class-variance-authority` + `clsx` + `tailwind-merge` + `tailwindcss-animate` + `lucide-react` + `react-router-dom` + `msw`. FSD layout (`app/`, `entities/`, `features/`, `shared/`, `widgets/`).

Files we **port** (translate to our naming and types, drop Phase 1-irrelevant pieces):

| Donor file | Our destination | Adaptation |
|---|---|---|
| `src/widgets/ProductCard.tsx` | `widgets/product-card/ProductCard.tsx` | Re-skin around shadcn `Card`, layout-only Tailwind, our `Product` shape, drop wishlist button. |
| `src/app/routes/Products.tsx` | `pages/catalog/CatalogPage.tsx` | Compose our filter/sort/search features + product-grid widget. |
| `src/app/routes/Product.tsx` | `pages/product-detail/ProductDetailPage.tsx` | Drop add-to-cart, drop gallery (single image), drop wishlist/compare. |
| `src/app/routes/NewProducts.tsx` | `widgets/featured-section/FeaturedSection.tsx` | Drop "new" badge logic, use our `is_featured` boolean. |
| `src/entities/product/{api,types}.ts` | `entities/product/{api,model}/*` | Already partially exists from Phase 0; extend. |
| `src/features/catalog-filters/model/useCategoryFilter.ts` | `features/catalog-filter/model/use-category-filter.ts` | Same pattern; works against our `Category` enum. |
| `src/features/catalog-filters/ui/CategoryFilterCards.tsx` | `widgets/filter-sidebar/FilterSidebar.tsx` | Re-skin to checkbox sidebar (DV-style) using shadcn `Checkbox`. |
| `src/shared/hooks/useQueryParams.ts` | `shared/lib/use-query-params.ts` | Direct port; small generic helper. |

### Secondary donor — `itsproutorgua/olx-killer-monorepo`

A heavier Vite + React + TS + TanStack monorepo (with auth0, chakra spinner, axios — too many deps for direct adoption). We **mine for hook patterns only**:

| Donor file | What we learn |
|---|---|
| `frontend/src/entities/filter/library/hooks/use-filters-from-params.tsx` | URL-state filter hook idiom — multi-key, type-safe parse/serialise. |
| `frontend/src/entities/product/library/hooks/use-latest-products.tsx` | Featured/latest TanStack Query hook with `queryOptions` factory. |
| `frontend/src/entities/product/library/hooks/use-product.tsx` | Single-product detail query. |

### Tertiary donor — user's own `Project-Daily-Vogue`

Visual reference (validated by the user in production previously) for the **filter sidebar checkbox layout, BestSeller grid composition, SearchBar shape**. JS not TS, plain Tailwind not shadcn — used as visual reference, not direct port.

### Validation reference — `basir/next-pg-shadcn-ecommerce` (83 stars)

NextJS not Vite, so component code ports but routing/data-fetching diverges. Bookmarked for Phase 2 (cart) and Phase 6 (admin) when we want to validate UX shape against an active community project.

### Repos surveyed and rejected

| Repo | Reason rejected |
|---|---|
| `Anuarder/create-react-fsd-app` | Scaffolder CLI only — no example feature code. |
| `tigerjoy/ecommerce-feature-sliced-design` | 0★, only 3 layers (`app/pages/shared`), early-stage. |
| `kiettt23/vendoor` | NextJS + Prisma + multi-vendor marketplace — too heavy and architecturally diverged. |
| `copy-in-action/smarter-store-fe` | Despite the name, it's a performance/booking app, not a product catalog. |
| `wjlee0908/online-store` | NextJS, daisyui not shadcn. |
| `IlyaShipeev/pizza_ilyha` | Vite + FSD ✓ but MUI + Redux Toolkit. UI framework mismatch. |

---

## Locked decisions for Phase 1

These were settled during brainstorming. They are not relitigated in the body of this spec.

| Decision | Choice | Rejected alternatives & why |
|---|---|---|
| Filter / sort / search location | **Client-side** (`useMemo` over the full product list) | Server-side query params — adds backend complexity for zero current value at 15 products; both donor repos (terracota, DV) validate client-side at this scale. Migration to server-side is a contained Phase 4 task if needed. |
| Featured mechanism | **`is_featured` boolean column** + partial index | Top-N-newest (boring, no editorial control); curated category (couples featured to category which we don't want). DV's `bestseller` boolean confirms this. |
| Pagination | **None for Phase 1** | Offset / cursor — premature for 15 products. Add in Phase 4 if catalog grows. |
| Search backend | **`String.includes` over name + description, client-side** | Postgres ILIKE / FTS / pg_trgm — wrong layer for Phase 1 per the client-side decision above. |
| Sort options | **3:** newest (default) / price low-to-high / price high-to-low | DV's set; matches user expectation, simpler than my original 5. |
| List response shape | **Bare array** (unchanged from Phase 0) | Envelope `{items, total, ...}` — not needed without pagination. |
| URL-as-state | **Yes** for category, sort, q | Local `useState` only — breaks shareability and back-button behaviour. |
| Stock thresholds | `> 5` In stock · `1–5` Low stock — N left · `0` Out of stock | Other thresholds (e.g., 3, 10) — these match common ecommerce conventions and the spacecraft store's expected per-item quantities. |
| Out-of-stock product display | **Show, marked as unavailable** | Hide entirely (loses inventory transparency); show as fully clickable (misleading). Phase 2 will disable add-to-cart on these; Phase 1 just shows the badge. |
| Frontend test coverage | **Vitest + React Testing Library**, ≥80% on new feature code | Playwright E2E — deferred to Phase 4. |

---

## Section 1 — Backend changes (Plan 1a)

The backend changes are intentionally minimal because filter/sort/search runs client-side.

### 1.1 Migration

New migration `backend/migrations/<timestamp>_add_products_is_featured.sql`:

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

The partial index keeps the index small — only featured rows are indexed. The home query for featured products uses this index for an O(featured-count) scan.

### 1.2 Domain + sqlc

`backend/internal/catalog/domain.go`: add `IsFeatured bool` field to the `Product` struct (`json:"isFeatured"`).

`backend/internal/catalog/queries.sql`: extend the existing column lists in `ListActiveProducts`, `GetProductByID`, and `InsertProduct` to include `is_featured`. Add a new `:many` query:

```sql
-- name: ListFeaturedProducts :many
SELECT
    id, name, description, price_cents, image_url,
    manufacturer, crew_amount, max_speed, category,
    stock_quantity, is_active, is_featured, created_at, updated_at
FROM products
WHERE is_active = true AND is_featured = true
ORDER BY created_at DESC
LIMIT $1;
```

Regenerate with `make codegen-sqlc`.

### 1.3 Service + handler

`backend/internal/catalog/service.go`: add `ListFeatured(ctx, limit int32) ([]Product, error)`. Default limit clamped to 12 if caller passes ≤0 or >24.

`backend/internal/catalog/handler.go`: extend `ListProducts` to accept an optional `?featured=true` query param (Huma input struct field). When `featured=true`, route to `ListFeatured` with default limit 12. When omitted or `false`, behaviour unchanged from Phase 0.

```go
type ListProductsInput struct {
    Featured bool  `query:"featured" doc:"Return only featured products"`
    Limit    int32 `query:"limit" minimum:"1" maximum:"24" doc:"Cap on number of items returned (only honoured when featured=true)"`
}
```

The `limit` param is **only honoured when `featured=true`**. For non-featured calls the existing "all active products" behaviour stands. This avoids implementing pagination prematurely.

### 1.4 Seed data

Update `backend/cmd/seed/main.go` (or wherever seeds live) to set `is_featured = true` on 4 of the 15 products. Pick 1 from each of 4 different categories so the home featured section shows variety.

### 1.5 Tests

Backend test additions in `backend/internal/catalog/service_test.go`:

- `TestService_ListFeatured_DefaultLimit` — pass 0, expect default (12).
- `TestService_ListFeatured_CustomLimit` — pass 5, expect 5.
- `TestService_ListFeatured_OverMax` — pass 100, expect clamped to 24.
- `TestService_ListFeatured_FiltersInactive` — inactive featured products excluded.
- `TestService_ListFeatured_OrderedByCreatedAtDesc` — verifies ordering.

Repository tests against the existing testcontainers Postgres pattern (already established in Phase 0).

### 1.6 OpenAPI regen

After handler changes, run `make codegen-openapi` to regenerate `backend/openapi.json`. Frontend codegen runs in Plan 1b.

### 1.7 CORS, logging, deploy

No changes. Existing CORS allowlist + slog middleware + Render auto-deploy work as-is.

---

## Section 2 — Frontend architecture (Plan 1b)

### 2.1 Routing

```
/                         HomePage           — hero placeholder + featured-section widget
/products                 CatalogPage        — filter sidebar + sort + search + grid
/products/:id             ProductDetailPage  — full product info, stock badge
```

`react-router` v7 (the `react-router` package — `-dom` was removed in v7) is already wired in Phase 0. Phase 1 just adds the two new route definitions in `app/providers/router/`.

### 2.2 FSD layer placement

```
src/
├── entities/
│   └── product/
│       ├── api/
│       │   ├── use-products.ts            (extend Phase 0 hook — keep current shape)
│       │   ├── use-product.ts             (NEW — single by id)
│       │   ├── use-featured-products.ts   (NEW — calls ?featured=true)
│       │   └── product-keys.ts            (NEW — query key factory)
│       ├── model/
│       │   ├── types.ts                   (re-export OpenAPI Product type, add Category union)
│       │   └── stock.ts                   (NEW — stockStatus(qty) → 'in' | 'low' | 'out')
│       ├── ui/
│       │   └── stock-badge/               (NEW — visual badge for the 3 statuses)
│       └── index.ts                        (Public API)
│
├── features/
│   ├── catalog-filter/
│   │   ├── model/use-category-filter.ts   (URL ↔ Category[] state)
│   │   └── index.ts
│   ├── catalog-sort/
│   │   ├── model/use-sort-order.ts        (URL ↔ SortOrder)
│   │   ├── ui/SortDropdown.tsx
│   │   └── index.ts
│   └── catalog-search/
│       ├── model/use-search-query.ts      (URL ↔ q with 300ms debounce)
│       ├── ui/SearchInput.tsx
│       └── index.ts
│
├── widgets/
│   ├── product-card/
│   │   ├── ProductCard.tsx                (port from terracota — shadcn Card, layout only)
│   │   └── index.ts
│   ├── product-grid/
│   │   ├── ProductGrid.tsx                (responsive grid + skeleton + empty + error)
│   │   ├── ProductGridSkeleton.tsx
│   │   └── index.ts
│   ├── filter-sidebar/
│   │   ├── FilterSidebar.tsx              (composes catalog-filter feature, shadcn Checkbox)
│   │   └── index.ts
│   └── featured-section/
│       ├── FeaturedSection.tsx            (uses use-featured-products, renders ProductCard grid)
│       └── index.ts
│
├── pages/
│   ├── home/
│   │   └── ui/HomePage.tsx                (replace Phase 0 demo with FeaturedSection)
│   ├── catalog/
│   │   └── ui/CatalogPage.tsx             (NEW — composes everything)
│   └── product-detail/
│       └── ui/ProductDetailPage.tsx       (NEW — single product view)
│
└── shared/
    ├── lib/
    │   ├── use-query-params.ts            (NEW — port from terracota)
    │   ├── format-price.ts                (NEW — cents → "$1,234.56")
    │   └── ...existing
    └── ...existing
```

### 2.3 URL state design

The catalog URL is the source of truth for filters, sort, and search. Example:

```
/products?category=Fighter&category=Cruiser&sort=price-asc&q=tie
```

`shared/lib/use-query-params.ts` provides a typed wrapper around `useSearchParams`:

- Multi-value keys (`category`) round-trip as repeated `?category=A&category=B`.
- Single-value keys (`sort`, `q`) round-trip as `?sort=...&q=...`.
- Default values are stripped from the URL when set (e.g., `sort=newest` doesn't appear in the URL).
- Setting a value to its default removes it from the URL.

The three feature hooks (`use-category-filter`, `use-sort-order`, `use-search-query`) wrap this for their own concern. They read from the URL on render and provide a setter that pushes a new URL state.

`use-search-query` adds a 300ms debounce on the input → URL push: the controlled input updates immediately (so the user sees what they're typing), and the URL push fires 300ms after the last keystroke. The debounce is implemented with a single `setTimeout` ref pattern, no extra library.

### 2.4 TanStack Query keys

`entities/product/api/product-keys.ts`:

```ts
export const productKeys = {
  all: ['products'] as const,
  list: () => [...productKeys.all, 'list'] as const,
  detail: (id: string) => [...productKeys.all, 'detail', id] as const,
  featured: (limit: number) => [...productKeys.all, 'featured', limit] as const,
};
```

The list hook uses **a single key** because filter/sort/search happens client-side over the full list — no need to vary the cache by params. This is one of the wins of the client-side approach: one fetch, infinite filter combos.

### 2.5 Page composition

`pages/catalog/ui/CatalogPage.tsx`:

```tsx
export function CatalogPage() {
  const { data: products, isLoading, isError, refetch } = useProducts();
  const [categories] = useCategoryFilter();
  const [sort] = useSortOrder();
  const [q] = useSearchQuery();

  const visibleProducts = useMemo(() => {
    if (!products) return [];
    let result = products;
    if (categories.length > 0) {
      result = result.filter((p) => categories.includes(p.category));
    }
    if (q.trim() !== '') {
      const needle = q.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(needle) ||
          p.description.toLowerCase().includes(needle),
      );
    }
    result = sortProducts(result, sort);
    return result;
  }, [products, categories, sort, q]);
  // sortProducts is a small pure helper in entities/product/lib/sort.ts

  return (
    <div className="flex flex-col gap-8 lg:flex-row">
      <FilterSidebar />
      <div className="flex-1">
        <div className="mb-4 flex justify-between gap-4">
          <SearchInput />
          <SortDropdown />
        </div>
        <ProductGrid
          products={visibleProducts}
          isLoading={isLoading}
          isError={isError}
          onRetry={refetch}
        />
      </div>
    </div>
  );
}
```

Note: layout-only utilities throughout (`flex`, `flex-col`, `lg:flex-row`, `gap-*`, `mb-*`, `flex-1`, `justify-between`). No color, typography, or motion utilities.

### 2.6 Stock display

`entities/product/model/stock.ts`:

```ts
export type StockStatus = 'in' | 'low' | 'out';

export function stockStatus(quantity: number): StockStatus {
  if (quantity <= 0) return 'out';
  if (quantity <= 5) return 'low';
  return 'in';
}
```

`entities/product/ui/stock-badge/StockBadge.tsx` renders the appropriate label using shadcn `Badge` (its built-in default variants: `default`, `secondary`, `destructive`). No custom colors.

| Status | Badge variant | Label |
|---|---|---|
| `in` | `default` | `In stock` |
| `low` | `secondary` | `Low stock — N left` |
| `out` | `outline` | `Out of stock` |

We deliberately do **not** use the shadcn `destructive` variant for out-of-stock, because `destructive` carries red color semantics that fall outside the "neutral defaults" allowance of the layout-only discipline. `outline` keeps the badge visually distinct while staying within neutral primitive defaults. Phase 4 will introduce intentional color treatments and may revisit this choice.

### 2.7 Out-of-stock product cards

In `widgets/product-card/ProductCard.tsx`, when `stockStatus(product.stockQuantity) === 'out'`:

- Card remains clickable (links to detail page so users can read the description and see "Out of stock" badge)
- The "Out of stock" `StockBadge` is rendered prominently in the card
- No add-to-cart button anywhere in Phase 1, so no disable logic needed yet

Phase 2 will introduce add-to-cart and the disabled state for out-of-stock items. We're **not** pre-building Phase 2 affordances here.

### 2.8 Loading + error UX

| State | Behaviour |
|---|---|
| Initial load | `ProductGridSkeleton` with 8 placeholder cards (shadcn `Skeleton`). |
| Empty (no products from API) | "No products available" message — should not occur in normal operation. |
| Empty (filter combo returns 0) | "No spacecraft match your filters" + "Clear filters" button that resets URL params. |
| API error | Inline error card with `Try again` button (calls `refetch()`). |
| Detail page load | Top-level `Skeleton` block. |
| Detail page 404 | "Spacecraft not found" + link back to `/products`. |

### 2.9 Codegen

After Plan 1a backend changes land:

1. `make codegen-openapi` regenerates `backend/openapi.json`.
2. `make codegen-ts` regenerates `frontend/src/shared/api/generated/types.ts` from the new spec.

The new `Product` type now has `isFeatured`. The new `useFeaturedProducts` hook calls `api.GET("/api/products", { params: { query: { featured: true } } })`.

CI's existing codegen-drift check fails the build if either side is out of sync.

---

## Section 3 — Tests

### 3.1 Coverage target

≥80% on new feature code (entities, features, widgets, pages added in Phase 1). Coverage measured via Vitest's built-in coverage (`bun run test:coverage`).

### 3.2 Test types

| File | Test |
|---|---|
| `entities/product/model/stock.test.ts` | Threshold logic for all 3 statuses incl. boundary values (0, 1, 5, 6, large). |
| `entities/product/ui/stock-badge/StockBadge.test.tsx` | Each variant renders correct label. |
| `shared/lib/format-price.test.ts` | Cents → string formatting incl. zero, small, large, edge cases. |
| `shared/lib/use-query-params.test.ts` | Multi-value keys, default stripping, single-value round-trips. |
| `features/catalog-filter/model/use-category-filter.test.ts` | URL ↔ Category[] (via vitest + RTL with MemoryRouter). |
| `features/catalog-sort/model/use-sort-order.test.ts` | URL ↔ SortOrder, default elision. |
| `features/catalog-search/model/use-search-query.test.ts` | Debounced URL push (vi.useFakeTimers). |
| `widgets/product-card/ProductCard.test.tsx` | Renders for in/low/out stock; links to detail page; handles missing image. |
| `widgets/product-grid/ProductGrid.test.tsx` | Skeleton during loading; empty state; error state; renders cards. |
| `widgets/filter-sidebar/FilterSidebar.test.tsx` | Category click pushes URL; reflects current state. |
| `widgets/featured-section/FeaturedSection.test.tsx` | Renders 4 cards from mock featured response. |
| `pages/catalog/ui/CatalogPage.test.tsx` | Integration: mock `useProducts` with 15 mock products, verify filter+sort+search+empty-state interactions. |
| `pages/product-detail/ui/ProductDetailPage.test.tsx` | Renders all fields; 404 path; loading skeleton. |

### 3.3 Mocking

Per Phase 0 convention: `vi.mock` the entity hooks at the test boundary; do not mock at the network layer for unit tests. Page-level integration tests use `vi.mock('@/entities/product/api/use-products')` and pass mock data.

The codegen pipeline guarantees the OpenAPI shape; tests don't re-validate it.

---

## Section 4 — Deployment

### 4.1 Backend (Render)

- Plan 1a's migration runs automatically on deploy via the existing goose-on-boot wiring from Phase 0.
- No new env vars.
- No CORS changes.
- Render auto-deploys on merge to `main`.

### 4.2 Frontend (Vercel)

- Plan 1b's PR triggers a Vercel preview deploy automatically.
- After merge, Vercel auto-deploys to `https://ecommerce-space-craft.vercel.app/`.
- No new env vars.
- Smoke-test plan: see Section 5.

### 4.3 Order of merge

Plan 1a (backend) **must merge before** Plan 1b (frontend) because the frontend's regenerated `types.ts` and the `useFeaturedProducts` hook depend on the new `?featured=true` query param and the `is_featured` field on `Product`. Order:

1. Plan 1a PR opens → CI passes → merge → Render deploys → backend smoke test.
2. Pull `main` into the Plan 1b branch (or rebase) → re-run codegen → push → CI passes → merge → Vercel deploys → frontend smoke test.

### 4.4 Render free-tier cold-start reminder

The first request after ~15 min idle takes 30–60s. Smoke tests should retry once before assuming a real failure. (Already documented in `render_backend_quirks.md`.)

---

## Section 5 — Success criteria

The phase is shipped when all of the following are true and **the user has confirmed in a real browser**:

1. **Backend**:
   - `GET /api/products` (no params) returns all 15 active products incl. new `isFeatured` field.
   - `GET /api/products?featured=true` returns 4 products.
   - `GET /api/products?featured=true&limit=2` returns 2 products.
   - `GET /api/products/{id}` returns a single product incl. `isFeatured`.
   - All backend tests pass with ≥80% coverage on the catalog package.
   - Render deploy is healthy after at least one cold start.

2. **Frontend**:
   - `/` renders a hero placeholder + a featured section showing 4 ships.
   - `/products` renders all 15 ships in a grid.
   - Clicking a category checkbox filters the grid and updates the URL.
   - Clicking sort dropdown reorders the grid and updates the URL.
   - Typing in search debounces (300ms) then filters the grid and updates the URL.
   - Clearing all filters via "Clear filters" returns to all 15 ships.
   - `/products/:id` renders all product fields incl. stock badge.
   - Stock badge shows correctly for in / low / out variants.
   - Direct navigation to `/products?category=Fighter&sort=price-asc` reproduces the filtered view (URL-as-state round-trip).
   - All frontend tests pass with ≥80% coverage on Phase 1 code.
   - Vercel deploy is live at the canonical URL.
   - Layout-only Tailwind discipline is intact (no color/typography/motion utilities in commits).

3. **Integration**:
   - Browsing `/products` on Vercel hits the live Render API and shows the 15 ships (after cold-start retry if needed).
   - The featured section on `/` matches the products marked `is_featured=true` in the database.
   - Refresh on a deep route (`/products/<id>`) does not 404 (Vercel SPA rewrite was set up in Phase 0).

---

## Section 6 — Risks & mitigations

| Risk | Mitigation |
|---|---|
| Client-side filter doesn't scale past ~50 products. | Documented as a known limitation; Phase 4 polish has a contained migration to server-side params. The TanStack Query key factory already isolates the boundary. |
| `useQueryParams` debounce + multi-value keys are surprisingly subtle to test. | Use `vi.useFakeTimers()` and `MemoryRouter` from `react-router`. Reference terracota's implementation as the donor; if their tests are good, port them too. |
| `is_featured` migration on a deployed Render Postgres. | The migration is additive (`ADD COLUMN ... DEFAULT false`) so it's safe on a non-empty table. goose runs it on boot; no manual step. |
| Out-of-stock UX feels half-baked without add-to-cart context. | Acceptable — Phase 1 is intentionally pre-cart. The badge alone communicates the state. Phase 2 completes the loop. |
| Layout-only Tailwind discipline slips during card design. | Steiger doesn't catch this; rely on PR review + the explicit checklist in CLAUDE.md. The donor (terracota) used Tailwind freely so we must scrub their classes when porting. |
| terracota uses `react-router-dom` v6 and we use `react-router` v7. | The hook surface (`useSearchParams`, `useNavigate`, `useParams`) is largely identical. Drop the `-dom` from import paths during port. |
| Render free-tier cold-start makes the first product fetch slow. | Frontend already shows skeleton state; user sees activity, not blank screen. Documented in memory. |
| Codegen drift across the two PRs. | Plan 1a regenerates and commits OpenAPI. Plan 1b rebases on `main` after 1a merges and regenerates TS types. CI's drift check enforces. |

---

## Execution shape (out of this spec, into the plans)

Per `workflow_preference.md`:

1. This spec → **two plan documents** under `docs/superpowers/plans/`:
   - `2026-04-18-phase-1a-catalog-backend.md` (~5 tasks: migration, sqlc/domain, service+handler+seed, tests, codegen+OpenAPI commit)
   - `2026-04-18-phase-1b-catalog-frontend.md` (~10 tasks: see Section 2.2 layout for the slice breakdown)
2. Each task is a fresh subagent dispatch (subagent-driven-development skill), with spec-compliance review + code-quality review per task.
3. Plans end with explicit push → PR → CI watch → merge → deploy verify steps.
4. Vercel deploy is partially manual (the preview URL is auto, the production verification is manual via browser).

---

**End of spec.**
