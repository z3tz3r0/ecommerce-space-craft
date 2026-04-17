# Phase 0 — Foundation: Design Spec

**Date:** 2026-04-17
**Status:** Approved (pending user review of this written spec)
**Phase:** 0 of 6
**Owner:** z3tz3r0

---

## Project context

The existing repo is a learning-project e-commerce app for spacecraft (Express 5 + Mongoose 8 backend, React 19 + MUI 7 + Vite 6 frontend, deployed Vercel + Render + MongoDB Atlas). The decision is to **rebuild from scratch** — no migration, no backwards compatibility — with a Go backend, a modern React frontend, and a deliberate "fun, commercial-grade" e-commerce experience.

There is **no ship deadline**. Features are layered phase by phase before any public push. Each phase is its own design → plan → build cycle (BMAD-style).

## Phase roadmap (full project)

This spec covers Phase 0 only. The other phases are listed for context; each gets its own future spec.

| Phase | Theme | Headline deliverables |
|---|---|---|
| **0** | **Foundation** *(this spec)* | Repo scaffolding, Go backend skeleton, Bun + React + Vite frontend skeleton, Postgres on Neon, codegen pipeline, dev workflow, deploy pipeline. Zero user features beyond a "Loaded N products" demo proof. |
| 1 | Catalog | Product list with category filter, sort, search. Product detail page. Featured section on home. Stock display. Public, no auth. |
| 2 | Identity & cart | Email + password auth (sessions). Persistent per-user cart. Account page. |
| 3 | Checkout & orders | Shipping address, Stripe test mode, order confirmation, order history. Coupons. |
| 4 | Spacecraft fun layer | Compare ships, "your fleet" cart visualization, animated add-to-cart, manufacturer landing pages. **First styling pass: typography, color, motion, GSAP integration.** |
| 5 | Engagement | Wishlist, reviews & ratings (with moderation). |
| 6 | Admin | Product CRUD UI, order list, coupon CRUD. |

## Decisions locked for Phase 0

These are answered up-front so the spec body doesn't relitigate them.

| Decision | Choice | Rejected alternatives & why |
|---|---|---|
| Backend language | Go | (Decided pre-spec.) |
| Backend HTTP framework | **Huma** | `chi` (no auto-OpenAPI); `echo` (heavier); `gin` (older idioms). Huma derives an OpenAPI 3.1 spec from Go types — the foundation of the codegen story. |
| Backend DB driver | `pgx/v5` | `database/sql + lib/pq` (older); GORM (heavier abstractions). |
| Backend query layer | **`sqlc`** | GORM (magic, harder to optimize); raw `pgx` (no type generation). sqlc generates typed Go from hand-written SQL. |
| Backend migrations | `goose` | `golang-migrate` (similar, less ergonomic CLI); `atlas` (heavier). |
| Backend logging | `slog` (stdlib) | `zerolog`, `zap` (no longer needed since slog matured). |
| Database | **Postgres on Neon** | MongoDB (already used, but wrong shape for relational e-commerce data — orders, users, items, coupons); Supabase (good but more product than needed); SQLite/Turso (viable but less mainstream for this scope). |
| Frontend runtime/build | **Bun + Vite + React 19 + TypeScript** | Next.js (SSR not needed for fun project — no SEO requirement). |
| Frontend router | React Router v7 | TanStack Router (newer, steeper learning curve; reconsider in a later phase). |
| Frontend server state | **TanStack Query** | SWR (similar; TanStack has richer DX). |
| Frontend UI state | Zustand | Jotai, Redux (overkill for the small UI state we'll have). |
| Frontend forms | React Hook Form + Zod | Formik (older); native (verbose). |
| Frontend styling | **Tailwind v4** | CSS Modules, vanilla-extract (less productive). |
| Frontend components | **shadcn/ui** (copy-paste primitives) | HeroUI (full themed library — fights "distinctive look" goal); building from scratch (slower). |
| Frontend animation | **GSAP — deferred to Phase 4** | Motion (Framer); CSS-only. Phase 0–3 uses no motion library at all. |
| Frontend API client | `openapi-typescript` + `openapi-fetch` | Hand-written interfaces (the source of bugs in the old project); `tRPC` (requires both ends in TS); GraphQL (overkill). |
| Architecture (FE) | **FSD (Feature-Sliced Design)** — 6 layers, strict downward-only imports, slice isolation, segment shape (`ui`/`api`/`model`/`lib`/`config`), Public API per slice. | Flat `components/pages` (current project); plain feature folders (no boundary enforcement). |
| Architecture (BE) | **DDD-lite** — vertical slices per bounded context, fixed file shape (`domain.go`/`service.go`/`repository.go`/`postgres.go`/`queries.sql`/`handler.go`/`*_test.go`). | Layered (api/store/domain split — spreads each feature across dirs). |
| FE→BE deploy hosts | **Vercel** (FE), **Render** (BE) | Fly.io (no forever-free tier); Cloud Run (more setup); Koyeb/Northflank (less mature for this user). Render is what they already use. |
| Linter/formatter (FE) | **Biome** | ESLint+Prettier (slow, two configs); Oxlint (fast but linter-only — needs Prettier separately). |
| Linter (BE) | `gofmt` + `golangci-lint` | (Standard.) |
| Pre-commit | **Lefthook** | Husky (Node-only — awkward for a polyglot repo). |
| CI | GitHub Actions | (Standard.) |
| Local dev orchestration | **Makefile** | npm scripts at root (less robust); just (less mainstream). |
| Testing (BE) | stdlib `testing` + `testify` | Ginkgo (heavier BDD style). |
| Testing (FE) | Vitest + React Testing Library | Jest (slower with Vite); Playwright (deferred to Phase 3). |
| Money representation | **`integer` cents** | `numeric(10,2)` (works but cents matches Stripe's model). |
| Category storage | `text` + `CHECK` constraint | Postgres `ENUM` (painful to alter later). |
| Object IDs | `uuid` via `gen_random_uuid()` (UUID v4) | `bigserial` (too sequential, leaks order count); UUID v7 (needs extension; reconsider in a later phase if sortability matters). |

## Hard discipline rules for Phase 0 (and Phases 1–3)

These rules are enforced in code review and CI.

1. **Layout-only frontend.** No color modifiers, no typography modifiers, no theme tokens, no transitions/animations. Only layout/sizing/spacing/position/flex/grid Tailwind utilities. shadcn primitives use their built-in neutral defaults — those are the *primitive's* styling, not ours. The first styling pass is the opening work of Phase 4 (before any of its feature work begins).
2. **FSD boundaries.** Same-layer slices may not import each other. A layer may only import from layers strictly below it. `entities/*` may not peer-import other entities (use the `@x/` pattern when forced). Enforced by `steiger`.
3. **No barrel `export *`.** Every Public API is an explicit named-export `index.ts`. `shared/ui` uses component-level indexes to avoid bundle bloat.
4. **Codegen drift is a CI failure.** Regenerated files (sqlc Go, OpenAPI TS) must match what's committed.
5. **Generated files are committed.** They're version-controlled and reviewed in PRs.
6. **No business logic in `cmd/api/main.go`.** Wiring only.

---

## Section 1 — Architecture & repo layout

Single repo, two top-level dirs, single Makefile orchestrating both.

```
ecommerce-space-craft/
├── Makefile                       # canonical entry point for every workflow
├── lefthook.yml                   # pre-commit: gofmt, golangci-lint, biome, steiger
├── .github/workflows/
│   ├── backend.yml                # lint, test, codegen-drift, build
│   └── frontend.yml               # biome, steiger, typecheck, vitest, codegen-drift, build
├── docs/superpowers/specs/        # one design spec per phase
│
├── backend/                       # Go binary, deployed to Render
│   ├── cmd/
│   │   ├── api/main.go            # HTTP server entrypoint
│   │   ├── openapi/main.go        # dumps openapi.json without serving HTTP
│   │   └── seed/main.go           # populates products table from data/products.json
│   ├── internal/
│   │   ├── catalog/               # Phase 1 bounded context
│   │   │   ├── domain.go
│   │   │   ├── service.go
│   │   │   ├── repository.go
│   │   │   ├── postgres.go
│   │   │   ├── handler.go
│   │   │   ├── queries.sql        # sqlc input
│   │   │   └── *_test.go
│   │   └── platform/              # shared infra (not a bounded context)
│   │       ├── config/
│   │       ├── logging/
│   │       ├── db/                # pgx pool, transactor helper
│   │       └── server/            # Huma API init, middleware, health
│   ├── migrations/                # centralized goose .sql files
│   ├── data/products.json         # seed data
│   ├── openapi.json               # committed; regenerated by `make openapi-dump`
│   ├── sqlc.yaml                  # one sqlc package per bounded context
│   ├── Dockerfile                 # multi-stage; entrypoint runs goose then api
│   ├── go.mod
│   └── .env.example
│
└── frontend/                      # Bun + Vite + React 19 SPA, deployed to Vercel
    ├── src/                       # FSD layout — see Section 3
    ├── biome.json
    ├── tsconfig.json
    ├── vite.config.ts
    ├── package.json
    ├── vercel.json                # SPA rewrite
    └── .env.example
```

**The FE↔BE glue (the whole point of this stack):**

1. Huma derives `/openapi.json` from Go handler input/output struct types at runtime.
2. `cmd/openapi/main.go` constructs the same Huma API that `cmd/api/main.go` does, but dumps the spec to stdout instead of serving HTTP. This means **FE codegen does not require a running BE**, and every contract change is a reviewable diff.
3. `make codegen-ts` runs `bunx openapi-typescript backend/openapi.json -o frontend/src/shared/api/generated/types.ts`.
4. `frontend/src/shared/api/client.ts` wraps `openapi-fetch` with the generated `paths` type — every BE call is fully typed end-to-end.
5. CI re-runs codegen and fails if generated files drift from committed.

---

## Section 2 — Backend skeleton

### `cmd/api/main.go` — wiring only

Responsibilities, in order:

1. Load typed `Config` from env via `internal/platform/config`. Fail fast on missing required vars.
2. Init `slog` logger via `internal/platform/logging` (JSON in prod, text in dev).
3. Open `pgxpool.Pool` via `internal/platform/db`.
4. Construct each bounded context top-down:
   ```go
   repo := catalog.NewPostgres(pool)
   svc  := catalog.NewService(repo, logger)
   catalog.Register(api, svc)
   ```
5. Build the Huma API via `internal/platform/server.New(cfg, logger)` — returns `huma.API` with middleware (recover, request logging, CORS) already applied.
6. `http.ListenAndServe` + signal-handled graceful shutdown.

Target size: ~60 lines. **No business logic in `main.go`, ever.**

### Each bounded context has exactly this file shape

| File | Role | Imports allowed |
|---|---|---|
| `domain.go` | Exported types (`Product`, `Category`), sentinel errors (`ErrProductNotFound`). | stdlib only |
| `service.go` | `Service` struct holding business logic. Depends on `Repository` interface. | own `domain.go`; stdlib; logger |
| `repository.go` | `Repository` interface only. | own `domain.go` |
| `postgres.go` | Postgres implementation of `Repository` backed by sqlc-generated `Queries`. Adapter — translates between sqlc row types and domain types. | own `domain.go`, `repository.go`; sqlc-generated; pgx |
| `queries.sql` | sqlc input. Named queries (`-- name: GetProductByID :one`). | n/a |
| `handler.go` | `Register(api huma.API, svc *Service)`. Declares Huma operations. Thin: validate → call service → map errors → return. | own `domain.go`, `service.go`; Huma |
| `*_test.go` | Service unit tests with mock repo; repository integration tests with testcontainers (added Phase 1+). | testify; testcontainers (repo tests) |

Same-context cross-file imports are unrestricted; **cross-context imports are not**. A context exposes only its constructor, its `Register(...)`, and its `Repository` interface to outside callers.

### Huma registration pattern

Input/output structs ARE the OpenAPI spec. Example:

```go
type GetProductInput struct {
    ID string `path:"id"`
}
type GetProductOutput struct {
    Body Product
}

func Register(api huma.API, svc *Service) {
    huma.Register(api, huma.Operation{
        OperationID: "getProduct",
        Method:      http.MethodGet,
        Path:        "/api/products/{id}",
        Summary:     "Fetch a product by ID",
    }, func(ctx context.Context, in *GetProductInput) (*GetProductOutput, error) {
        p, err := svc.GetByID(ctx, in.ID)
        if err != nil {
            return nil, mapError(err)
        }
        return &GetProductOutput{Body: p}, nil
    })
}
```

### sqlc configuration

`backend/sqlc.yaml` — one package per context:

```yaml
version: "2"
sql:
  - engine: postgresql
    queries: internal/catalog/queries.sql
    schema:  migrations
    gen:
      go:
        package: catalog
        out:     internal/catalog
        sql_package: pgx/v5
        emit_pointers_for_null_types: true
```

Generated files (`queries.sql.go`, `models.go`) are committed; CI fails on drift.

### Error handling — three layers

1. **Domain errors** as sentinels in `domain.go`: `var ErrProductNotFound = errors.New("product not found")`.
2. **Service** wraps with context: `fmt.Errorf("catalog: get product %s: %w", id, err)`.
3. **Handler** calls a tiny per-context `mapError(err) error` returning `huma.Error404NotFound(...)`, `huma.Error400BadRequest(...)`, etc. via `errors.Is`. Huma serializes the JSON response. No stack traces in responses; full errors logged at WARN/ERROR via `slog`.

### Middleware stack (in `platform/server.New`)

1. Recover (panic → 500 + logged stack).
2. Request logging (method, path, status, duration, request ID).
3. CORS (whitelist from config — same approach as today).

Auth middleware plugs in at Phase 2.

### Config loading

Plain typed struct, parsed once at boot via `os.Getenv`:

```go
type Config struct {
    Port         string
    DatabaseURL  string
    LogLevel     slog.Level
    CORSOrigins  []string
    Environment  string  // "dev" | "prod"
}
```

Missing required var → `log.Fatalf` at boot. No viper/cobra.

---

## Section 3 — Frontend skeleton (FSD)

Phase 0 scaffolds **all 6 FSD layers** so the architecture is visible from day one. Empty layers get a `.gitkeep` placeholder. Only `app`, `pages/home`, `entities/product`, and a slice of `shared` are populated for the demo.

```
frontend/src/
├── app/                                      # entrypoint, providers, global styles
│   ├── entrypoint/
│   │   └── main.tsx                          # createRoot, mount <App />
│   ├── providers/
│   │   ├── router/
│   │   │   ├── index.tsx                     # BrowserRouter + route table
│   │   │   └── routes.tsx                    # route → page mapping
│   │   ├── query/
│   │   │   └── index.tsx                     # QueryClientProvider + QueryClient
│   │   └── index.tsx                         # composes providers top-down
│   ├── styles/
│   │   └── global.css                        # @import "tailwindcss"; (empty @theme)
│   └── App.tsx                               # shell + <Outlet />
│
├── pages/
│   └── home/
│       ├── ui/HomePage.tsx                   # Phase 0 demo page
│       └── index.ts                          # Public API
│
├── widgets/                                  # empty in Phase 0
│   └── .gitkeep
│
├── features/                                 # empty in Phase 0
│   └── .gitkeep
│
├── entities/
│   └── product/
│       ├── api/
│       │   ├── getProducts.ts                # useProducts() — TanStack Query hook
│       │   └── index.ts
│       ├── model/
│       │   └── types.ts                      # Product type aliased from generated
│       └── index.ts                          # Public API of the entity
│
└── shared/
    ├── api/
    │   ├── client.ts                         # openapi-fetch instance
    │   ├── generated/                        # codegen output (committed, ignored by Biome)
    │   └── index.ts                          # exports `api` and `paths` types
    ├── config/
    │   └── env.ts                            # typed env (VITE_API_URL)
    ├── lib/
    │   └── .gitkeep
    └── ui/                                   # shadcn primitives, one folder per component
        ├── button/
        │   ├── Button.tsx
        │   └── index.ts
        └── card/
            ├── Card.tsx
            └── index.ts
```

### FSD import rules (enforced by `steiger` in lint)

| Layer | May import from |
|---|---|
| `app` | pages, widgets, features, entities, shared |
| `pages` | widgets, features, entities, shared |
| `widgets` | features, entities, shared |
| `features` | entities, shared |
| `entities` | shared (only — no peer entity imports; use `@x/` if cross-entity ever needed) |
| `shared` | shared (free internal imports) |

### Path aliases (Vite + tsconfig)

```
@/app/*  @/pages/*  @/widgets/*  @/features/*  @/entities/*  @/shared/*
```

### Public API rule

Explicit named exports only. No `export *`. Example:

```ts
// entities/product/index.ts
export { useProducts } from "./api"
export type { Product } from "./model/types"
```

`shared/ui` uses per-component indexes — consumers do `import { Button } from "@/shared/ui/button"`, never `from "@/shared/ui"`.

### Provider composition (`app/providers/index.tsx`)

```tsx
<StrictMode>
  <BrowserRouter>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </BrowserRouter>
</StrictMode>
```

### `QueryClient` defaults

```ts
new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
  },
})
```

### API client (the only place `fetch` is called)

```ts
// shared/api/client.ts
import createClient from "openapi-fetch"
import type { paths } from "./generated/types"

export const api = createClient<paths>({
  baseUrl: import.meta.env.VITE_API_URL,
  credentials: "include",  // harmless now; matters at Phase 2 for session cookies
})
```

### Phase 0 demo (`HomePage`)

Calls `useProducts()` from `@/entities/product`, renders `Loaded N products` inside a `<Card>` from `@/shared/ui/card`. That's the entire user-visible surface of Phase 0. Proves: Neon connection → pgx pool → sqlc query → Huma serialization → OpenAPI codegen → typed client → TanStack Query → React render.

### Vercel React best practices baked in

- TanStack Query handles client-side request dedup.
- Component-level shadcn imports avoid barrel bloat.
- No `export *` anywhere.
- `HomePage` is a thin shell; future list pages will use `content-visibility` and hoisted-static-JSX patterns.
- Coding standards (functional `setState`, `startTransition` for non-urgent updates, derive-during-render) enforced via code review per phase.

### Tailwind v4 — CSS-first config

```css
/* app/styles/global.css */
@import "tailwindcss";
/* @theme block stays empty in Phase 0; tokens added during the styling pass */
```

No `tailwind.config.ts`. Vite plugin: `@tailwindcss/vite`.

### Biome config (`biome.json`)

```json
{
  "formatter": { "enabled": true, "indentWidth": 2 },
  "linter":   { "enabled": true, "rules": { "recommended": true } },
  "files":    { "ignore": ["src/shared/api/generated/**", "dist/**"] }
}
```

Generated API types are explicitly ignored.

### Layout-only Tailwind discipline (Phase 0–3)

**Allowed:** `flex`, `grid`, `block`, `inline-*`, `hidden`, `w-*`, `h-*`, `min-*`, `max-*`, `aspect-*`, `size-*`, `p-*`, `m-*`, `gap-*`, `space-*`, `relative`, `absolute`, `fixed`, `sticky`, `top-*`, `inset-*`, `z-*`, `items-*`, `justify-*`, `place-*`, `col-span-*`, `row-span-*`, `flex-*`, `grid-cols-*`, `overflow-*`, `truncate`, `line-clamp-*`, container queries.

**Forbidden until the styling pass:** color modifiers (`bg-*`, `text-*` with color, `border-*` color, `ring-*`), typography (`font-*`, `text-{size}`, `tracking-*`, `leading-*`), `@theme` tokens, `transition-*`, `animate-*`, `duration-*`, custom CSS variables, custom fonts, GSAP. Structural dividers use `<Separator />` from shadcn rather than raw color classes.

### `vite.config.ts` essentials

- `@vitejs/plugin-react`
- `@tailwindcss/vite`
- Path aliases for the 6 FSD layers

No dev proxy — `VITE_API_URL` is always an absolute URL (`http://localhost:8080` in dev, the Render URL in prod), and the backend's CORS whitelist already includes `http://localhost:5173`. Single code path, no env-conditional base URLs.

---

## Section 4 — Database & migrations

### Hosting

Single Neon Postgres database, single `main` branch. `DATABASE_URL` env var locally and on Render. Direct connection (not the pooler — Render is long-running, one container, one pool).

### Phase 0 schema — one table

`backend/migrations/20260417120000_create_products.sql`:

```sql
-- +goose Up
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE products (
    id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    name            varchar(100)  NOT NULL CHECK (length(name) >= 3),
    description     text          NOT NULL,
    price_cents     integer       NOT NULL CHECK (price_cents >= 0),
    image_url       text,
    manufacturer    text,
    crew_amount     integer       CHECK (crew_amount IS NULL OR crew_amount >= 0),
    max_speed       text,
    category        text          NOT NULL CHECK (
                       category IN ('Fighter','Freighter','Shuttle','Speeder','Cruiser','Capital Ship')
                    ),
    stock_quantity  integer       NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
    is_active       boolean       NOT NULL DEFAULT true,
    created_at      timestamptz   NOT NULL DEFAULT now(),
    updated_at      timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX idx_products_category_active ON products (category) WHERE is_active = true;
CREATE INDEX idx_products_created_at      ON products (created_at DESC);

-- +goose Down
DROP TABLE products;
```

**Three deliberate calls:** `price_cents` (integer) not `price` (avoids float rounding, matches Stripe); flat spec columns not `jsonb` (fixed shape, queryable); `text` + `CHECK` constraint not Postgres `ENUM` (alterable later without DDL acrobatics).

### Migration tool — goose

| Make target | Underlying command |
|---|---|
| `make migrate-create name=foo` | `goose -dir backend/migrations create foo sql` |
| `make migrate-up` | `goose -dir backend/migrations postgres "$DATABASE_URL" up` |
| `make migrate-down` | `goose -dir … down` |
| `make migrate-status` | `goose -dir … status` |
| `make migrate-redo` | `goose -dir … redo` (dev only) |

**Migrations run automatically on Render deploy** via the Dockerfile entrypoint: `goose up && exec /app/api`. Atomic, idempotent. Risk: bad migration breaks startup. Mitigation: review discipline — never merge a migration that hasn't been applied locally first.

### Phase 0 sqlc queries

`backend/internal/catalog/queries.sql`:

```sql
-- name: GetProductByID :one
SELECT * FROM products WHERE id = $1 AND is_active = true;

-- name: ListActiveProducts :many
SELECT * FROM products WHERE is_active = true ORDER BY created_at DESC;
```

`make sqlc-generate` writes `queries.sql.go` and `models.go`. `postgres.go` (the Repository implementation) wraps the generated `Queries` and translates between sqlc row types and the domain `Product` type.

### Seeder

`backend/cmd/seed/main.go`:

- Reads `backend/data/products.json`.
- Uses the same `catalog.Repository` interface the API uses — no parallel data path.
- `make seed` populates; `make seed-destroy` runs `TRUNCATE products`.

### Local dev DB strategy

Single Neon database in Phase 0. No docker-compose Postgres. Add `make docker-db` later if/when multi-developer isolation becomes needed (probably Phase 2+).

### Test DB strategy

Deferred to Phase 1's first repository test. Plan: `testcontainers-go` for ephemeral Postgres per test package. Service tests use mock `Repository`; only repo tests touch a real DB.

---

## Section 5 — Dev workflow & Makefile

The Makefile is the canonical entry point. `frontend/package.json` keeps a `scripts` block so `bun run dev` works standalone, but every documented and CI-run command goes through `make`.

### Full Phase 0 target list

| Target | Action |
|---|---|
| `make install` | `cd backend && go mod download`; `cd frontend && bun install`; install lefthook hooks. |
| `make dev` | `make -j 2 dev-backend dev-frontend`. |
| `make dev-backend` | `cd backend && go run ./cmd/api`. |
| `make dev-frontend` | `cd frontend && bun run dev`. |
| `make build` | `make build-backend build-frontend`. |
| `make build-backend` | `cd backend && go build -o bin/api ./cmd/api`. |
| `make build-frontend` | `cd frontend && bun run build`. |
| `make test` | `make test-backend test-frontend`. |
| `make test-backend` | `cd backend && go test ./... -race -count=1`. |
| `make test-frontend` | `cd frontend && bun run test` (Vitest). |
| `make lint` | `make lint-backend lint-frontend`. |
| `make lint-backend` | `cd backend && golangci-lint run ./...`. |
| `make lint-frontend` | `cd frontend && bunx biome lint && bunx steiger`. |
| `make fmt` | gofmt + goimports + biome format --write. |
| `make typecheck` | `cd frontend && bunx tsc --noEmit`. |
| `make openapi-dump` | `cd backend && go run ./cmd/openapi > openapi.json`. |
| `make sqlc-generate` | `cd backend && sqlc generate`. |
| `make codegen-ts` | `cd frontend && bunx openapi-typescript ../backend/openapi.json -o src/shared/api/generated/types.ts`. |
| `make codegen` | `make sqlc-generate openapi-dump codegen-ts`. |
| `make migrate-*` | (see Section 4) |
| `make seed`, `make seed-destroy` | (see Section 4) |
| `make clean` | Remove `backend/bin`, `frontend/dist`, `frontend/node_modules/.vite`. |

### Codegen flows

**Path A — BE API shape change → FE types:**

```
Edit Huma handler  →  make openapi-dump  →  make codegen-ts
                                          →  tsc errors on every FE usage
                                          →  fix FE  →  commit BE+openapi.json+types.ts+FE together
```

**Path B — BE schema change → Go:**

```
make migrate-create name=...  →  edit SQL  →  make migrate-up
                                            →  edit queries.sql
                                            →  make sqlc-generate
                                            →  Go compiler errors  →  fix service  →  commit
```

### CI drift gate

```yaml
- run: make codegen
- run: git diff --exit-code
```

Identical gate on backend (sqlc + openapi) and frontend (codegen-ts) workflows. Cannot merge a PR that forgot to regen.

### Lefthook (`lefthook.yml` at repo root)

```yaml
pre-commit:
  parallel: true
  commands:
    go-fmt:
      glob: "backend/**/*.go"
      run: cd backend && gofmt -l {staged_files} | (! read)
    go-lint:
      glob: "backend/**/*.go"
      run: cd backend && golangci-lint run --new-from-rev=HEAD~
    biome:
      glob: "frontend/**/*.{ts,tsx,js,jsx,json}"
      run: cd frontend && bunx biome check --apply {staged_files}
    fsd-boundaries:
      glob: "frontend/src/**/*.{ts,tsx}"
      run: cd frontend && bunx steiger
```

Fast checks only. Test suite + full codegen drift run in CI, not pre-commit.

### Day-in-the-life cheatsheet

| Scenario | Commands |
|---|---|
| Fresh clone | `make install && make migrate-up && make seed && make dev` |
| Pull latest | `make install && make migrate-up && make codegen && make dev` |
| Added a backend endpoint | edit handler → `make codegen` → use new client method in FE |
| Added a backend query | edit `queries.sql` → `make sqlc-generate` → use generated function |
| Added a DB table | `make migrate-create name=...` → edit SQL → `make migrate-up` |
| Ready to commit | stage → `git commit` (lefthook runs; CI does full drift check on push) |

---

## Section 6 — Deploy pipeline & CI

### Frontend — Vercel

| Setting | Value |
|---|---|
| Framework preset | Vite |
| Install command | `bun install` |
| Build command | `bun run build` |
| Output directory | `dist` |
| Root directory | `frontend/` |
| Env vars | `VITE_API_URL=https://<render-app>.onrender.com` |
| Auto-deploy | main → production, PRs → preview URLs |

`frontend/vercel.json` fixes the legacy SPA-rewrite 404:

```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/" }] }
```

### Backend — Render (Docker)

`backend/Dockerfile` — multi-stage:

```dockerfile
FROM golang:1.23-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /out/api ./cmd/api

FROM golang:1.23-alpine AS goose
RUN go install github.com/pressly/goose/v3/cmd/goose@latest

FROM gcr.io/distroless/static-debian12
COPY --from=build /out/api /app/api
COPY --from=goose /go/bin/goose /usr/local/bin/goose
COPY migrations /app/migrations
WORKDIR /app
ENTRYPOINT ["/bin/sh","-c","goose -dir migrations postgres \"$DATABASE_URL\" up && exec /app/api"]
```

Render service settings:

| Setting | Value |
|---|---|
| Service type | Web Service (Docker) |
| Root directory | `backend/` |
| Health check path | `/health` |
| Env vars | `DATABASE_URL`, `CORS_ORIGINS=https://<vercel>.vercel.app,http://localhost:5173`, `LOG_LEVEL=info`, `ENVIRONMENT=production` |
| Auto-deploy | main branch |

Render injects `$PORT`. `/health` returns `200 OK`.

### CI workflows

`.github/workflows/backend.yml` (triggers: `backend/**`, root `Makefile`):

| Job | Steps |
|---|---|
| lint | `gofmt -l`, `go vet`, `golangci-lint run` |
| test | `go test ./... -race -count=1` |
| codegen-drift | `make sqlc-generate openapi-dump` → `git diff --exit-code` |
| build | `go build ./cmd/api` |

`.github/workflows/frontend.yml` (triggers: `frontend/**`, root `Makefile`):

| Job | Steps |
|---|---|
| lint | `bunx biome check .`, `bunx steiger` |
| typecheck | `bunx tsc --noEmit` |
| test | `bun run test` |
| codegen-drift | `make codegen-ts` → `git diff --exit-code` |
| build | `bun run build` |

Both use `setup-go`, `setup-bun`, aggressive caching (Go module cache, Bun cache). Target wall time: under 2 minutes per workflow.

### Observability — intentionally bare for Phase 0

- Render dashboard for backend logs.
- Vercel dashboard for frontend logs.
- Neon dashboard for query stats.
- Structured `slog` JSON logs (one line per request: method, path, status, duration, request ID).
- No Sentry, APM, or external monitoring — easy to add later in a focused pass.

### Secrets

`.env.example` files committed (shape only). Real secrets live in Render, Vercel, Neon dashboards. No `.env` is ever committed.

---

## Acceptance criteria — when Phase 0 is "done"

Binary checklist. When every box is ticked, Phase 0 ships and Phase 1 begins.

- [ ] Repo scaffolded with the 6 FSD layers (frontend) and DDD-lite contexts (backend) per Sections 2–3.
- [ ] `make install && make migrate-up && make seed && make dev` brings up both sides on a fresh clone with no manual steps.
- [ ] Backend serves `GET /api/products` returning seeded products from Neon.
- [ ] Backend serves `GET /openapi.json` with the Huma-derived spec.
- [ ] Backend serves `GET /health` → `200 OK`.
- [ ] Frontend `HomePage` at `/` calls `useProducts()` via the codegen client and renders "Loaded *N* products".
- [ ] `make openapi-dump`, `make codegen-ts`, `make sqlc-generate` all round-trip with zero git diff.
- [ ] `make test` passes (minimum: one test per side — health handler test, HomePage render test).
- [ ] `make lint`, `make typecheck` pass.
- [ ] Lefthook pre-commit blocks unformatted/unlinted code.
- [ ] All three CI workflows green on main.
- [ ] Production deploy: Vercel + Render both serve the same "Loaded N products" screen at their public URLs. SPA rewrite verified by direct navigation to a non-root URL.
- [ ] Top-level `README.md` documents setup commands, env vars, deploy URLs, and the phase plan.
- [ ] `.env.example` committed in both `backend/` and `frontend/`.

## Explicitly out of scope for Phase 0

| Out of scope | Where it lives |
|---|---|
| Product CRUD beyond read | Phase 1 |
| Auth, users, sessions | Phase 2 |
| Persistent cart, checkout, orders, coupons | Phases 2–3 |
| Admin UI | Phase 6 |
| Visual design tokens, typography, color, motion, GSAP | Phase 4 (opens with the styling pass before feature work) |
| Playwright E2E | Phase 3 (checkout) |
| Observability tooling (Sentry, APM) | Later focused pass |
| Local docker-compose Postgres | Add when multi-developer isolation is needed |
| Test database via testcontainers | Phase 1 (first repository test) |
