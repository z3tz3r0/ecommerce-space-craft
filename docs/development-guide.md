# Development Guide · Spacecraft Store

All workflows run through the root `Makefile`, which owns env loading, paths, and
Go-bin discovery. Prefer `make` targets over raw commands.

## Prerequisites

- **Go** 1.26+ (the module pins `go 1.26.0`)
- **Bun** (frontend runtime, package manager, test runner)
- **Postgres** connection string (Neon in production; any Postgres locally)
- Go-bin tools used by `make`: `sqlc`, `goose`, `golangci-lint`, `goimports`
- **lefthook** for pre-commit hooks (`bun run prepare` in `frontend/`, or via Go-bin)

## Required environment

`backend/.env` (gitignored):

| Var | Required | Default | Notes |
|---|---|---|---|
| `DATABASE_URL` | yes | — | Neon connection string with `sslmode=require` |
| `PORT` | no | `8080` | HTTP listen port |
| `ENVIRONMENT` | no | `dev` | `dev` \| `production` (`prod`/`development` normalized) |
| `LOG_LEVEL` | no | `info` | `debug` \| `info` \| `warn` \| `error` (no numeric offsets) |
| `CORS_ORIGINS` | no | — | comma-separated; trailing slashes normalized away |

`frontend/.env`:

| Var | Example | Notes |
|---|---|---|
| `VITE_API_URL` | `http://localhost:8080` | consumed in `src/shared/api/client.ts` |

`make dev-backend` sources `backend/.env` automatically. Running `go run ./cmd/api`
directly does NOT load it: export the vars yourself.

## Getting started

```bash
make install          # install backend + frontend deps and tooling
make migrate-up       # apply goose migrations to DATABASE_URL
make seed             # populate products from backend/data/products.json
make dev              # run backend (:8080) + frontend (:5173) in parallel
```

Frontend dev server: <http://localhost:5173>. Backend API: <http://localhost:8080>.

## Common commands

| Target | What it does |
|---|---|
| `make dev` | Backend + frontend dev servers in parallel |
| `make dev-backend` | Just the Go API (sources `backend/.env`) |
| `make dev-frontend` | Just the Vite dev server |
| `make build` | Prod binary (`backend/bin/api`) + frontend bundle (`frontend/dist`) |
| `make test` | All tests (`go test -race -count=1` + Vitest) |
| `make lint` | golangci-lint + Biome + Steiger |
| `make typecheck-frontend` | `tsc --noEmit` |
| `make fmt` | gofmt + goimports + Biome format |
| `make codegen` | Regenerate sqlc, OpenAPI, and FE types |
| `make migrate-up` / `migrate-down` / `migrate-status` / `migrate-redo` | goose migrations |
| `make migrate-create` | scaffold a new migration |
| `make seed` / `make seed-destroy` | populate / truncate `products` |

## Codegen loop (important)

The API contract and the typed FE client are generated, and CI fails on drift:

1. Change a `queries.sql` or a Huma operation.
2. `make codegen` regenerates `backend/internal/<ctx>/db/`, `backend/openapi.json`,
   and `frontend/src/shared/api/generated/types.ts`.
3. Commit the regenerated files. CI re-runs codegen and fails if anything differs.

## CI gates

- **Backend** (`.github/workflows/backend.yml`): lint (gofmt + go vet +
  golangci-lint), test (`-race`), codegen-drift (sqlc + openapi · 9 generated
  files + `openapi.json`), build.
- **Frontend** (`.github/workflows/frontend.yml`): lint (Biome), typecheck
  (`tsc --noEmit`), test (Vitest), codegen-drift (`openapi-typescript` →
  `generated/types.ts`), build.

## Conventions

- **Layout-only Tailwind through Phase 3.** No color/typography/motion utilities
  yet, shadcn primitive defaults only.
- **Errors wrap with `%w`.** Sentinel errors cross layers via `errors.Is`.
- **Compile-time interface assertions** on every repository impl:
  `var _ Repository = (*Postgres)(nil)`.
- Don't hand-edit anything under a `db/` folder or `generated/` folder.
