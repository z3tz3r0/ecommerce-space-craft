# Spacecraft Store

A fun-project e-commerce app for browsing spacecraft. Being rebuilt from scratch in phases — Go backend, modern React frontend — after an earlier Express + MUI iteration.

## Status

**Phase 0 — Foundation: ✓ deployed**
Backend (Plan 0a) is a Go + Huma + Postgres service on Render, seeded with 15 spacecraft. Frontend (Plan 0b) is a Bun + Vite + React 19 SPA on Vercel rendering a `HomePage` that fetches products via an OpenAPI-generated typed client.

**Phase 1 — Catalog: next**
Product list with category filter, sort, search; product detail page; featured section. Public, no auth.

Remaining phases: catalog features → auth + persistent cart → checkout (Stripe test) + coupons → styling pass + spacecraft fun layer → engagement → admin.
See `docs/superpowers/specs/2026-04-17-phase-0-foundation-design.md` for the full roadmap.

## Live URLs

| Service | URL |
|---|---|
| Frontend | https://<vercel-url>.vercel.app *(replace with real URL after Vercel deploy)* |
| Backend (API) | https://spacecraft-api.onrender.com |
| Backend health | https://spacecraft-api.onrender.com/health |
| OpenAPI spec | https://spacecraft-api.onrender.com/openapi.json |

Free-tier Render spins down after ~15 min idle; the first request after sleep can take up to a minute. Vercel SPA serves immediately.

## Tech stack

**Backend** — Go 1.25 · [Huma v2](https://huma.rocks) (HTTP + auto-generated OpenAPI) · [sqlc](https://sqlc.dev) (typed queries from SQL) · pgx/v5 · [goose](https://github.com/pressly/goose) (migrations) · `slog` (logging) · [testify](https://github.com/stretchr/testify) (tests) · Postgres on [Neon](https://neon.tech)

**Infrastructure** — Docker multi-stage (Alpine runtime) · Render (free tier, auto-deploy on push) · Vercel (free tier, SPA static hosting) · GitHub Actions (lint + test + codegen-drift + build) · [Lefthook](https://github.com/evilmartians/lefthook) (Git hooks manager — runs pre-commit checks) · `golangci-lint`

**Frontend** — Bun · Vite · React 19 · TypeScript · [Tailwind v4](https://tailwindcss.com) · [shadcn/ui](https://ui.shadcn.com) · [TanStack Query v5](https://tanstack.com/query) · [React Router v7](https://reactrouter.com) · [openapi-typescript](https://openapi-ts.dev) + `openapi-fetch` (typed end-to-end client from the backend's OpenAPI spec) · [Biome v2](https://biomejs.dev) (lint + format) · [Steiger](https://github.com/feature-sliced/steiger) (FSD architecture linter) · Vitest + React Testing Library · [Feature-Sliced Design](https://feature-sliced.design)

## Local setup (backend)

### Prerequisites

- Go 1.25+
- A Neon Postgres database (https://neon.tech) — copy its `DATABASE_URL`
- Optional dev tools (auto-installed on first `make` target): `sqlc`, `goose`, `golangci-lint`, `lefthook`

```bash
go install github.com/sqlc-dev/sqlc/cmd/sqlc@latest
go install github.com/pressly/goose/v3/cmd/goose@latest
go install github.com/evilmartians/lefthook@latest
# golangci-lint: see https://golangci-lint.run/welcome/install/
```

### Run

```bash
git clone https://github.com/z3tz3r0/ecommerce-space-craft.git
cd ecommerce-space-craft

# Create backend/.env (gitignored) from the template
cp backend/.env.example backend/.env
# Edit backend/.env — paste your Neon DATABASE_URL

make install       # go mod download + bun install
make migrate-up    # apply migrations to Neon
make seed          # insert 15 seed products
make dev-backend   # run the API on :8080 (or `make dev` for both sides)
```

Then:

```bash
curl localhost:8080/health            # {"status":"ok"}
curl localhost:8080/api/products      # 15 products
curl localhost:8080/openapi.json      # full OpenAPI 3.1 spec
```

## Local setup (frontend)

### Prerequisites

- [Bun](https://bun.sh) 1.3+

### Run

```bash
# Create frontend/.env (gitignored) from the template
cp frontend/.env.example frontend/.env
# Edit frontend/.env — VITE_API_URL points to either local backend (http://localhost:8080) or Render

make install       # also installs frontend deps via `bun install`
make dev           # runs backend + frontend in parallel
```

Frontend dev server: http://localhost:5173/. The `HomePage` at `/` calls `useProducts()` and renders "Loaded N products" against `VITE_API_URL`.

### Make targets

Run `make help` for the full list. Most-used:

| Target | Purpose |
|---|---|
| `make dev` | Run backend + frontend in parallel (`-j 2`) |
| `make dev-backend` / `dev-frontend` | Run a single side |
| `make build` | Build the Go binary and the Vite production bundle |
| `make test` | `go test ./... -race` + Vitest |
| `make lint` | `golangci-lint run` + Biome + Steiger |
| `make typecheck-frontend` | `tsc --noEmit` on the frontend |
| `make fmt` | gofmt + goimports + Biome format |
| `make codegen` | Regenerate sqlc + OpenAPI + FE types (committed to git, CI fails on drift) |
| `make codegen-ts` | Just the FE side: `bun run codegen:api` against `backend/openapi.json` |
| `make migrate-up` / `migrate-down` / `migrate-status` | goose migrations |
| `make seed` / `seed-destroy` | populate / truncate the `products` table |

## Deployment

**Render (backend).** Auto-deploys from the default branch. Config lives in `render.yaml` (Blueprint). Dockerfile runs `goose up` on container boot, then execs the API. Required env vars: `DATABASE_URL`, `CORS_ORIGINS`, `LOG_LEVEL`, `ENVIRONMENT`. Render injects `$PORT`.

**Neon (database).** Single Postgres branch. Migrations applied automatically on every Render deploy.

**Vercel (frontend).** Auto-deploys from the default branch. Framework preset: Vite. Root directory: `frontend`. Build: `bun run build`. Required env var: `VITE_API_URL` (set to the Render backend URL). The `frontend/vercel.json` rewrite ensures direct navigation to non-root URLs serves the SPA shell.

**CI.** GitHub Actions runs lint / test / codegen-drift / build on PRs touching `backend/` or `frontend/` (mirrored workflows per side).

## Architecture

- Backend follows a DDD-lite layout under `backend/internal/` — one directory per bounded context (Phase 0a ships just `catalog`) with a fixed file shape (`domain.go` / `service.go` / `repository.go` / `postgres.go` / `handler.go` / `errors.go` / `queries.sql` / `*_test.go`). sqlc output lives in a `db/` subpackage per context to avoid domain-type collisions.
- `cmd/api/main.go` does nothing but wire config → logger → db pool → server → bounded contexts.
- `cmd/openapi/main.go` dumps the OpenAPI spec to stdout without serving HTTP, which lets the frontend codegen its typed client without a running backend.
- `cmd/seed/main.go` populates the DB from `backend/data/products.json` via the same `catalog.Postgres` used by the API.
- Frontend follows [Feature-Sliced Design](https://feature-sliced.design) (FSD — layered architecture: every import points downward through a fixed stack of layers) under `frontend/src/` — 6 layers (`app`, `pages`, `widgets`, `features`, `entities`, `shared`) with strict downward-only imports enforced by Steiger. Each populated slice exposes a Public API via `index.ts`; no `export *`. Server state goes through TanStack Query; the only `fetch` lives in `shared/api/client.ts` wrapping `openapi-fetch` against types emitted by `openapi-typescript`. Layout-only Tailwind utilities — color, typography, and motion are deferred to Phase 4's styling pass.
- The codegen loop: `cmd/openapi/main.go` dumps `openapi.json` → committed → `bunx openapi-typescript` writes `src/shared/api/generated/types.ts` → committed. CI fails on drift.

Full design rationale and decision log in `docs/superpowers/specs/2026-04-17-phase-0-foundation-design.md`; Phase 0a execution plan in `docs/superpowers/plans/2026-04-17-phase-0a-backend-foundation.md`; Phase 0b execution plan in `docs/superpowers/plans/2026-04-17-phase-0b-frontend-foundation.md`.
