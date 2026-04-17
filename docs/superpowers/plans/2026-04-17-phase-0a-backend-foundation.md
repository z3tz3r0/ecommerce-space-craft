# Phase 0a — Backend Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a deployable Go backend on Render that serves `GET /api/products`, `GET /openapi.json`, and `GET /health` against a Neon Postgres database, with all scaffolding (DDD-lite bounded contexts, Huma, sqlc, pgx, goose, slog), seeder, Dockerfile, Lefthook, golangci-lint, and CI wired up.

**Architecture:** DDD-lite Go backend. Each bounded context is a vertical slice with a fixed file shape (`domain.go`, `service.go`, `repository.go`, `postgres.go`, `handler.go`, `queries.sql`, `errors.go`, `*_test.go`). Phase 0a ships exactly one context (`catalog`) with read-only product endpoints. `cmd/api/main.go` wires bounded contexts into a Huma API; `cmd/openapi/main.go` dumps the OpenAPI spec without serving HTTP; `cmd/seed/main.go` populates the DB via the same `Repository` interface the API uses. Migrations run automatically on container boot via the Dockerfile entrypoint.

**Tech Stack:** Go 1.23+, Huma v2, sqlc v2, pgx/v5, goose v3, slog (stdlib), testify, golangci-lint, Neon Postgres, Docker (distroless runtime), Render, GitHub Actions, Lefthook.

**Spec reference:** `docs/superpowers/specs/2026-04-17-phase-0-foundation-design.md` — Sections 1, 2, 4, 5 (backend portions), 6 (backend deploy + CI).

---

## Prerequisites

Before starting, the engineer must have:

- [ ] Go 1.23+ installed (`go version`)
- [ ] `sqlc` installed (`go install github.com/sqlc-dev/sqlc/cmd/sqlc@latest` — requires Go)
- [ ] `goose` installed (`go install github.com/pressly/goose/v3/cmd/goose@latest`)
- [ ] `golangci-lint` installed (`curl -sSfL https://raw.githubusercontent.com/golangci/golangci-lint/master/install.sh | sh -s -- -b $(go env GOPATH)/bin v1.62.0`)
- [ ] `lefthook` installed (`go install github.com/evilmartians/lefthook@latest`)
- [ ] `gh` (GitHub CLI) authenticated
- [ ] A Neon account (https://neon.tech) with a new project created, and `DATABASE_URL` copied
- [ ] A Render account (https://render.com) — no service created yet

## Branch & worktree

Work directly on `main`. The Phase 0 rebuild is a clean slate; no isolation needed.

## File structure map

Plan 0a creates/modifies these files. Files marked `(generated)` are committed but produced by tooling and regenerated on demand.

```
ecommerce-space-craft/
├── Makefile                                         # NEW — BE targets only in 0a, FE added in 0b
├── lefthook.yml                                     # NEW — Go pre-commit only in 0a
├── .gitignore                                       # MODIFY — add backend/bin, backend/tmp
├── .github/workflows/backend.yml                    # NEW
│
├── backend/                                         # WIPED then recreated
│   ├── go.mod                                       # NEW (go mod init)
│   ├── go.sum                                       # NEW
│   ├── .env.example                                 # NEW
│   ├── .golangci.yml                                # NEW
│   ├── Dockerfile                                   # NEW
│   ├── sqlc.yaml                                    # NEW
│   ├── openapi.json                                 # NEW (generated, committed)
│   │
│   ├── cmd/
│   │   ├── api/main.go                              # NEW — HTTP server
│   │   ├── openapi/main.go                          # NEW — spec dumper
│   │   └── seed/main.go                             # NEW — seeder binary
│   │
│   ├── internal/
│   │   ├── catalog/
│   │   │   ├── domain.go                            # NEW — Product, Category, sentinel errors
│   │   │   ├── service.go                           # NEW — business logic
│   │   │   ├── service_test.go                      # NEW — table-driven tests w/ mock repo
│   │   │   ├── repository.go                        # NEW — Repository interface
│   │   │   ├── postgres.go                          # NEW — pgx/sqlc-backed Repository impl
│   │   │   ├── handler.go                           # NEW — Huma handler registration
│   │   │   ├── errors.go                            # NEW — mapError(err) → huma errors
│   │   │   ├── queries.sql                          # NEW — sqlc input
│   │   │   ├── db.go                                # (generated) — sqlc output
│   │   │   ├── models.go                            # (generated) — sqlc output
│   │   │   └── queries.sql.go                       # (generated) — sqlc output
│   │   │
│   │   └── platform/
│   │       ├── config/
│   │       │   ├── config.go                        # NEW — typed Config + LoadFromEnv
│   │       │   └── config_test.go                   # NEW
│   │       ├── logging/
│   │       │   └── logging.go                       # NEW — slog setup
│   │       ├── db/
│   │       │   └── db.go                            # NEW — pgxpool.New wrapper
│   │       └── server/
│   │           ├── server.go                        # NEW — Huma API init + middleware
│   │           ├── health.go                        # NEW — GET /health
│   │           └── health_test.go                   # NEW
│   │
│   ├── migrations/
│   │   └── 20260417120000_create_products.sql       # NEW — goose migration
│   │
│   └── data/
│       └── products.json                            # NEW — deterministic seed (15 products)
│
└── frontend/                                        # DELETED in Task 1 (recreated in Plan 0b)
```

Old `backend/` (Express) is deleted in Task 1. Old `frontend/` (React 19 + MUI) is also deleted in Task 1 since Plan 0b will scaffold a fresh FSD layout. Existing seed data in `backend/data/product.js` is read once to inform the new `products.json` before deletion.

## Hard constraints

- Every task ends with a commit unless explicitly marked `(no commit — combines with next)`.
- Use Conventional Commits format: `<type>(<scope>): <description>`.
- Attribution is disabled globally; do not add co-author footers.
- Never use `--no-verify` or `--amend`. If a pre-commit hook fails, fix and make a new commit.
- Go files: `gofmt`-formatted. No `fmt.Println` in production code — use `slog`.
- Tests use `testify/require` (fail-fast) for unrecoverable assertions, `testify/assert` for collecting failures.
- Generated files (sqlc output, `openapi.json`) are committed. CI fails on drift.

---

## Task 1: Clean slate — remove old Express/React code, preserve seed concept

**Files:**
- Delete: `backend/` (entire directory — Express + Mongoose)
- Delete: `frontend/` (entire directory — React 19 + MUI)
- Note: `backend/data/product.js` content informs Task 14's `products.json` creation. Read-only dependency; the actual file gets deleted with the rest of `backend/`.

- [ ] **Step 1: Confirm you're on main and synced**

```bash
git status
git log -1 --oneline
```

Expected: clean working tree aside from untracked files; `main` branch.

- [ ] **Step 2: Delete the old backend and frontend directories**

```bash
rm -rf backend frontend
```

- [ ] **Step 3: Verify the deletion**

```bash
ls
```

Expected output includes `.git/`, `.gitignore`, `CLAUDE.md` (if present), `README.md`, `docs/` — but no `backend/` or `frontend/`.

- [ ] **Step 4: Commit the clean slate**

```bash
git add -A
git status   # verify only backend/ and frontend/ deletions are staged
git commit -m "chore: remove legacy Express backend and MUI frontend for rebuild"
```

---

## Task 2: Initialize Go module and backend directory structure

**Files:**
- Create: `backend/go.mod`
- Create (empty placeholders): `backend/cmd/api/`, `backend/cmd/openapi/`, `backend/cmd/seed/`, `backend/internal/catalog/`, `backend/internal/platform/config/`, `backend/internal/platform/logging/`, `backend/internal/platform/db/`, `backend/internal/platform/server/`, `backend/migrations/`, `backend/data/`
- Create: `backend/.env.example`
- Create: `backend/.gitignore` (Go-specific)

- [ ] **Step 1: Create backend/ and cd into it**

```bash
mkdir -p backend && cd backend
```

- [ ] **Step 2: Initialize Go module**

```bash
go mod init github.com/z3tz3r0/ecommerce-space-craft/backend
```

Expected: creates `backend/go.mod` with `module github.com/z3tz3r0/ecommerce-space-craft/backend` and `go 1.23` directive.

- [ ] **Step 3: Create the directory skeleton**

```bash
mkdir -p cmd/api cmd/openapi cmd/seed \
         internal/catalog \
         internal/platform/config \
         internal/platform/logging \
         internal/platform/db \
         internal/platform/server \
         migrations data
```

- [ ] **Step 4: Add .gitkeep files to keep empty dirs tracked until populated**

```bash
touch cmd/api/.gitkeep cmd/openapi/.gitkeep cmd/seed/.gitkeep \
      internal/catalog/.gitkeep \
      internal/platform/config/.gitkeep \
      internal/platform/logging/.gitkeep \
      internal/platform/db/.gitkeep \
      internal/platform/server/.gitkeep \
      migrations/.gitkeep data/.gitkeep
```

- [ ] **Step 5: Create `backend/.env.example`**

Full content:

```
# Neon Postgres connection string (use pooled URL only if running on serverless; Render is long-running, use direct URL)
DATABASE_URL=postgres://user:pass@ep-xxxx.us-east-2.aws.neon.tech/dbname?sslmode=require

# Server
PORT=8080
ENVIRONMENT=dev                          # dev | prod
LOG_LEVEL=debug                          # debug | info | warn | error

# CORS whitelist (comma-separated, no spaces)
CORS_ORIGINS=http://localhost:5173
```

- [ ] **Step 6: Create `backend/.gitignore`**

Full content:

```
# Binaries
/bin/
/tmp/
*.test
*.out

# Env
.env
.env.local

# Coverage
*.coverage
coverage.out
```

- [ ] **Step 7: Commit**

```bash
cd ..
git add backend/
git commit -m "chore(backend): initialize Go module and directory structure"
```

---

## Task 3: Add platform/config with typed env loading and a unit test

**Files:**
- Create: `backend/internal/platform/config/config.go`
- Create: `backend/internal/platform/config/config_test.go`
- Delete: `backend/internal/platform/config/.gitkeep`

- [ ] **Step 1: Write the failing test at `backend/internal/platform/config/config_test.go`**

Full file:

```go
package config_test

import (
	"log/slog"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/z3tz3r0/ecommerce-space-craft/backend/internal/platform/config"
)

func TestLoad_RequiredVars(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://u:p@h/d")
	t.Setenv("PORT", "8080")
	t.Setenv("ENVIRONMENT", "dev")
	t.Setenv("LOG_LEVEL", "debug")
	t.Setenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000")

	cfg, err := config.Load()
	require.NoError(t, err)
	require.Equal(t, "postgres://u:p@h/d", cfg.DatabaseURL)
	require.Equal(t, "8080", cfg.Port)
	require.Equal(t, "dev", cfg.Environment)
	require.Equal(t, slog.LevelDebug, cfg.LogLevel)
	require.Equal(t, []string{"http://localhost:5173", "http://localhost:3000"}, cfg.CORSOrigins)
}

func TestLoad_MissingDatabaseURL(t *testing.T) {
	t.Setenv("DATABASE_URL", "")
	t.Setenv("PORT", "8080")
	t.Setenv("ENVIRONMENT", "dev")
	t.Setenv("LOG_LEVEL", "info")
	t.Setenv("CORS_ORIGINS", "http://localhost:5173")

	_, err := config.Load()
	require.ErrorContains(t, err, "DATABASE_URL")
}

func TestLoad_InvalidLogLevel(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://u:p@h/d")
	t.Setenv("PORT", "8080")
	t.Setenv("ENVIRONMENT", "dev")
	t.Setenv("LOG_LEVEL", "nonsense")
	t.Setenv("CORS_ORIGINS", "http://localhost:5173")

	_, err := config.Load()
	require.ErrorContains(t, err, "LOG_LEVEL")
}

func TestLoad_DefaultsPortAndEnvironment(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://u:p@h/d")
	t.Setenv("PORT", "")
	t.Setenv("ENVIRONMENT", "")
	t.Setenv("LOG_LEVEL", "info")
	t.Setenv("CORS_ORIGINS", "http://localhost:5173")

	cfg, err := config.Load()
	require.NoError(t, err)
	require.Equal(t, "8080", cfg.Port)
	require.Equal(t, "dev", cfg.Environment)
}
```

- [ ] **Step 2: Add testify to go.mod**

```bash
cd backend
go get github.com/stretchr/testify@latest
```

- [ ] **Step 3: Run the test and verify it fails**

```bash
go test ./internal/platform/config/...
```

Expected: `undefined: config.Load` compile error.

- [ ] **Step 4: Implement `backend/internal/platform/config/config.go`**

Full file:

```go
// Package config loads and validates runtime configuration from environment variables.
package config

import (
	"errors"
	"fmt"
	"log/slog"
	"os"
	"strings"
)

type Config struct {
	DatabaseURL string
	Port        string
	Environment string
	LogLevel    slog.Level
	CORSOrigins []string
}

func Load() (Config, error) {
	cfg := Config{
		DatabaseURL: os.Getenv("DATABASE_URL"),
		Port:        os.Getenv("PORT"),
		Environment: os.Getenv("ENVIRONMENT"),
	}

	if cfg.DatabaseURL == "" {
		return Config{}, errors.New("config: DATABASE_URL is required")
	}
	if cfg.Port == "" {
		cfg.Port = "8080"
	}
	if cfg.Environment == "" {
		cfg.Environment = "dev"
	}

	lvl, err := parseLogLevel(os.Getenv("LOG_LEVEL"))
	if err != nil {
		return Config{}, err
	}
	cfg.LogLevel = lvl

	cfg.CORSOrigins = parseOrigins(os.Getenv("CORS_ORIGINS"))

	return cfg, nil
}

func parseLogLevel(s string) (slog.Level, error) {
	switch strings.ToLower(strings.TrimSpace(s)) {
	case "", "info":
		return slog.LevelInfo, nil
	case "debug":
		return slog.LevelDebug, nil
	case "warn", "warning":
		return slog.LevelWarn, nil
	case "error":
		return slog.LevelError, nil
	default:
		return 0, fmt.Errorf("config: LOG_LEVEL %q invalid (expected debug|info|warn|error)", s)
	}
}

func parseOrigins(s string) []string {
	if s == "" {
		return nil
	}
	parts := strings.Split(s, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if trimmed := strings.TrimSpace(p); trimmed != "" {
			out = append(out, trimmed)
		}
	}
	return out
}
```

- [ ] **Step 5: Run tests and verify they pass**

```bash
go test ./internal/platform/config/... -v
```

Expected: PASS, 4 tests.

- [ ] **Step 6: Delete the .gitkeep**

```bash
rm internal/platform/config/.gitkeep
```

- [ ] **Step 7: Commit**

```bash
cd ..
git add backend/go.mod backend/go.sum backend/internal/platform/config/
git commit -m "feat(backend): add typed env config loader with tests"
```

---

## Task 4: Add platform/logging (slog setup)

**Files:**
- Create: `backend/internal/platform/logging/logging.go`
- Delete: `backend/internal/platform/logging/.gitkeep`

- [ ] **Step 1: Implement `backend/internal/platform/logging/logging.go`**

Full file:

```go
// Package logging builds a slog.Logger for the application.
package logging

import (
	"log/slog"
	"os"
)

// New returns a slog.Logger. environment "dev" uses a text handler; any other
// value uses JSON. Level is applied to the handler.
func New(environment string, level slog.Level) *slog.Logger {
	opts := &slog.HandlerOptions{Level: level}
	var h slog.Handler
	if environment == "dev" {
		h = slog.NewTextHandler(os.Stdout, opts)
	} else {
		h = slog.NewJSONHandler(os.Stdout, opts)
	}
	return slog.New(h)
}
```

- [ ] **Step 2: Compile to verify it's valid Go**

```bash
cd backend
go build ./internal/platform/logging/...
```

Expected: exits 0, no output.

- [ ] **Step 3: Delete the .gitkeep**

```bash
rm internal/platform/logging/.gitkeep
```

- [ ] **Step 4: Commit**

```bash
cd ..
git add backend/internal/platform/logging/
git commit -m "feat(backend): add slog logger factory for dev and prod"
```

---

## Task 5: Add platform/db (pgxpool wrapper)

**Files:**
- Create: `backend/internal/platform/db/db.go`
- Delete: `backend/internal/platform/db/.gitkeep`

- [ ] **Step 1: Add pgx v5 dependency**

```bash
cd backend
go get github.com/jackc/pgx/v5/pgxpool@latest
```

- [ ] **Step 2: Implement `backend/internal/platform/db/db.go`**

Full file:

```go
// Package db opens and manages the Postgres connection pool.
package db

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// New opens a pgx connection pool and pings it. Caller must defer Close().
func New(ctx context.Context, databaseURL string) (*pgxpool.Pool, error) {
	cfg, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, fmt.Errorf("db: parse config: %w", err)
	}
	cfg.MaxConns = 10
	cfg.MinConns = 1
	cfg.MaxConnLifetime = time.Hour
	cfg.MaxConnIdleTime = 30 * time.Minute

	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("db: new pool: %w", err)
	}

	pingCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	if err := pool.Ping(pingCtx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("db: ping: %w", err)
	}

	return pool, nil
}
```

- [ ] **Step 3: Verify it compiles**

```bash
go build ./internal/platform/db/...
```

Expected: exits 0.

- [ ] **Step 4: Delete the .gitkeep and commit**

```bash
rm internal/platform/db/.gitkeep
cd ..
git add backend/go.mod backend/go.sum backend/internal/platform/db/
git commit -m "feat(backend): add pgx connection pool wrapper"
```

---

## Task 6: Write the first migration (create_products)

**Files:**
- Create: `backend/migrations/20260417120000_create_products.sql`
- Delete: `backend/migrations/.gitkeep`

- [ ] **Step 1: Create the migration file**

Full file `backend/migrations/20260417120000_create_products.sql`:

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

- [ ] **Step 2: Delete the .gitkeep**

```bash
rm backend/migrations/.gitkeep
```

- [ ] **Step 3: Commit (no commit — combines with Task 7's Makefile)**

Skip commit; proceed to Task 7.

---

## Task 7: Create the root Makefile with migration targets, then apply the migration to Neon

**Files:**
- Create: `Makefile` (repo root)
- Modify: `backend/.env` (create locally, do not commit — `.env.example` is already committed)

- [ ] **Step 1: Create the root Makefile**

Full file `Makefile`:

```makefile
# Makefile — canonical entry point for Phase 0a backend targets.
# Frontend targets are added in Plan 0b.

SHELL := /bin/bash
.DEFAULT_GOAL := help

.PHONY: help
help:
	@awk 'BEGIN{FS=":.*##"; printf "\nTargets:\n"} /^[a-zA-Z0-9_-]+:.*##/{printf "  %-24s %s\n",$$1,$$2}' $(MAKEFILE_LIST)

# ---------- install / tooling ----------
.PHONY: install
install: install-backend ## Install all dependencies (backend in 0a; frontend added in 0b)

.PHONY: install-backend
install-backend: ## Download Go modules
	cd backend && go mod download

# ---------- dev ----------
.PHONY: dev
dev: dev-backend ## Run dev servers (backend only in 0a)

.PHONY: dev-backend
dev-backend: ## Run the Go API locally
	cd backend && go run ./cmd/api

# ---------- build ----------
.PHONY: build
build: build-backend ## Build production binaries

.PHONY: build-backend
build-backend: ## Build the Go API binary to backend/bin/api
	cd backend && go build -o bin/api ./cmd/api

# ---------- test ----------
.PHONY: test
test: test-backend ## Run all tests

.PHONY: test-backend
test-backend: ## Run Go tests with race detector
	cd backend && go test ./... -race -count=1

# ---------- lint / fmt ----------
.PHONY: lint
lint: lint-backend ## Run all linters

.PHONY: lint-backend
lint-backend: ## Run golangci-lint
	cd backend && golangci-lint run ./...

.PHONY: fmt
fmt: fmt-backend ## Format all code

.PHONY: fmt-backend
fmt-backend: ## gofmt + goimports on backend
	cd backend && gofmt -w . && go run golang.org/x/tools/cmd/goimports@latest -w .

# ---------- codegen ----------
.PHONY: codegen
codegen: sqlc-generate openapi-dump ## Regenerate sqlc and OpenAPI artifacts

.PHONY: sqlc-generate
sqlc-generate: ## Regenerate sqlc Go code from queries.sql
	cd backend && sqlc generate

.PHONY: openapi-dump
openapi-dump: ## Dump Huma's OpenAPI spec to backend/openapi.json
	cd backend && go run ./cmd/openapi > openapi.json

# ---------- migrations ----------
.PHONY: migrate-create
migrate-create: ## goose create a new migration: make migrate-create name=add_foo
	cd backend && goose -dir migrations create $(name) sql

.PHONY: migrate-up
migrate-up: ## Apply all pending migrations
	cd backend && goose -dir migrations postgres "$$DATABASE_URL" up

.PHONY: migrate-down
migrate-down: ## Roll back the most recent migration
	cd backend && goose -dir migrations postgres "$$DATABASE_URL" down

.PHONY: migrate-status
migrate-status: ## Show applied/pending migrations
	cd backend && goose -dir migrations postgres "$$DATABASE_URL" status

.PHONY: migrate-redo
migrate-redo: ## Roll back + reapply the most recent migration (dev only)
	cd backend && goose -dir migrations postgres "$$DATABASE_URL" redo

# ---------- seed ----------
.PHONY: seed
seed: ## Populate products table from backend/data/products.json
	cd backend && go run ./cmd/seed

.PHONY: seed-destroy
seed-destroy: ## TRUNCATE products table
	cd backend && go run ./cmd/seed -d

# ---------- clean ----------
.PHONY: clean
clean: ## Remove build artifacts
	rm -rf backend/bin
```

- [ ] **Step 2: Create local `backend/.env` pointing at your Neon database**

Copy `backend/.env.example` to `backend/.env` and fill in the `DATABASE_URL` from Neon. Do NOT commit `.env`.

```bash
cp backend/.env.example backend/.env
# then edit backend/.env and paste your Neon connection string
```

- [ ] **Step 3: Export env vars and apply the migration**

```bash
set -a && source backend/.env && set +a
make migrate-up
```

Expected output: `OK 20260417120000_create_products.sql`. If goose isn't on PATH, install per Prerequisites.

- [ ] **Step 4: Verify migration applied**

```bash
make migrate-status
```

Expected output shows `Applied At` timestamp for `20260417120000_create_products.sql`.

- [ ] **Step 5: Commit the Makefile and migration**

```bash
git add Makefile backend/migrations/20260417120000_create_products.sql
git commit -m "feat(backend): add root Makefile and products table migration"
```

---

## Task 8: Configure sqlc and write catalog/queries.sql (no generated code yet)

**Files:**
- Create: `backend/sqlc.yaml`
- Create: `backend/internal/catalog/queries.sql`

- [ ] **Step 1: Create `backend/sqlc.yaml`**

Full file:

```yaml
version: "2"
sql:
  - engine: postgresql
    queries: internal/catalog/queries.sql
    schema: migrations
    gen:
      go:
        package: catalog
        out: internal/catalog
        sql_package: pgx/v5
        emit_pointers_for_null_types: true
        emit_json_tags: false
        emit_prepared_queries: false
        overrides:
          # Use google/uuid directly instead of pgtype.UUID so the domain types
          # and the sqlc row types share the same UUID representation.
          - db_type: "uuid"
            go_type:
              import: "github.com/google/uuid"
              type: "UUID"
          - db_type: "uuid"
            nullable: true
            go_type:
              import: "github.com/google/uuid"
              type: "UUID"
              pointer: true
          # timestamptz → time.Time (non-null columns only — they have NOT NULL).
          - db_type: "timestamptz"
            go_type:
              import: "time"
              type: "Time"
```

- [ ] **Step 2: Create `backend/internal/catalog/queries.sql`**

Full file:

```sql
-- name: GetProductByID :one
SELECT
    id, name, description, price_cents, image_url,
    manufacturer, crew_amount, max_speed, category,
    stock_quantity, is_active, created_at, updated_at
FROM products
WHERE id = $1 AND is_active = true;

-- name: ListActiveProducts :many
SELECT
    id, name, description, price_cents, image_url,
    manufacturer, crew_amount, max_speed, category,
    stock_quantity, is_active, created_at, updated_at
FROM products
WHERE is_active = true
ORDER BY created_at DESC;
```

- [ ] **Step 3: Run sqlc generate**

```bash
make sqlc-generate
```

Expected: creates `backend/internal/catalog/db.go`, `models.go`, `queries.sql.go`. No errors.

- [ ] **Step 4: Verify generated files exist**

```bash
ls backend/internal/catalog/
```

Expected output includes `db.go`, `models.go`, `queries.sql.go`, `queries.sql`, `.gitkeep`.

- [ ] **Step 5: Delete the .gitkeep**

```bash
rm backend/internal/catalog/.gitkeep
```

- [ ] **Step 6: Commit**

```bash
git add backend/sqlc.yaml backend/internal/catalog/
git commit -m "feat(backend): wire sqlc and add catalog queries (GetProductByID, ListActiveProducts)"
```

---

## Task 9: Write catalog/domain.go (domain types + sentinel errors)

**Files:**
- Create: `backend/internal/catalog/domain.go`

- [ ] **Step 1: Write `backend/internal/catalog/domain.go`**

Full file:

```go
// Package catalog is the products bounded context.
package catalog

import (
	"errors"
	"time"

	"github.com/google/uuid"
)

// Category is a spacecraft category with a fixed allowed set.
type Category string

const (
	CategoryFighter     Category = "Fighter"
	CategoryFreighter   Category = "Freighter"
	CategoryShuttle     Category = "Shuttle"
	CategorySpeeder     Category = "Speeder"
	CategoryCruiser     Category = "Cruiser"
	CategoryCapitalShip Category = "Capital Ship"
)

// AllCategories returns every valid category in enum-declaration order.
func AllCategories() []Category {
	return []Category{
		CategoryFighter,
		CategoryFreighter,
		CategoryShuttle,
		CategorySpeeder,
		CategoryCruiser,
		CategoryCapitalShip,
	}
}

// Product is a spacecraft offered in the store.
type Product struct {
	ID            uuid.UUID `json:"id"`
	Name          string    `json:"name"`
	Description   string    `json:"description"`
	PriceCents    int32     `json:"priceCents"`
	ImageURL      *string   `json:"imageUrl,omitempty"`
	Manufacturer  *string   `json:"manufacturer,omitempty"`
	CrewAmount    *int32    `json:"crewAmount,omitempty"`
	MaxSpeed      *string   `json:"maxSpeed,omitempty"`
	Category      Category  `json:"category"`
	StockQuantity int32     `json:"stockQuantity"`
	IsActive      bool      `json:"isActive"`
	CreatedAt     time.Time `json:"createdAt"`
	UpdatedAt     time.Time `json:"updatedAt"`
}

// Sentinel errors exposed by the catalog context.
var (
	ErrProductNotFound = errors.New("product not found")
	ErrInvalidID       = errors.New("invalid product id")
)
```

- [ ] **Step 2: Add uuid dependency**

```bash
cd backend
go get github.com/google/uuid@latest
```

- [ ] **Step 3: Verify it compiles**

```bash
go build ./internal/catalog/...
```

Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
cd ..
git add backend/go.mod backend/go.sum backend/internal/catalog/domain.go
git commit -m "feat(catalog): add Product domain type and Category enum"
```

---

## Task 10: Write catalog/repository.go (Repository interface)

**Files:**
- Create: `backend/internal/catalog/repository.go`

- [ ] **Step 1: Write `backend/internal/catalog/repository.go`**

Full file:

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
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd backend && go build ./internal/catalog/...
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
cd ..
git add backend/internal/catalog/repository.go
git commit -m "feat(catalog): define Repository interface"
```

---

## Task 11: Write catalog/service.go with TDD (service layer + mock-based tests)

**Files:**
- Create: `backend/internal/catalog/service_test.go`
- Create: `backend/internal/catalog/service.go`

- [ ] **Step 1: Write the failing test at `backend/internal/catalog/service_test.go`**

Full file:

```go
package catalog_test

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"

	"github.com/z3tz3r0/ecommerce-space-craft/backend/internal/catalog"
)

// mockRepo is a hand-rolled test double. No mocking library needed for two methods.
type mockRepo struct {
	getByIDFn    func(ctx context.Context, id uuid.UUID) (catalog.Product, error)
	listActiveFn func(ctx context.Context) ([]catalog.Product, error)
}

func (m mockRepo) GetByID(ctx context.Context, id uuid.UUID) (catalog.Product, error) {
	return m.getByIDFn(ctx, id)
}

func (m mockRepo) ListActive(ctx context.Context) ([]catalog.Product, error) {
	return m.listActiveFn(ctx)
}

func TestService_GetByID_ValidID_ReturnsProduct(t *testing.T) {
	want := catalog.Product{
		ID:       uuid.New(),
		Name:     "Test Craft",
		Category: catalog.CategoryFighter,
	}
	repo := mockRepo{
		getByIDFn: func(_ context.Context, _ uuid.UUID) (catalog.Product, error) {
			return want, nil
		},
	}
	svc := catalog.NewService(repo)

	got, err := svc.GetByID(context.Background(), want.ID.String())
	require.NoError(t, err)
	require.Equal(t, want.ID, got.ID)
}

func TestService_GetByID_InvalidUUID_ReturnsErrInvalidID(t *testing.T) {
	svc := catalog.NewService(mockRepo{})

	_, err := svc.GetByID(context.Background(), "not-a-uuid")
	require.ErrorIs(t, err, catalog.ErrInvalidID)
}

func TestService_GetByID_NotFound_PropagatesErr(t *testing.T) {
	repo := mockRepo{
		getByIDFn: func(_ context.Context, _ uuid.UUID) (catalog.Product, error) {
			return catalog.Product{}, catalog.ErrProductNotFound
		},
	}
	svc := catalog.NewService(repo)

	_, err := svc.GetByID(context.Background(), uuid.New().String())
	require.ErrorIs(t, err, catalog.ErrProductNotFound)
}

func TestService_GetByID_RepoOtherError_Wrapped(t *testing.T) {
	boom := errors.New("db exploded")
	repo := mockRepo{
		getByIDFn: func(_ context.Context, _ uuid.UUID) (catalog.Product, error) {
			return catalog.Product{}, boom
		},
	}
	svc := catalog.NewService(repo)

	_, err := svc.GetByID(context.Background(), uuid.New().String())
	require.Error(t, err)
	require.ErrorIs(t, err, boom)
}

func TestService_ListActive_ReturnsRepoResult(t *testing.T) {
	want := []catalog.Product{
		{ID: uuid.New(), Name: "A", Category: catalog.CategoryFighter},
		{ID: uuid.New(), Name: "B", Category: catalog.CategoryCruiser},
	}
	repo := mockRepo{
		listActiveFn: func(_ context.Context) ([]catalog.Product, error) {
			return want, nil
		},
	}
	svc := catalog.NewService(repo)

	got, err := svc.ListActive(context.Background())
	require.NoError(t, err)
	require.Len(t, got, 2)
	require.Equal(t, want[0].Name, got[0].Name)
}
```

- [ ] **Step 2: Run the test and verify it fails**

```bash
cd backend && go test ./internal/catalog/... -run TestService
```

Expected: compile error `undefined: catalog.NewService`.

- [ ] **Step 3: Implement `backend/internal/catalog/service.go`**

Full file:

```go
package catalog

import (
	"context"
	"fmt"

	"github.com/google/uuid"
)

// Service holds business logic for the catalog bounded context.
type Service struct {
	repo Repository
}

// NewService constructs a Service wrapping the given Repository.
func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

// GetByID validates the string id and fetches the product from the repository.
func (s *Service) GetByID(ctx context.Context, id string) (Product, error) {
	uid, err := uuid.Parse(id)
	if err != nil {
		return Product{}, fmt.Errorf("catalog: parse id %q: %w", id, ErrInvalidID)
	}
	p, err := s.repo.GetByID(ctx, uid)
	if err != nil {
		return Product{}, fmt.Errorf("catalog: get product %s: %w", uid, err)
	}
	return p, nil
}

// ListActive returns every active product ordered most-recent-first.
func (s *Service) ListActive(ctx context.Context) ([]Product, error) {
	ps, err := s.repo.ListActive(ctx)
	if err != nil {
		return nil, fmt.Errorf("catalog: list active: %w", err)
	}
	return ps, nil
}
```

- [ ] **Step 4: Run the tests and verify they pass**

```bash
go test ./internal/catalog/... -run TestService -v
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
cd ..
git add backend/internal/catalog/service.go backend/internal/catalog/service_test.go
git commit -m "feat(catalog): add Service with GetByID and ListActive + unit tests"
```

---

## Task 12: Write catalog/postgres.go (Repository implementation)

**Files:**
- Create: `backend/internal/catalog/postgres.go`

- [ ] **Step 1: Inspect the sqlc-generated types for field names**

```bash
grep -E "type (Product|ListActiveProductsRow|GetProductByIDRow)" backend/internal/catalog/models.go backend/internal/catalog/queries.sql.go
```

Note the exact field names sqlc emitted (e.g., `PriceCents`, `ImageUrl`, `CrewAmount`). The mapping code must match.

- [ ] **Step 2: Implement `backend/internal/catalog/postgres.go`**

Full file:

```go
package catalog

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Postgres is the pgx/sqlc-backed implementation of Repository.
type Postgres struct {
	q *Queries
}

// NewPostgres wraps a pgxpool.Pool with the sqlc-generated Queries.
func NewPostgres(pool *pgxpool.Pool) *Postgres {
	return &Postgres{q: New(pool)}
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
	return rowToProduct(row), nil
}

// ListActive returns every active product ordered by created_at DESC.
func (p *Postgres) ListActive(ctx context.Context) ([]Product, error) {
	rows, err := p.q.ListActiveProducts(ctx)
	if err != nil {
		return nil, fmt.Errorf("postgres: list active: %w", err)
	}
	out := make([]Product, 0, len(rows))
	for _, r := range rows {
		out = append(out, listRowToProduct(r))
	}
	return out, nil
}
```

- [ ] **Step 3: Add a small adapter file for row→domain translation**

Append (or add a new block) to `backend/internal/catalog/postgres.go`:

```go
// NOTE: the helpers below translate sqlc row types to the domain Product.
// sqlc emits two separate row types (one per query) with identical shape;
// we keep the helpers explicit to avoid generics for two call sites.

func rowToProduct(r GetProductByIDRow) Product {
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
		CreatedAt:     r.CreatedAt,
		UpdatedAt:     r.UpdatedAt,
	}
}

func listRowToProduct(r ListActiveProductsRow) Product {
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
		CreatedAt:     r.CreatedAt,
		UpdatedAt:     r.UpdatedAt,
	}
}
```

- [ ] **Step 4: Verify it compiles**

```bash
cd backend && go build ./internal/catalog/...
```

Expected: exits 0. If you see field-name mismatches with the sqlc output, adjust field names in the helpers to match exactly what Step 1 revealed (common variants: `ImageUrl` vs `ImageURL`, `pgtype.Timestamptz` vs `time.Time`).

- [ ] **Step 5: Commit**

```bash
cd ..
git add backend/internal/catalog/postgres.go
git commit -m "feat(catalog): add pgx Postgres implementation of Repository"
```

---

## Task 13: Write catalog/errors.go and catalog/handler.go (Huma handlers)

**Files:**
- Create: `backend/internal/catalog/errors.go`
- Create: `backend/internal/catalog/handler.go`

- [ ] **Step 1: Add Huma dependency**

```bash
cd backend
go get github.com/danielgtaylor/huma/v2@latest
```

- [ ] **Step 2: Create `backend/internal/catalog/errors.go`**

Full file:

```go
package catalog

import (
	"errors"
	"log/slog"

	"github.com/danielgtaylor/huma/v2"
)

// mapError converts a domain error to a Huma-compatible error response.
// Unknown errors are logged and returned as 500.
func mapError(logger *slog.Logger, err error) error {
	switch {
	case errors.Is(err, ErrProductNotFound):
		return huma.Error404NotFound("product not found")
	case errors.Is(err, ErrInvalidID):
		return huma.Error400BadRequest("invalid product id")
	default:
		logger.Error("catalog: unexpected error", "err", err.Error())
		return huma.Error500InternalServerError("internal error")
	}
}
```

- [ ] **Step 3: Create `backend/internal/catalog/handler.go`**

Full file:

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
		Summary:     "List all active products",
		Tags:        []string{"Catalog"},
	}, func(ctx context.Context, _ *struct{}) (*ListProductsOutput, error) {
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

// --- Huma I/O types (these DRIVE the OpenAPI spec). ---

type GetProductInput struct {
	ID string `path:"id" doc:"Product UUID"`
}

type GetProductOutput struct {
	Body Product
}

type ListProductsOutput struct {
	Body []Product
}
```

- [ ] **Step 4: Verify it compiles**

```bash
go build ./internal/catalog/...
```

Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
cd ..
git add backend/go.mod backend/go.sum backend/internal/catalog/errors.go backend/internal/catalog/handler.go
git commit -m "feat(catalog): add Huma HTTP handlers and error mapper"
```

---

## Task 14: Write platform/server with /health endpoint and middleware, plus a test

**Files:**
- Create: `backend/internal/platform/server/server.go`
- Create: `backend/internal/platform/server/health.go`
- Create: `backend/internal/platform/server/health_test.go`
- Delete: `backend/internal/platform/server/.gitkeep`

- [ ] **Step 1: Write the failing health test at `backend/internal/platform/server/health_test.go`**

Full file:

```go
package server_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/adapters/humago"
	"github.com/stretchr/testify/require"

	"github.com/z3tz3r0/ecommerce-space-craft/backend/internal/platform/server"
)

func TestHealth_Returns200AndOK(t *testing.T) {
	mux := http.NewServeMux()
	api := humago.New(mux, huma.DefaultConfig("test", "0.0.0"))
	server.RegisterHealth(api)

	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	require.Contains(t, w.Body.String(), "ok")
}
```

- [ ] **Step 2: Run the test and verify it fails**

```bash
cd backend && go test ./internal/platform/server/...
```

Expected: compile error — `server.RegisterHealth` not defined.

- [ ] **Step 3: Create `backend/internal/platform/server/health.go`**

Full file:

```go
package server

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
)

type HealthOutput struct {
	Body struct {
		Status string `json:"status" example:"ok"`
	}
}

// RegisterHealth registers GET /health on the given Huma API.
func RegisterHealth(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "health",
		Method:      http.MethodGet,
		Path:        "/health",
		Summary:     "Liveness probe",
		Tags:        []string{"System"},
	}, func(_ context.Context, _ *struct{}) (*HealthOutput, error) {
		out := &HealthOutput{}
		out.Body.Status = "ok"
		return out, nil
	})
}
```

- [ ] **Step 4: Create `backend/internal/platform/server/server.go`**

Full file:

```go
// Package server builds the Huma API, registers platform endpoints, and applies middleware.
package server

import (
	"log/slog"
	"net/http"
	"slices"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/adapters/humago"
	"github.com/google/uuid"
)

// API bundles the Huma API and the underlying http.ServeMux so main.go can start an http.Server.
type API struct {
	Huma huma.API
	Mux  *http.ServeMux
}

// New creates the API with recover + logging + CORS middleware applied.
func New(title, version string, logger *slog.Logger, corsOrigins []string) *API {
	mux := http.NewServeMux()
	cfg := huma.DefaultConfig(title, version)
	api := humago.New(mux, cfg)

	api.UseMiddleware(recoverMiddleware(logger))
	api.UseMiddleware(requestLogMiddleware(logger))
	api.UseMiddleware(corsMiddleware(corsOrigins))

	RegisterHealth(api)

	return &API{Huma: api, Mux: mux}
}

// --- middleware ---

func recoverMiddleware(logger *slog.Logger) func(huma.Context, func(huma.Context)) {
	return func(ctx huma.Context, next func(huma.Context)) {
		defer func() {
			if r := recover(); r != nil {
				logger.Error("panic recovered", "value", r, "path", ctx.URL().Path)
				_ = huma.WriteErr(ctx.Operation().Method, ctx, http.StatusInternalServerError,
					"internal error")
			}
		}()
		next(ctx)
	}
}

func requestLogMiddleware(logger *slog.Logger) func(huma.Context, func(huma.Context)) {
	return func(ctx huma.Context, next func(huma.Context)) {
		start := time.Now()
		reqID := uuid.NewString()
		ctx.SetHeader("X-Request-ID", reqID)
		next(ctx)
		logger.Info("request",
			"method", ctx.Method(),
			"path", ctx.URL().Path,
			"status", ctx.Status(),
			"duration_ms", time.Since(start).Milliseconds(),
			"request_id", reqID,
		)
	}
}

func corsMiddleware(allowed []string) func(huma.Context, func(huma.Context)) {
	return func(ctx huma.Context, next func(huma.Context)) {
		origin := ctx.Header("Origin")
		if origin != "" && slices.Contains(allowed, origin) {
			ctx.SetHeader("Access-Control-Allow-Origin", origin)
			ctx.SetHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			ctx.SetHeader("Access-Control-Allow-Headers", "Content-Type, Authorization")
			ctx.SetHeader("Access-Control-Allow-Credentials", "true")
			ctx.SetHeader("Vary", "Origin")
		}
		if ctx.Method() == http.MethodOptions {
			ctx.SetStatus(http.StatusNoContent)
			return
		}
		next(ctx)
	}
}
```

**Middleware-signature fallback:** Huma v2's middleware API has changed across minor releases. The signature shown above (`func(huma.Context, func(huma.Context))`) matches the current release as of this plan's date. After `go get`, run `go doc github.com/danielgtaylor/huma/v2.Middleware` to confirm. If the installed signature differs, do NOT waste time matching the Huma API — instead, move the three middlewares (`recoverMiddleware`, `requestLogMiddleware`, `corsMiddleware`) to **plain `net/http` middleware** that wraps `mux` at the `http.Handler` boundary:

```go
// platform/server/server.go (fallback shape)
type handlerMiddleware func(http.Handler) http.Handler

func New(title, version string, logger *slog.Logger, corsOrigins []string) *API {
	mux := http.NewServeMux()
	cfg := huma.DefaultConfig(title, version)
	api := humago.New(mux, cfg)
	RegisterHealth(api)

	wrapped := chain(mux, recoverHTTP(logger), requestLogHTTP(logger), corsHTTP(corsOrigins))
	return &API{Huma: api, Mux: wrapped.(*http.ServeMux)}  // if chain preserves mux; else change API.Mux to http.Handler.
}

func chain(h http.Handler, mw ...handlerMiddleware) http.Handler {
	for i := len(mw) - 1; i >= 0; i-- {
		h = mw[i](h)
	}
	return h
}
```

Then `main.go` uses `api.Mux` (typed as `http.Handler`) as the server's handler. The functional behavior (recover, log, CORS) must be preserved regardless of which path you take.

- [ ] **Step 5: Run the test and verify it passes**

```bash
go test ./internal/platform/server/... -v
```

Expected: PASS for `TestHealth_Returns200AndOK`.

- [ ] **Step 6: Delete the .gitkeep and commit**

```bash
rm internal/platform/server/.gitkeep
cd ..
git add backend/internal/platform/server/ backend/go.mod backend/go.sum
git commit -m "feat(server): add Huma API factory, health endpoint, and middleware"
```

---

## Task 15: Write cmd/api/main.go (wires everything together)

**Files:**
- Create: `backend/cmd/api/main.go`
- Delete: `backend/cmd/api/.gitkeep`

- [ ] **Step 1: Implement `backend/cmd/api/main.go`**

Full file:

```go
// Command api runs the HTTP server.
package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os/signal"
	"syscall"
	"time"

	"github.com/z3tz3r0/ecommerce-space-craft/backend/internal/catalog"
	"github.com/z3tz3r0/ecommerce-space-craft/backend/internal/platform/config"
	"github.com/z3tz3r0/ecommerce-space-craft/backend/internal/platform/db"
	"github.com/z3tz3r0/ecommerce-space-craft/backend/internal/platform/logging"
	"github.com/z3tz3r0/ecommerce-space-craft/backend/internal/platform/server"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	logger := logging.New(cfg.Environment, cfg.LogLevel)

	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	pool, err := db.New(ctx, cfg.DatabaseURL)
	if err != nil {
		logger.Error("db init failed", "err", err.Error())
		log.Fatalf("db: %v", err)
	}
	defer pool.Close()

	api := server.New("Spacecraft Store API", "0.1.0", logger, cfg.CORSOrigins)

	catalogRepo := catalog.NewPostgres(pool)
	catalogSvc := catalog.NewService(catalogRepo)
	catalog.Register(api.Huma, catalogSvc, logger)

	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           api.Mux,
		ReadHeaderTimeout: 5 * time.Second,
	}

	go func() {
		logger.Info("server listening", "port", cfg.Port, "env", cfg.Environment)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Error("listen", "err", err.Error())
		}
	}()

	<-ctx.Done()
	logger.Info("shutdown signal received")

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		logger.Error("shutdown", "err", err.Error())
	}
}
```

- [ ] **Step 2: Verify it builds**

```bash
cd backend && go build ./cmd/api
```

Expected: exits 0.

- [ ] **Step 3: Run the server locally against Neon**

```bash
set -a && source .env && set +a
go run ./cmd/api
```

Expected log: `server listening port=8080 env=dev`.

- [ ] **Step 4: Verify /health and /api/products respond (in a second terminal)**

```bash
curl -s http://localhost:8080/health | grep -q '"status":"ok"' && echo HEALTH-OK
curl -s http://localhost:8080/api/products
```

Expected: `HEALTH-OK`, and `[]` for products (empty table so far).

- [ ] **Step 5: Stop the server** (Ctrl-C in terminal 1).

- [ ] **Step 6: Delete the .gitkeep and commit**

```bash
rm cmd/api/.gitkeep
cd ..
git add backend/cmd/api/
git commit -m "feat(api): wire main.go with config, db, server, and catalog"
```

---

## Task 16: Write cmd/openapi/main.go (dumps the spec)

**Files:**
- Create: `backend/cmd/openapi/main.go`
- Delete: `backend/cmd/openapi/.gitkeep`

- [ ] **Step 1: Implement `backend/cmd/openapi/main.go`**

Full file (this is the ONLY version — write this verbatim):

```go
// Command openapi constructs the Huma API identically to cmd/api but dumps
// the OpenAPI spec to stdout without starting the HTTP server. This lets the
// frontend regenerate its typed client without a running backend.
package main

import (
	"context"
	"fmt"
	"log/slog"
	"os"

	"github.com/google/uuid"

	"github.com/z3tz3r0/ecommerce-space-craft/backend/internal/catalog"
	"github.com/z3tz3r0/ecommerce-space-craft/backend/internal/platform/logging"
	"github.com/z3tz3r0/ecommerce-space-craft/backend/internal/platform/server"
)

func main() {
	logger := logging.New("dev", slog.LevelError)
	api := server.New("Spacecraft Store API", "0.1.0", logger, nil)

	// Register the same routes cmd/api registers, backed by a no-op repo.
	// The spec only depends on handler signatures, not service internals.
	catalog.Register(api.Huma, catalog.NewService(nopRepo{}), logger)

	out, err := api.Huma.OpenAPI().MarshalJSON()
	if err != nil {
		fmt.Fprintln(os.Stderr, "openapi marshal:", err)
		os.Exit(1)
	}
	if _, err := os.Stdout.Write(out); err != nil {
		fmt.Fprintln(os.Stderr, "openapi write:", err)
		os.Exit(1)
	}
}

// nopRepo satisfies catalog.Repository with stubs. Used only at spec-dump time
// when handlers are never actually invoked.
type nopRepo struct{}

func (nopRepo) GetByID(_ context.Context, _ uuid.UUID) (catalog.Product, error) {
	return catalog.Product{}, nil
}
func (nopRepo) ListActive(_ context.Context) ([]catalog.Product, error) {
	return nil, nil
}
func (nopRepo) Create(_ context.Context, _ catalog.CreateInput) (catalog.Product, error) {
	return catalog.Product{}, nil
}
func (nopRepo) DeleteAll(_ context.Context) error {
	return nil
}
```

- [ ] **Step 2: Verify it builds**

```bash
cd backend && go build ./cmd/openapi
```

Expected: exits 0.

- [ ] **Step 3: Run `make openapi-dump` and inspect**

```bash
cd ..
make openapi-dump
head -c 200 backend/openapi.json
```

Expected: a JSON document starting with `{"openapi":"3.1.0"...`. The file `backend/openapi.json` exists.

- [ ] **Step 4: Delete the .gitkeep and commit**

```bash
rm backend/cmd/openapi/.gitkeep
git add backend/cmd/openapi/ backend/openapi.json
git commit -m "feat(backend): add openapi dump command and commit initial spec"
```

---

## Task 17: Create deterministic seed data (backend/data/products.json)

**Files:**
- Create: `backend/data/products.json`
- Delete: `backend/data/.gitkeep`

- [ ] **Step 1: Write `backend/data/products.json`**

Full file (15 deterministic products):

```json
[
  {
    "name": "Quantum StarHopper",
    "description": "A versatile Quantum StarHopper suitable for various missions across the galaxy.",
    "priceCents": 75000000,
    "imageUrl": "https://www.placehold.co/300x200.png?text=Quantum%20StarHopper",
    "manufacturer": "Corellian Engineering",
    "crewAmount": 4,
    "maxSpeed": "85 MGLT",
    "category": "Fighter",
    "stockQuantity": 12,
    "isActive": true
  },
  {
    "name": "Nova Nebula Freighter",
    "description": "Heavy-duty freighter optimized for long-haul cargo runs.",
    "priceCents": 180000000,
    "imageUrl": "https://www.placehold.co/300x200.png?text=Nova%20Nebula",
    "manufacturer": "Kuat Drive Yards",
    "crewAmount": 8,
    "maxSpeed": "55 MGLT",
    "category": "Freighter",
    "stockQuantity": 7,
    "isActive": true
  },
  {
    "name": "Solar Seraphim Shuttle",
    "description": "Elegant shuttle for short-range diplomatic transport.",
    "priceCents": 95000000,
    "imageUrl": "https://www.placehold.co/300x200.png?text=Solar%20Seraphim",
    "manufacturer": "Sienar Fleet Systems",
    "crewAmount": 2,
    "maxSpeed": "70 MGLT",
    "category": "Shuttle",
    "stockQuantity": 15,
    "isActive": true
  },
  {
    "name": "Turbo Void Speeder",
    "description": "Lightweight speeder tuned for planetary surface runs.",
    "priceCents": 54000000,
    "imageUrl": "https://www.placehold.co/300x200.png?text=Turbo%20Void",
    "manufacturer": "Incom Corporation",
    "crewAmount": 1,
    "maxSpeed": "920 km/h (atmo)",
    "category": "Speeder",
    "stockQuantity": 22,
    "isActive": true
  },
  {
    "name": "Galactic Titan Cruiser",
    "description": "Medium cruiser with balanced armor and maneuverability.",
    "priceCents": 245000000,
    "imageUrl": "https://www.placehold.co/300x200.png?text=Galactic%20Titan",
    "manufacturer": "Mitsubishi Heavy Industries",
    "crewAmount": 12,
    "maxSpeed": "60 MGLT",
    "category": "Cruiser",
    "stockQuantity": 4,
    "isActive": true
  },
  {
    "name": "Prototype Phoenix Capital Ship",
    "description": "Experimental capital-class dreadnought. One of a kind.",
    "priceCents": 2400000000,
    "imageUrl": "https://www.placehold.co/300x200.png?text=Prometheus%20Phoenix",
    "manufacturer": "Bradford Starworks",
    "crewAmount": 2,
    "maxSpeed": "40 MGLT",
    "category": "Capital Ship",
    "stockQuantity": 1,
    "isActive": true
  },
  {
    "name": "Stealth Odyssey Interceptor",
    "description": "Cloaked interceptor for reconnaissance and hit-and-run.",
    "priceCents": 135000000,
    "imageUrl": "https://www.placehold.co/300x200.png?text=Stealth%20Odyssey",
    "manufacturer": "Northrop Grumman",
    "crewAmount": 1,
    "maxSpeed": "110 MGLT",
    "category": "Fighter",
    "stockQuantity": 6,
    "isActive": true
  },
  {
    "name": "Cryo Horizon Transport",
    "description": "Refrigerated cargo transport for sensitive biologics.",
    "priceCents": 115000000,
    "imageUrl": "https://www.placehold.co/300x200.png?text=Cryo%20Horizon",
    "manufacturer": "Weyland-Yutani",
    "crewAmount": 6,
    "maxSpeed": "48 MGLT",
    "category": "Freighter",
    "stockQuantity": 9,
    "isActive": true
  },
  {
    "name": "Neon Pioneer Courier",
    "description": "Fast short-haul courier favored by the Outer Rim postal service.",
    "priceCents": 62000000,
    "imageUrl": "https://www.placehold.co/300x200.png?text=Neon%20Pioneer",
    "manufacturer": "Quark Systems",
    "crewAmount": 2,
    "maxSpeed": "78 MGLT",
    "category": "Shuttle",
    "stockQuantity": 18,
    "isActive": true
  },
  {
    "name": "Mark III Vanguard Runner",
    "description": "Proven mid-weight runner with above-average agility.",
    "priceCents": 88000000,
    "imageUrl": "https://www.placehold.co/300x200.png?text=Mark%20III%20Vanguard",
    "manufacturer": "Argus Shipyards",
    "crewAmount": 3,
    "maxSpeed": "92 MGLT",
    "category": "Speeder",
    "stockQuantity": 10,
    "isActive": true
  },
  {
    "name": "Heavy Infinity Guardian",
    "description": "Armored cruiser configured for fleet escort duty.",
    "priceCents": 310000000,
    "imageUrl": "https://www.placehold.co/300x200.png?text=Heavy%20Infinity",
    "manufacturer": "Lockheed Martin",
    "crewAmount": 22,
    "maxSpeed": "50 MGLT",
    "category": "Cruiser",
    "stockQuantity": 3,
    "isActive": true
  },
  {
    "name": "Alpha Serenity",
    "description": "Compact fighter with exceptional thrust-to-mass ratio.",
    "priceCents": 120000000,
    "imageUrl": "https://www.placehold.co/300x200.png?text=Alpha%20Serenity",
    "manufacturer": "Covenant Industries",
    "crewAmount": 1,
    "maxSpeed": "105 MGLT",
    "category": "Fighter",
    "stockQuantity": 8,
    "isActive": true
  },
  {
    "name": "Omega Andromeda Hauler",
    "description": "Bulk hauler for asteroid-mining operations.",
    "priceCents": 198000000,
    "imageUrl": "https://www.placehold.co/300x200.png?text=Omega%20Andromeda",
    "manufacturer": "Raven Rock Assembly",
    "crewAmount": 14,
    "maxSpeed": "42 MGLT",
    "category": "Freighter",
    "stockQuantity": 5,
    "isActive": true
  },
  {
    "name": "Scout Eclipse Jumper",
    "description": "Nimble long-range scout with an oversized fuel tank.",
    "priceCents": 72000000,
    "imageUrl": "https://www.placehold.co/300x200.png?text=Scout%20Eclipse",
    "manufacturer": "Palladium Dynamics",
    "crewAmount": 2,
    "maxSpeed": "88 MGLT",
    "category": "Shuttle",
    "stockQuantity": 11,
    "isActive": true
  },
  {
    "name": "Hyperion Zenith Capital",
    "description": "Flagship capital ship for command-and-control operations.",
    "priceCents": 2150000000,
    "imageUrl": "https://www.placehold.co/300x200.png?text=Hyperion%20Zenith",
    "manufacturer": "Boeing Defense",
    "crewAmount": 350,
    "maxSpeed": "38 MGLT",
    "category": "Capital Ship",
    "stockQuantity": 2,
    "isActive": true
  }
]
```

- [ ] **Step 2: Delete the .gitkeep**

```bash
rm backend/data/.gitkeep
```

- [ ] **Step 3: No commit yet — combines with Task 18.**

---

## Task 18: Write cmd/seed/main.go (seeder)

**Files:**
- Create: `backend/cmd/seed/main.go`
- Modify: `backend/internal/catalog/queries.sql` (add `InsertProduct` and `TruncateProducts`)
- Regenerate: sqlc output
- Delete: `backend/cmd/seed/.gitkeep`

- [ ] **Step 1: Add `InsertProduct` and `TruncateProducts` to `backend/internal/catalog/queries.sql`**

Append to the end of the file:

```sql
-- name: InsertProduct :one
INSERT INTO products (
    name, description, price_cents, image_url,
    manufacturer, crew_amount, max_speed, category,
    stock_quantity, is_active
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
)
RETURNING id, name, description, price_cents, image_url,
    manufacturer, crew_amount, max_speed, category,
    stock_quantity, is_active, created_at, updated_at;

-- name: TruncateProducts :exec
TRUNCATE products;
```

- [ ] **Step 2: Regenerate sqlc**

```bash
make sqlc-generate
```

- [ ] **Step 3: Extend the `Repository` interface in `backend/internal/catalog/repository.go`**

Replace file with:

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
	Create(ctx context.Context, in CreateInput) (Product, error)
	DeleteAll(ctx context.Context) error
}

// CreateInput is the shape required to insert a new Product.
type CreateInput struct {
	Name          string
	Description   string
	PriceCents    int32
	ImageURL      *string
	Manufacturer  *string
	CrewAmount    *int32
	MaxSpeed      *string
	Category      Category
	StockQuantity int32
	IsActive      bool
}
```

- [ ] **Step 4: Extend `backend/internal/catalog/postgres.go` with `Create` and `DeleteAll`**

Append inside the file:

```go
func (p *Postgres) Create(ctx context.Context, in CreateInput) (Product, error) {
	row, err := p.q.InsertProduct(ctx, InsertProductParams{
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
	})
	if err != nil {
		return Product{}, fmt.Errorf("postgres: insert product: %w", err)
	}
	return insertRowToProduct(row), nil
}

func (p *Postgres) DeleteAll(ctx context.Context) error {
	if err := p.q.TruncateProducts(ctx); err != nil {
		return fmt.Errorf("postgres: truncate products: %w", err)
	}
	return nil
}

func insertRowToProduct(r InsertProductRow) Product {
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
		CreatedAt:     r.CreatedAt,
		UpdatedAt:     r.UpdatedAt,
	}
}
```

- [ ] **Step 5: Update the mock in `backend/internal/catalog/service_test.go`**

Add two fields and two methods to `mockRepo`:

```go
type mockRepo struct {
	getByIDFn    func(ctx context.Context, id uuid.UUID) (catalog.Product, error)
	listActiveFn func(ctx context.Context) ([]catalog.Product, error)
	createFn     func(ctx context.Context, in catalog.CreateInput) (catalog.Product, error)
	deleteAllFn  func(ctx context.Context) error
}

func (m mockRepo) Create(ctx context.Context, in catalog.CreateInput) (catalog.Product, error) {
	if m.createFn == nil {
		return catalog.Product{}, nil
	}
	return m.createFn(ctx, in)
}

func (m mockRepo) DeleteAll(ctx context.Context) error {
	if m.deleteAllFn == nil {
		return nil
	}
	return m.deleteAllFn(ctx)
}
```

- [ ] **Step 6: Implement `backend/cmd/seed/main.go`**

Full file:

```go
// Command seed populates or truncates the products table from backend/data/products.json.
// Usage:
//   go run ./cmd/seed            # INSERT all products from products.json
//   go run ./cmd/seed -d         # TRUNCATE products (destroy)
package main

import (
	"context"
	"encoding/json"
	"flag"
	"log"
	"os"
	"time"

	"github.com/z3tz3r0/ecommerce-space-craft/backend/internal/catalog"
	"github.com/z3tz3r0/ecommerce-space-craft/backend/internal/platform/config"
	"github.com/z3tz3r0/ecommerce-space-craft/backend/internal/platform/db"
)

type seedProduct struct {
	Name          string  `json:"name"`
	Description   string  `json:"description"`
	PriceCents    int32   `json:"priceCents"`
	ImageURL      *string `json:"imageUrl,omitempty"`
	Manufacturer  *string `json:"manufacturer,omitempty"`
	CrewAmount    *int32  `json:"crewAmount,omitempty"`
	MaxSpeed      *string `json:"maxSpeed,omitempty"`
	Category      string  `json:"category"`
	StockQuantity int32   `json:"stockQuantity"`
	IsActive      bool    `json:"isActive"`
}

func main() {
	destroy := flag.Bool("d", false, "truncate products instead of inserting")
	flag.Parse()

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	pool, err := db.New(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("db: %v", err)
	}
	defer pool.Close()

	repo := catalog.NewPostgres(pool)

	if *destroy {
		if err := repo.DeleteAll(ctx); err != nil {
			log.Fatalf("destroy: %v", err)
		}
		log.Println("truncated products")
		return
	}

	raw, err := os.ReadFile("data/products.json")
	if err != nil {
		log.Fatalf("read seed: %v", err)
	}

	var items []seedProduct
	if err := json.Unmarshal(raw, &items); err != nil {
		log.Fatalf("unmarshal seed: %v", err)
	}

	for _, it := range items {
		if _, err := repo.Create(ctx, catalog.CreateInput{
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
		}); err != nil {
			log.Fatalf("insert %s: %v", it.Name, err)
		}
	}
	log.Printf("seeded %d products", len(items))
}
```

- [ ] **Step 7: Build to verify**

```bash
cd backend && go build ./... && cd ..
```

Expected: exits 0.

- [ ] **Step 8: Run the seeder against Neon**

```bash
set -a && source backend/.env && set +a
make seed
```

Expected: `seeded 15 products`.

- [ ] **Step 9: Verify via the API**

```bash
cd backend && go run ./cmd/api &
sleep 2
curl -s http://localhost:8080/api/products | head -c 400
kill %1
cd ..
```

Expected: JSON array starting with `[{"id":"...","name":"Quantum StarHopper",...` and 15 entries total.

- [ ] **Step 10: Run tests to confirm nothing broke**

```bash
make test
```

Expected: PASS for all packages.

- [ ] **Step 11: Delete gitkeep and commit**

```bash
rm backend/cmd/seed/.gitkeep
git add backend/cmd/seed/ backend/data/ backend/internal/catalog/
git commit -m "feat(backend): add seed/destroy commands and InsertProduct query"
```

---

## Task 19: Regenerate openapi.json (includes the catalog endpoints)

**Files:**
- Modify: `backend/openapi.json`

- [ ] **Step 1: Regenerate**

```bash
make openapi-dump
```

- [ ] **Step 2: Verify it includes both catalog operations**

```bash
grep -o '"operationId":"[^"]*"' backend/openapi.json
```

Expected: `"operationId":"health"`, `"operationId":"listProducts"`, `"operationId":"getProduct"`.

- [ ] **Step 3: Commit**

```bash
git add backend/openapi.json
git commit -m "chore(backend): regenerate openapi.json with catalog routes"
```

---

## Task 20: Configure golangci-lint

**Files:**
- Create: `backend/.golangci.yml`

- [ ] **Step 1: Write `backend/.golangci.yml`**

Full file:

```yaml
run:
  timeout: 3m
  tests: true

linters:
  enable:
    - govet
    - errcheck
    - staticcheck
    - gosimple
    - ineffassign
    - unused
    - gofmt
    - goimports
    - misspell
    - unconvert
    - bodyclose
    - errorlint
  disable-all: false

issues:
  exclude-dirs:
    - internal/catalog  # skip sqlc-generated files (db.go, models.go, queries.sql.go)
  exclude-rules:
    - path: "_test\\.go$"
      linters:
        - errcheck
```

Note: the `exclude-dirs` rule is too broad (it excludes hand-written catalog files too). A stricter approach: exclude only the generated files by name. Update to:

```yaml
issues:
  exclude-files:
    - "internal/catalog/db.go"
    - "internal/catalog/models.go"
    - "internal/catalog/queries.sql.go"
  exclude-rules:
    - path: "_test\\.go$"
      linters:
        - errcheck
```

- [ ] **Step 2: Run golangci-lint**

```bash
make lint-backend
```

Expected: no issues reported. If any are reported, fix them before committing.

- [ ] **Step 3: Commit**

```bash
git add backend/.golangci.yml
git commit -m "chore(backend): add golangci-lint config"
```

---

## Task 21: Configure Lefthook (Go pre-commit only in 0a)

**Files:**
- Create: `lefthook.yml`
- Modify: `backend/go.mod` (add `x/tools/cmd/goimports` for fmt target — optional, skip if you already have it)

- [ ] **Step 1: Write `lefthook.yml` (repo root)**

Full file:

```yaml
pre-commit:
  parallel: true
  commands:
    go-fmt:
      glob: "backend/**/*.go"
      run: cd backend && gofmt -l {staged_files} | tee /dev/stderr | (! read)
    go-lint:
      glob: "backend/**/*.go"
      run: cd backend && golangci-lint run --new-from-rev=HEAD~ ./...
```

- [ ] **Step 2: Install lefthook hooks into .git/hooks**

```bash
lefthook install
```

Expected: `✔ install .git/hooks/pre-commit`.

- [ ] **Step 3: Test that pre-commit hook runs**

```bash
# Make a trivial formatting change to a Go file.
echo "// trivial" >> backend/cmd/api/main.go
git add backend/cmd/api/main.go
git commit -m "test: pre-commit"
```

Expected: if the file was badly formatted, the commit fails. If everything passes, the test commit succeeds. Either way, revert the trivial change:

```bash
git reset HEAD~1 --hard  # only if the trivial commit succeeded
# OR — if commit failed, just discard the change:
git checkout backend/cmd/api/main.go
```

- [ ] **Step 4: Commit lefthook config**

```bash
git add lefthook.yml
git commit -m "chore: add lefthook Go pre-commit hooks"
```

---

## Task 22: Write the GitHub Actions workflow for backend

**Files:**
- Create: `.github/workflows/backend.yml`

- [ ] **Step 1: Write `.github/workflows/backend.yml`**

Full file:

```yaml
name: backend

on:
  push:
    branches: [main]
    paths:
      - "backend/**"
      - "Makefile"
      - ".github/workflows/backend.yml"
  pull_request:
    paths:
      - "backend/**"
      - "Makefile"
      - ".github/workflows/backend.yml"

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version: "1.23"
          cache-dependency-path: backend/go.sum
      - name: gofmt
        run: |
          cd backend
          test -z "$(gofmt -l .)"
      - name: go vet
        run: cd backend && go vet ./...
      - uses: golangci/golangci-lint-action@v6
        with:
          version: v1.62.0
          working-directory: backend

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version: "1.23"
          cache-dependency-path: backend/go.sum
      - run: cd backend && go test ./... -race -count=1

  codegen-drift:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version: "1.23"
          cache-dependency-path: backend/go.sum
      - name: install sqlc
        run: go install github.com/sqlc-dev/sqlc/cmd/sqlc@latest
      - name: regenerate sqlc
        run: cd backend && sqlc generate
      - name: regenerate openapi
        run: cd backend && go run ./cmd/openapi > openapi.json
      - name: verify no drift
        run: git diff --exit-code -- backend/internal/catalog/db.go backend/internal/catalog/models.go backend/internal/catalog/queries.sql.go backend/openapi.json

  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version: "1.23"
          cache-dependency-path: backend/go.sum
      - run: cd backend && go build ./...
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/backend.yml
git commit -m "ci(backend): add lint, test, codegen-drift, and build workflows"
```

- [ ] **Step 3: Push and verify CI goes green**

```bash
git push origin main
gh run watch
```

Expected: All four jobs (lint, test, codegen-drift, build) pass. If any fail, fix inline and push new commits — do NOT use `--no-verify` or `--amend`.

---

## Task 23: Write the Dockerfile for Render

**Files:**
- Create: `backend/Dockerfile`

- [ ] **Step 1: Write `backend/Dockerfile`**

Full file (this is the ONLY version — write this verbatim):

```dockerfile
# syntax=docker/dockerfile:1.7

FROM golang:1.23-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
ENV CGO_ENABLED=0
RUN go build -trimpath -ldflags="-s -w" -o /out/api ./cmd/api

FROM golang:1.23-alpine AS goose
RUN go install github.com/pressly/goose/v3/cmd/goose@v3.22.0

# Runtime: distroless/base (includes /bin/sh — required for the chained entrypoint).
# distroless/static does NOT include /bin/sh, which is why we do not use it here.
FROM gcr.io/distroless/base-debian12:nonroot
WORKDIR /app
COPY --from=build /out/api /app/api
COPY --from=goose /go/bin/goose /usr/local/bin/goose
COPY migrations /app/migrations

# On boot: apply pending migrations, then exec the API binary.
ENTRYPOINT ["/bin/sh", "-c", "goose -dir migrations postgres \"$DATABASE_URL\" up && exec /app/api"]
```

- [ ] **Step 2: Build and run the image locally to verify**

```bash
cd backend
docker build -t spacecraft-api:phase0a .
docker run --rm -e DATABASE_URL="$DATABASE_URL" -p 8080:8080 spacecraft-api:phase0a &
sleep 4
curl -s http://localhost:8080/health
docker kill $(docker ps -q -f ancestor=spacecraft-api:phase0a) || true
cd ..
```

Expected: `{"status":"ok"}` and the goose log line indicating migrations are current.

- [ ] **Step 3: Commit**

```bash
git add backend/Dockerfile
git commit -m "feat(backend): add multi-stage Dockerfile with goose migrations on boot"
```

---

## Task 24: Deploy the backend to Render

**Files (documentation in README only — no code changes):**
- Modify: `README.md` (add deploy section)

- [ ] **Step 1: Create the Render Web Service**

Manual steps in the Render dashboard (https://dashboard.render.com):

1. **New +** → **Web Service** → connect the GitHub repo.
2. **Name:** `spacecraft-api` (or any subdomain you want).
3. **Root Directory:** `backend`
4. **Runtime:** `Docker`
5. **Dockerfile Path:** `Dockerfile`
6. **Branch:** `main` (auto-deploy on push)
7. **Region:** nearest to you
8. **Instance Type:** `Free`
9. **Health Check Path:** `/health`
10. **Environment Variables:**
    - `DATABASE_URL` — paste your Neon connection string
    - `CORS_ORIGINS` — `http://localhost:5173` for now (will add Vercel URL in Plan 0b)
    - `LOG_LEVEL` — `info`
    - `ENVIRONMENT` — `prod`
    - `PORT` — leave unset (Render provides it)

11. Click **Create Web Service**. First build takes ~3–5 minutes.

- [ ] **Step 2: Verify the live deployment**

Once Render reports "Live", note the public URL (e.g., `https://spacecraft-api-xxxx.onrender.com`).

```bash
curl -s https://spacecraft-api-xxxx.onrender.com/health
curl -s https://spacecraft-api-xxxx.onrender.com/api/products | head -c 400
```

Expected: `{"status":"ok"}` and a JSON array of 15 seeded products.

- [ ] **Step 3: Add a "Deploy" section to the root README.md**

Append:

```markdown
## Deployment

### Backend (Render)

Production URL: `<PASTE YOUR URL HERE>`

Deploys automatically from `main`. Configuration:
- Root directory: `backend/`
- Runtime: Docker
- Health check path: `/health`
- Required env vars: `DATABASE_URL`, `CORS_ORIGINS`, `LOG_LEVEL`, `ENVIRONMENT`
- `PORT` is injected by Render
- Migrations run on container boot via the Dockerfile entrypoint (`goose up && exec /app/api`)
```

Replace `<PASTE YOUR URL HERE>` with the actual URL.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: document backend Render deployment URL and env vars"
git push origin main
```

---

## Phase 0a acceptance criteria (final review)

Verify every item before declaring 0a done:

- [ ] Local: `make install && make migrate-up && make seed && make dev` brings up a Go server on `:8080` against Neon.
- [ ] Local: `curl localhost:8080/health` returns `{"status":"ok"}`.
- [ ] Local: `curl localhost:8080/api/products` returns 15 seeded products.
- [ ] Local: `curl localhost:8080/api/products/<uuid>` returns one product (use an ID from the list endpoint).
- [ ] Local: `curl localhost:8080/api/products/not-a-uuid` returns HTTP 400.
- [ ] Local: `make sqlc-generate && git diff --exit-code` reports no drift.
- [ ] Local: `make openapi-dump && git diff --exit-code` reports no drift.
- [ ] Local: `make test` passes with at least config, catalog/service, and platform/server/health tests.
- [ ] Local: `make lint-backend` passes.
- [ ] Lefthook pre-commit runs on `git commit`.
- [ ] GitHub Actions `backend.yml` green on `main` (all four jobs: lint, test, codegen-drift, build).
- [ ] Render: `https://<render-url>/health` returns `{"status":"ok"}` from production.
- [ ] Render: `https://<render-url>/api/products` returns the same 15 seeded products.
- [ ] Render: `https://<render-url>/openapi.json` returns the OpenAPI spec.
- [ ] README documents the Render URL and env vars.

When all boxes are ticked, Plan 0a is done. Plan 0b (frontend) starts next.

---

## Notes for Plan 0b (written after 0a ships)

Plan 0b will:
1. Consume `backend/openapi.json` via `openapi-typescript` to generate a typed frontend client.
2. Scaffold the frontend with FSD layers (`app`, `pages`, `widgets`, `features`, `entities`, `shared`).
3. Render `HomePage` = "Loaded N products" using `useProducts()` against the live Render backend.
4. Extend the root `Makefile` with frontend targets.
5. Extend `lefthook.yml` with Biome + steiger checks.
6. Add `.github/workflows/frontend.yml`.
7. Deploy to Vercel.
8. Update `CORS_ORIGINS` on Render to include the Vercel URL.
