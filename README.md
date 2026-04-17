# Spacecraft Store

A fun-project e-commerce app for browsing spacecraft. Being rebuilt from scratch in phases — Go backend, modern React frontend — after an earlier Express + MUI iteration.

## Status

**Phase 0a — Backend foundation: ✓ deployed**
The Go + Huma + Postgres backend is live on Render, seeded with 15 spacecraft, and wired up with CI, lefthook, and automatic migrations.

**Phase 0b — Frontend foundation: next**
FSD-layout React SPA on Vite + Bun, `HomePage` rendering "Loaded N products" via an OpenAPI-generated TypeScript client.

Remaining phases: catalog features → auth + persistent cart → checkout (Stripe test) + coupons → styling pass + spacecraft fun layer → engagement → admin.
See `docs/superpowers/specs/2026-04-17-phase-0-foundation-design.md` for the full roadmap.

## Live backend

- **API base:** https://spacecraft-api.onrender.com
- **Health:** https://spacecraft-api.onrender.com/health
- **OpenAPI spec:** https://spacecraft-api.onrender.com/openapi.json

Free-tier Render spins down after ~15 min idle; the first request after sleep can take up to a minute.

## Tech stack

**Backend** — Go 1.25 · [Huma v2](https://huma.rocks) (HTTP + auto-generated OpenAPI) · [sqlc](https://sqlc.dev) (typed queries from SQL) · pgx/v5 · [goose](https://github.com/pressly/goose) (migrations) · `slog` (logging) · [testify](https://github.com/stretchr/testify) (tests) · Postgres on [Neon](https://neon.tech)

**Infrastructure** — Docker multi-stage (Alpine runtime) · Render (free tier, auto-deploy on push) · GitHub Actions (lint + test + codegen-drift + build) · [Lefthook](https://github.com/evilmartians/lefthook) (Go pre-commit) · `golangci-lint`

**Frontend** — arrives in Plan 0b: Bun · Vite · React 19 · TypeScript · Tailwind v4 · shadcn/ui · TanStack Query · openapi-typescript · Feature-Sliced Design

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

make install       # go mod download
make migrate-up    # apply migrations to Neon
make seed          # insert 15 seed products
make dev           # run the API on :8080
```

Then:

```bash
curl localhost:8080/health            # {"status":"ok"}
curl localhost:8080/api/products      # 15 products
curl localhost:8080/openapi.json      # full OpenAPI 3.1 spec
```

### Make targets

Run `make help` for the full list. Most-used:

| Target | Purpose |
|---|---|
| `make dev` | Run the API locally |
| `make test` | `go test ./... -race` |
| `make lint` | `golangci-lint run` |
| `make codegen` | Regenerate sqlc + OpenAPI artifacts (committed to git, CI fails on drift) |
| `make migrate-up` / `migrate-down` / `migrate-status` | goose migrations |
| `make seed` / `seed-destroy` | populate / truncate the `products` table |

## Deployment

**Render (backend).** Auto-deploys from the default branch. Config lives in `render.yaml` (Blueprint). Dockerfile runs `goose up` on container boot, then execs the API. Required env vars: `DATABASE_URL`, `CORS_ORIGINS`, `LOG_LEVEL`, `ENVIRONMENT`. Render injects `$PORT`.

**Neon (database).** Single Postgres branch. Migrations applied automatically on every Render deploy.

**CI.** GitHub Actions runs lint / test / codegen-drift / build on PRs touching `backend/`.

## Architecture

- Backend follows a DDD-lite layout under `backend/internal/` — one directory per bounded context (Phase 0a ships just `catalog`) with a fixed file shape (`domain.go` / `service.go` / `repository.go` / `postgres.go` / `handler.go` / `errors.go` / `queries.sql` / `*_test.go`). sqlc output lives in a `db/` subpackage per context to avoid domain-type collisions.
- `cmd/api/main.go` does nothing but wire config → logger → db pool → server → bounded contexts.
- `cmd/openapi/main.go` dumps the OpenAPI spec to stdout without serving HTTP, which lets the (future) frontend codegen its typed client without a running backend.
- `cmd/seed/main.go` populates the DB from `backend/data/products.json` via the same `catalog.Postgres` used by the API.

Full design rationale and decision log in `docs/superpowers/specs/2026-04-17-phase-0-foundation-design.md`; Phase 0a execution plan in `docs/superpowers/plans/2026-04-17-phase-0a-backend-foundation.md`.
