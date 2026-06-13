# Source Tree Analysis · Spacecraft Store

A monorepo with a Go backend and a React frontend, orchestrated from the root
`Makefile`.

## Top level

```text
ecommerce-space-craft/
├── backend/            # Go + Huma API
├── frontend/           # React 19 + Vite SPA
├── docs/               # this documentation set
├── Makefile            # single entry point for all dev/build/test/codegen tasks
├── render.yaml         # Render Blueprint (backend deploy)
├── lefthook.yml        # pre-commit hooks (gofmt, golangci-lint, biome, steiger)
├── CLAUDE.md           # architecture conventions + workflow
└── README.md           # stack + setup + deploy docs
```

## Backend (`backend/`)

```text
backend/
├── cmd/
│   ├── api/            # production HTTP server (main entry point)
│   ├── seed/           # products seeder (reads data/products.json; -d truncates)
│   └── openapi/        # dumps openapi.json via no-op repos (no listener)
├── internal/
│   ├── auth/           # bounded context: users, sessions, password hashing
│   ├── cart/           # bounded context: cart items, stock-clamped mutations
│   ├── catalog/        # bounded context: products
│   └── platform/       # config, db, logging, server, session
├── migrations/         # goose SQL migrations (products, users, sessions, cart)
├── data/               # products.json seed data
├── Dockerfile          # multi-stage build; runs goose migrations then api on boot
├── sqlc.yaml           # sqlc config (3 packages: catalogdb, authdb, cartdb)
├── openapi.json        # generated API contract (source of truth for FE client)
├── go.mod              # module github.com/z3tz3r0/ecommerce-space-craft/backend
└── go.sum
```

### Anatomy of a bounded context

Each context under `internal/<ctx>/` follows the same layout:

```text
internal/cart/
├── domain.go        # entities, value objects, sentinel errors
├── repository.go    # Repository interface (ctx-first, small)
├── postgres.go      # sqlc-backed impl; var _ Repository = (*Postgres)(nil)
├── service.go       # business logic; depends on Repository interface only
├── handler.go       # Huma operation registration + input/output types
├── errors.go        # mapError(domain err) → huma.ErrorXXX
├── queries.sql      # sqlc input
├── db/              # sqlc-generated (DO NOT hand-edit)
└── *_test.go        # service + handler tests (httptest, no DB)
```

## Frontend (`frontend/`)

Feature-Sliced Design. Imports flow downward only
(`app → pages → widgets → features → entities → shared`).

```text
frontend/
├── src/
│   ├── app/            # providers (TanStack Query + Router), App shell, entrypoint
│   ├── pages/          # account, cart, catalog, home, login, product-detail, signup
│   ├── widgets/        # site-header, product-grid, product-card, cart-line,
│   │                   #   filter-sidebar, featured-section
│   ├── features/       # auth-login, auth-logout, auth-signup, cart-actions,
│   │                   #   catalog-filter, catalog-search, catalog-sort, require-auth
│   ├── entities/       # product, cart, user (each with api/ model/ ui/)
│   └── shared/         # api (generated client), config, lib, ui (shadcn primitives)
├── components.json     # shadcn/ui config (new-york, aliases to @/shared)
├── steiger.config.ts   # FSD structural rules
├── biome.json          # formatter + linter config
├── vite.config.ts      # Vite + React + Tailwind + Vitest
├── tsconfig*.json      # path aliases @/app … @/shared
└── package.json        # scripts + deps
```

## Critical files

- [`backend/cmd/api/main.go`](../backend/cmd/api/main.go) · server lifecycle:
  pool init, session manager, registers catalog/auth/cart, CORS + session
  middleware, graceful shutdown.
- [`backend/internal/platform/server/server.go`](../backend/internal/platform/server/server.go)
  · Huma setup, middleware order, handler-level CORS.
- [`backend/openapi.json`](../backend/openapi.json) · the API contract that drives
  the frontend client.
- [`frontend/src/app/providers/router/routes.tsx`](../frontend/src/app/providers/router/routes.tsx)
  · the 7 routes.
- [`frontend/src/entities/cart/lib/cart-facade.ts`](../frontend/src/entities/cart/lib/cart-facade.ts)
  · the guest↔server cart router (the most load-bearing FE state file).
- [`frontend/src/shared/api/client.ts`](../frontend/src/shared/api/client.ts) ·
  typed `openapi-fetch` client.
