# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack

- **Backend** (`backend/`) — Go 1.23+ + [Huma v2](https://huma.rocks) (OpenAPI generation on top of stdlib `net/http` via the `humago` adapter) + [sqlc](https://sqlc.dev) (SQL → typed Go) + `pgx/v5` (Postgres driver + pool) + [goose](https://github.com/pressly/goose) migrations against [Neon](https://neon.tech) Postgres.
- **Frontend** (`frontend/`) — [Bun](https://bun.sh) (runtime, package manager, test runner) + [Vite](https://vitejs.dev) + React 19 + TypeScript + Tailwind v4 + [shadcn/ui](https://ui.shadcn.com) primitives. Source organised as [Feature-Sliced Design](https://feature-sliced.design) (FSD), enforced by [Steiger](https://github.com/feature-sliced/steiger).
- **Sessions:** [`alexedwards/scs/v2`](https://github.com/alexedwards/scs) + `pgxstore` (cookie sessions persisted in Postgres).
- **Password hashing:** [`alexedwards/argon2id`](https://github.com/alexedwards/argon2id) tuned for Render free-tier CPU (64 MB memory / 1 iteration / 2 parallelism).
- **API contract codegen:** Huma emits `backend/openapi.json`; [`openapi-typescript`](https://openapi-ts.dev) + [`openapi-fetch`](https://openapi-ts.dev/openapi-fetch/) generate the typed FE client. CI gates spec drift.
- **Deployment:** backend on [Render](https://render.com) (free tier — sleeps after ~15 min idle, cold start 30–60s); frontend on [Vercel](https://vercel.com).

## Common Commands

Use the `Makefile` from the repo root — it owns env loading, paths, and Go-bin discovery. Don't reach past it.

| Target | What it does |
|---|---|
| `make dev` | Run backend + frontend dev servers in parallel |
| `make dev-backend` | Just the Go API; sources `backend/.env` if present |
| `make dev-frontend` | Just the Vite dev server |
| `make build` | Build prod binary + bundle |
| `make test` | All tests (`go test -race -count=1` + Vitest) |
| `make lint` | golangci-lint + Biome + Steiger |
| `make typecheck-frontend` | `tsc --noEmit` |
| `make fmt` | gofmt + goimports + Biome format |
| `make codegen` | Regenerate sqlc, OpenAPI, and FE types |
| `make migrate-up` / `migrate-down` / `migrate-status` / `migrate-redo` | goose migrations |
| `make seed` / `make seed-destroy` | Populate / wipe `products` from `backend/data/products.json` |

Lefthook is configured for pre-commit hooks; if `make commit` complains about missing `lefthook`, run `bun run prepare` (FE) or install via Go-bin.

## Required Env

- `backend/.env` (gitignored): `DATABASE_URL` (Neon connection string with `sslmode=require`), `PORT` (default `8080`), `ENVIRONMENT` (`dev` | `production`), `LOG_LEVEL` (`debug` | `info` | `warn` | `error` — strict, no numeric offsets), `CORS_ORIGINS` (comma-separated; trailing slashes are normalised away).
- `frontend/.env`: `VITE_API_URL` (e.g. `http://localhost:8080`), consumed in `src/shared/api/client.ts`.

`make dev-backend` sources `backend/.env` automatically; raw `go run ./cmd/api` does NOT — load env yourself if invoking the binary directly.

## Backend Architecture — DDD-lite vertical slices

Each bounded context lives under `internal/<context>/`:

```
internal/cart/
├── domain.go        # entities, value objects, sentinel errors
├── repository.go    # Repository interface (small, ctx-first, exported record types)
├── postgres.go      # sqlc-backed Repository impl; var _ Repository = (*Postgres)(nil)
├── service.go       # business logic; depends on Repository interface only
├── handler.go       # Huma operation registration + input/output types
├── errors.go        # mapError(domain err) → huma.ErrorXXX
├── queries.sql      # sqlc input
├── db/              # sqlc-generated (queries.sql.go, models.go) — DO NOT hand-edit
└── *_test.go        # service + handler tests (httptest, no DB)
```

Bounded contexts (`auth`, `cart`, `catalog`) DO NOT import each other directly. `cart` reads the authenticated user via `auth.MustCurrentUser(ctx)` from the request context that `auth.RequireAuth` middleware attached.

**Test fakes** live in `*_test.go` files (or a sibling `<context>test/` package when cross-package tests need them — see `internal/auth/authtest/`). They never ship in the prod binary.

### Platform packages (`internal/platform/`)

- `config` — env loading + validation (`parseLogLevel` rejects numeric offsets explicitly).
- `db` — `pgxpool` with Neon-tolerant retry + idle-context isolation (so signal-handler ctx cancellation doesn't kill the initial ping).
- `logging` — `slog` text handler in dev, JSON in production.
- `server` — Huma API setup, request-log + recover middleware, **CORS at `http.Handler` level** (NOT a Huma middleware — Huma middlewares only fire for registered operations, missing OPTIONS preflights).
- `session` — wraps `scs` + `pgxstore`; `New` returns `(Manager, stopCleanup func())` — caller MUST `defer stopCleanup()` to stop the pgxstore expired-session sweeper.

### `cmd/` binaries

- `cmd/api` — production server. `main()` calls `os.Exit(run())` so deferred cleanup runs and a non-zero exit code is returned on bind failure / shutdown error. `serverErrCh` ensures `ListenAndServe` failures (port in use, etc.) propagate to the shutdown path instead of leaving main blocked on `<-ctx.Done()`.
- `cmd/seed` — JSON → products.
- `cmd/openapi` — emits OpenAPI spec for codegen. Uses no-op repository implementations; never opens a network listener.

### Cart concurrency

Cart `Add`, `Set`, and `Merge` are **atomic** via `pgx.BeginFunc` with `LockProductForCart` (`SELECT ... FOR UPDATE`). The clamp `target = min(existing + delta, stock)` runs inside the transaction. `MergeItems` sorts inputs by `ProductID` before locking to keep lock-acquisition order deterministic and avoid deadlocks. Sums are computed in `int64` to avoid `int32` overflow before clamping.

Service-layer tests cover input validation + forwarding. Stock-clamping correctness is a SQL invariant — eventual Postgres integration tests should cover it (TODO: add harness).

## Frontend Architecture — Feature-Sliced Design

Layers (Steiger config in `frontend/steiger.config.ts`):

| Layer | Purpose |
|---|---|
| `app/` | providers, router |
| `pages/` | route-level views |
| `widgets/` | composite UI blocks |
| `features/` | interactive concerns (catalog-filter, cart-add, etc.) |
| `entities/` | domain objects + slice-local API (e.g. `entities/cart/api/use-cart-mutations.ts`) |
| `shared/` | generated API client, ui primitives, lib |

Cross-imports are downward only. Steiger flags violations at `make lint`. Cross-entity imports use the `@x/` slot pattern.

**State management:**
- TanStack Query v5 — server state, with optimistic update + rollback for cart writes.
- Zustand + persist middleware — guest cart in localStorage.
- React Hook Form + Zod (via `@hookform/resolvers`) — forms.
- `sonner` — toast notifications.

The cart facade (`entities/cart/api/use-cart.ts`) routes guest↔server reads/writes based on auth state and triggers a `MergeItems` call on signup/login.

## Conventions

- **Layout-only Tailwind** through Phase 3. No color/typography/motion utilities — shadcn primitive defaults only. Visual polish phase comes later.
- **Errors wrap with `%w`** consistently in service layer. Sentinel errors (`ErrUserNotFound`, `ErrProductNotFound`, `ErrInvalidQuantity`, `ErrOverStock`) cross layers via `errors.Is`. Repository returns sentinels, Service wraps with context, handler `mapError`s to Huma errors.
- **Auth Login** distinguishes `ErrUserNotFound` (→ `ErrInvalidCredentials`, 401) from any other repo failure (→ wrapped, surfaces as 500). DB outages must NOT look like bad passwords.
- **Sessions:** auth handlers call `sess.RenewToken(ctx)` on signup/login (session fixation defense). Logout calls `sess.Destroy(ctx)`.
- **Codegen drift = CI failure.** After changing sqlc queries or Huma operations, run `make codegen` and commit the regenerated files (`backend/internal/<ctx>/db/`, `backend/openapi.json`, `frontend/src/shared/api/generated/`).
- **Compile-time interface assertions** are required on every Repository implementation: `var _ Repository = (*Postgres)(nil)` lives at the top of each `postgres.go`.
- **`MustCurrentUser`** (not `CurrentUser`) panics by design when the auth context is missing — only call it inside `RequireAuth`-protected handlers.

## Workflow

For multi-task features, use the `superpowers:subagent-driven-development` skill to dispatch a fresh implementer + spec-reviewer + quality-reviewer per task.

**Per-PR cycle:**

1. Brainstorm → spec → plan (split a/b for backend/frontend if both touched).
2. Branch off `main`: `phase-<n><a|b>/<topic>` for plans, `fix/<topic>` for hot fixes, `chore/<topic>` for cleanup.
3. Subagent dispatch per plan task with two-stage review (spec compliance → code quality).
4. Push → `gh pr create` → wait ~2 min → poll [CodeRabbit](https://coderabbit.ai) inline comments → fix or defer with reply → squash-merge → verify Render/Vercel auto-deploy.

**Before `gh pr merge --squash --delete-branch`:** stash any uncommitted frontend WIP (`Card.tsx` and similar). The local-side rebase otherwise leaves the working tree on a stale main with files that look reverted.

**Don't run dev servers proactively.** The user owns the dev loop. If a connectivity check requires a running server, kill it after — and verify with `ss -tlnp | grep :8080` because `go run` spawns a child binary that survives killing the wrapper PID.

## Useful pointers

- `docs/superpowers/specs/` — design docs per phase (read these before touching a phase).
- `docs/superpowers/plans/` — task-by-task implementation plans.
- `backend/openapi.json` — source of truth for the API contract; the FE client is generated from it.
- `~/.claude/projects/-home-z3tz3r0-Projects-ecommerce-space-craft/memory/` — durable memories (phase status, deployed URLs, Render quirks, workflow preferences, CodeRabbit cycle).
