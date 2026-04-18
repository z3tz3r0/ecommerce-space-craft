# Phase 2a — Identity & Cart Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship email+password auth (scs cookie sessions, argon2id) plus per-user server cart as two new DDD-lite slices under `backend/internal/`, with 10 new endpoints and the regenerated OpenAPI committed.

**Architecture:** Two new vertical slices (`internal/auth/`, `internal/cart/`) modelled on the existing `internal/catalog/` shape (`domain.go` / `service.go` / `repository.go` / `postgres.go` / `queries.sql` / `db/` sqlc output / `handler.go` / `*_test.go`). A new `internal/platform/session/` package owns the scs `SessionManager` with the `pgxstore` adapter so session state lives in the existing Neon pool. Auth and cart handlers share a `RequireAuth` middleware that reads `userID` off the session context. Two new migrations add `users`, `sessions` (scs schema), and `cart_items` (keyed on `(user_id, product_id)`).

**Tech Stack:**
- `github.com/alexedwards/scs/v2` — session middleware
- `github.com/alexedwards/scs/pgxstore` — Postgres session store (reuses existing `pgxpool.Pool`)
- `github.com/alexedwards/argon2id` — argon2id password hashing
- `github.com/danielgtaylor/huma/v2` — existing API framework
- `github.com/jackc/pgx/v5` — existing pgx driver
- `sqlc` v1.30 — existing codegen
- `goose` — existing migration runner
- Neon Postgres (existing) for users, sessions, and cart_items tables

---

## File structure (end state)

```
backend/
├── go.mod                                  (+3 direct deps)
├── sqlc.yaml                               (add auth + cart blocks)
├── migrations/
│   ├── 20260418130000_create_users.sql                 NEW
│   └── 20260418130100_create_sessions_and_cart.sql     NEW
├── cmd/
│   ├── api/main.go                         MODIFY — wire session.Manager, auth.Register, cart.Register
│   └── openapi/main.go                     MODIFY — register auth + cart with nop repos
├── internal/
│   ├── catalog/                            (unchanged)
│   ├── platform/
│   │   ├── config/config.go                MODIFY — no new vars; reuse ENVIRONMENT to toggle Secure cookie
│   │   ├── db/db.go                        (unchanged)
│   │   ├── logging/…                       (unchanged)
│   │   ├── server/server.go                (unchanged)
│   │   └── session/session.go              NEW — scs.Manager factory
│   ├── auth/                               NEW SLICE
│   │   ├── domain.go                       — User, sentinel errors
│   │   ├── errors.go                       — mapError for Huma
│   │   ├── hasher.go                       — argon2id wrapper (params centralized)
│   │   ├── repository.go                   — Repository interface
│   │   ├── postgres.go                     — Postgres implementation
│   │   ├── queries.sql                     — sqlc source
│   │   ├── db/                             — sqlc-generated
│   │   │   ├── db.go
│   │   │   ├── models.go
│   │   │   └── queries.sql.go
│   │   ├── service.go                      — Signup, Login, GetByID
│   │   ├── service_test.go
│   │   ├── middleware.go                   — RequireAuth (reads session, looks up user)
│   │   ├── handler.go                      — 4 Huma operations
│   │   └── handler_test.go                 — httptest integration of the 4 endpoints
│   └── cart/                               NEW SLICE
│       ├── domain.go                       — Item, Cart, sentinel errors
│       ├── errors.go                       — mapError for Huma
│       ├── repository.go                   — Repository interface
│       ├── postgres.go                     — Postgres implementation
│       ├── queries.sql                     — sqlc source
│       ├── db/                             — sqlc-generated
│       │   ├── db.go
│       │   ├── models.go
│       │   └── queries.sql.go
│       ├── service.go                      — Get, Add, Set, Remove, Merge
│       ├── service_test.go
│       ├── handler.go                      — 5 Huma operations
│       └── handler_test.go                 — httptest integration of cart endpoints with session
└── openapi.json                            MODIFY — regenerated
```

**Branch:** `phase-2a/identity-cart-backend` (created in Task 1).

---

## Task 1 — Branch, dependencies, migrations, sqlc config

**Files:**
- Create: `backend/migrations/20260418130000_create_users.sql`
- Create: `backend/migrations/20260418130100_create_sessions_and_cart.sql`
- Modify: `backend/go.mod`, `backend/go.sum`
- Modify: `backend/sqlc.yaml`

---

- [ ] **Step 1: Create and check out the feature branch from latest `main`**

```bash
cd /home/z3tz3r0/Projects/ecommerce-space-craft
git checkout main
git pull --ff-only origin main
git checkout -b phase-2a/identity-cart-backend
```

- [ ] **Step 2: Add the three runtime dependencies**

Run from `backend/`:

```bash
cd backend
go get github.com/alexedwards/scs/v2@latest
go get github.com/alexedwards/scs/pgxstore@latest
go get github.com/alexedwards/argon2id@latest
go mod tidy
```

Expected: three new `require` lines land in `go.mod` and `go.sum` picks up the transitive closure. Verify with `go build ./...` — should compile with zero code changes because the deps aren't imported yet.

- [ ] **Step 3: Create the users migration**

Write `backend/migrations/20260418130000_create_users.sql`:

```sql
-- +goose Up
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE users (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    email           citext      UNIQUE NOT NULL,
    password_hash   text        NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

-- +goose Down
DROP TABLE users;
```

- [ ] **Step 4: Create the sessions + cart_items migration**

Write `backend/migrations/20260418130100_create_sessions_and_cart.sql`:

```sql
-- +goose Up
CREATE TABLE sessions (
    token   text        PRIMARY KEY,
    data    bytea       NOT NULL,
    expiry  timestamptz NOT NULL
);
CREATE INDEX sessions_expiry_idx ON sessions (expiry);

CREATE TABLE cart_items (
    user_id       uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id    uuid        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity      integer     NOT NULL CHECK (quantity > 0),
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, product_id)
);

-- +goose Down
DROP TABLE cart_items;
DROP TABLE sessions;
```

- [ ] **Step 5: Run the migrations against a local Postgres to confirm they apply cleanly**

If a local Postgres is running with the app DB URL exported, run:

```bash
cd backend
goose -dir migrations postgres "$DATABASE_URL" up
goose -dir migrations postgres "$DATABASE_URL" status
```

Expected: both new migrations show `Applied`. Then roll back once to confirm Down works, then re-apply:

```bash
goose -dir migrations postgres "$DATABASE_URL" down
goose -dir migrations postgres "$DATABASE_URL" down
goose -dir migrations postgres "$DATABASE_URL" up
```

If no local Postgres is available, skip this step — Task 8's Render deploy verifies the migrations run against Neon.

- [ ] **Step 6: Expand `sqlc.yaml` to emit auth and cart generated code into separate packages**

Replace the entire `backend/sqlc.yaml` with this (the `catalog` block is unchanged except for being listed as the first element of the `sql` array):

```yaml
version: "2"
sql:
  - engine: postgresql
    queries: internal/catalog/queries.sql
    schema: migrations
    gen:
      go:
        package: catalogdb
        out: internal/catalog/db
        sql_package: pgx/v5
        emit_pointers_for_null_types: true
        emit_json_tags: false
        emit_prepared_queries: false
        overrides:
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
          - db_type: "timestamptz"
            go_type:
              import: "time"
              type: "Time"
  - engine: postgresql
    queries: internal/auth/queries.sql
    schema: migrations
    gen:
      go:
        package: authdb
        out: internal/auth/db
        sql_package: pgx/v5
        emit_pointers_for_null_types: true
        emit_json_tags: false
        emit_prepared_queries: false
        overrides:
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
          - db_type: "timestamptz"
            go_type:
              import: "time"
              type: "Time"
          - db_type: "citext"
            go_type:
              type: "string"
  - engine: postgresql
    queries: internal/cart/queries.sql
    schema: migrations
    gen:
      go:
        package: cartdb
        out: internal/cart/db
        sql_package: pgx/v5
        emit_pointers_for_null_types: true
        emit_json_tags: false
        emit_prepared_queries: false
        overrides:
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
          - db_type: "timestamptz"
            go_type:
              import: "time"
              type: "Time"
```

The `citext` override tells sqlc to treat the `users.email` column as a plain Go `string`. This keeps domain code free of any sqlc-specific type wrapper.

- [ ] **Step 7: Commit**

```bash
cd /home/z3tz3r0/Projects/ecommerce-space-craft
git add backend/go.mod backend/go.sum backend/migrations/20260418130000_create_users.sql backend/migrations/20260418130100_create_sessions_and_cart.sql backend/sqlc.yaml
git commit -m "chore(backend): add scs/argon2id deps + users/sessions/cart_items migrations"
```

---

## Task 2 — `internal/platform/session/` package

**Files:**
- Create: `backend/internal/platform/session/session.go`
- Modify: `backend/internal/platform/config/config.go` (add `cfg.Environment == "production"` helper if not already addressable; reuse existing `Environment` field)

---

- [ ] **Step 1: Write the session package**

Create `backend/internal/platform/session/session.go`:

```go
// Package session wires the HTTP session manager used for cookie-based auth.
//
// The manager wraps alexedwards/scs with a pgxstore adapter so session state
// lives in the existing Neon Postgres pool — no additional services required.
package session

import (
	"net/http"
	"time"

	"github.com/alexedwards/scs/pgxstore"
	"github.com/alexedwards/scs/v2"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Manager is a thin alias so callers depend on `session.Manager` rather than
// the scs type directly.
type Manager = *scs.SessionManager

// New returns a configured scs.SessionManager backed by pgxstore.
//
// `secureCookie` toggles the Secure flag on the session cookie: true in
// production (HTTPS), false in local dev against Vite's http://localhost:5173.
func New(pool *pgxpool.Pool, secureCookie bool) Manager {
	s := scs.New()
	s.Store = pgxstore.New(pool)
	s.Lifetime = 30 * 24 * time.Hour    // 30-day absolute session lifetime
	s.IdleTimeout = 7 * 24 * time.Hour  // 7-day inactivity window (rolling)
	s.Cookie.Name = "session"
	s.Cookie.Path = "/"
	s.Cookie.HttpOnly = true
	s.Cookie.Secure = secureCookie
	s.Cookie.SameSite = http.SameSiteLaxMode
	return s
}
```

- [ ] **Step 2: Confirm it compiles**

```bash
cd backend
go build ./internal/platform/session/
```

Expected: no output (success).

- [ ] **Step 3: Commit**

```bash
git add backend/internal/platform/session/session.go
git commit -m "feat(backend): add platform/session package wrapping scs with pgxstore"
```

---

## Task 3 — Auth slice: domain, repository, sqlc, postgres, hasher

**Files:**
- Create: `backend/internal/auth/domain.go`
- Create: `backend/internal/auth/hasher.go`
- Create: `backend/internal/auth/repository.go`
- Create: `backend/internal/auth/postgres.go`
- Create: `backend/internal/auth/queries.sql`
- Create (via sqlc): `backend/internal/auth/db/db.go`, `models.go`, `queries.sql.go`

---

- [ ] **Step 1: Write the auth domain types**

Create `backend/internal/auth/domain.go`:

```go
// Package auth is the identity bounded context. It owns users, password
// hashing, and login/signup flows. Session cookies are owned by the platform
// session package; this context stores the authenticated userID value.
package auth

import (
	"errors"
	"time"

	"github.com/google/uuid"
)

// User is the public-facing user representation. PasswordHash is
// intentionally absent — it never leaves the repository layer.
type User struct {
	ID        uuid.UUID `json:"id"`
	Email     string    `json:"email"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// Sentinel errors exposed by the auth context.
var (
	ErrInvalidCredentials = errors.New("invalid email or password")
	ErrEmailTaken         = errors.New("email already registered")
	ErrWeakPassword       = errors.New("password must be at least 8 characters")
	ErrUserNotFound       = errors.New("user not found")
	ErrNotAuthenticated   = errors.New("not authenticated")
)

// MinPasswordLength is the minimum acceptable password length per the spec.
const MinPasswordLength = 8
```

- [ ] **Step 2: Write the argon2id wrapper**

Create `backend/internal/auth/hasher.go`:

```go
package auth

import "github.com/alexedwards/argon2id"

// hashParams are the argon2id parameters used for every password.
//
// 64 MB memory / 1 iteration / 2 parallelism balances OWASP recommendations
// against Render's free-tier CPU budget. Params are embedded into each
// produced hash string, so upgrading these values later still validates
// existing hashes against their stored params.
var hashParams = &argon2id.Params{
	Memory:      64 * 1024, // 64 MB
	Iterations:  1,
	Parallelism: 2,
	SaltLength:  16,
	KeyLength:   32,
}

// hashPassword produces an argon2id encoded hash string.
func hashPassword(plaintext string) (string, error) {
	return argon2id.CreateHash(plaintext, hashParams)
}

// verifyPassword reports whether the plaintext matches the stored hash. The
// comparison is constant-time.
func verifyPassword(plaintext, encodedHash string) (bool, error) {
	return argon2id.ComparePasswordAndHash(plaintext, encodedHash)
}
```

- [ ] **Step 3: Write the sqlc queries**

Create `backend/internal/auth/queries.sql`:

```sql
-- name: CreateUser :one
INSERT INTO users (email, password_hash)
VALUES ($1, $2)
RETURNING id, email, password_hash, created_at, updated_at;

-- name: GetUserByEmail :one
SELECT id, email, password_hash, created_at, updated_at
FROM users
WHERE email = $1;

-- name: GetUserByID :one
SELECT id, email, password_hash, created_at, updated_at
FROM users
WHERE id = $1;
```

- [ ] **Step 4: Run sqlc to generate the db package**

```bash
cd backend
sqlc generate
```

Expected: three files land under `backend/internal/auth/db/`: `db.go`, `models.go`, `queries.sql.go`. Verify the `User` model has fields `ID`, `Email`, `PasswordHash`, `CreatedAt`, `UpdatedAt`.

- [ ] **Step 5: Write the Repository interface**

Create `backend/internal/auth/repository.go`:

```go
package auth

import (
	"context"
	"time"

	"github.com/google/uuid"
)

// userRecord is the repository-layer representation that includes the
// password hash. It does not leave the auth package.
type userRecord struct {
	ID           uuid.UUID
	Email        string
	PasswordHash string
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

// Repository is the storage-facing interface the auth Service depends on.
// Implementations must be safe for concurrent use.
type Repository interface {
	CreateUser(ctx context.Context, email, passwordHash string) (userRecord, error)
	GetUserByEmail(ctx context.Context, email string) (userRecord, error)
	GetUserByID(ctx context.Context, id uuid.UUID) (userRecord, error)
}
```

- [ ] **Step 6: Write the Postgres implementation**

Create `backend/internal/auth/postgres.go`:

```go
package auth

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	authdb "github.com/z3tz3r0/ecommerce-space-craft/backend/internal/auth/db"
)

// Postgres is the pgx/sqlc-backed implementation of Repository.
type Postgres struct {
	q *authdb.Queries
}

// NewPostgres wraps a pgxpool.Pool with the sqlc-generated Queries.
func NewPostgres(pool *pgxpool.Pool) *Postgres {
	return &Postgres{q: authdb.New(pool)}
}

// CreateUser inserts a new user and returns the stored record. A unique
// constraint violation on email maps to ErrEmailTaken.
func (p *Postgres) CreateUser(ctx context.Context, email, passwordHash string) (userRecord, error) {
	row, err := p.q.CreateUser(ctx, authdb.CreateUserParams{
		Email:        strings.ToLower(strings.TrimSpace(email)),
		PasswordHash: passwordHash,
	})
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return userRecord{}, ErrEmailTaken
		}
		return userRecord{}, fmt.Errorf("postgres: create user: %w", err)
	}
	return userRecord{
		ID:           row.ID,
		Email:        row.Email,
		PasswordHash: row.PasswordHash,
		CreatedAt:    row.CreatedAt,
		UpdatedAt:    row.UpdatedAt,
	}, nil
}

// GetUserByEmail returns the stored user record for the given email
// (case-insensitive via citext), or ErrUserNotFound if none exists.
func (p *Postgres) GetUserByEmail(ctx context.Context, email string) (userRecord, error) {
	row, err := p.q.GetUserByEmail(ctx, strings.ToLower(strings.TrimSpace(email)))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return userRecord{}, ErrUserNotFound
		}
		return userRecord{}, fmt.Errorf("postgres: get user by email: %w", err)
	}
	return userRecord{
		ID:           row.ID,
		Email:        row.Email,
		PasswordHash: row.PasswordHash,
		CreatedAt:    row.CreatedAt,
		UpdatedAt:    row.UpdatedAt,
	}, nil
}

// GetUserByID returns the stored user record for the given UUID, or
// ErrUserNotFound if none exists.
func (p *Postgres) GetUserByID(ctx context.Context, id uuid.UUID) (userRecord, error) {
	row, err := p.q.GetUserByID(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return userRecord{}, ErrUserNotFound
		}
		return userRecord{}, fmt.Errorf("postgres: get user by id: %w", err)
	}
	return userRecord{
		ID:           row.ID,
		Email:        row.Email,
		PasswordHash: row.PasswordHash,
		CreatedAt:    row.CreatedAt,
		UpdatedAt:    row.UpdatedAt,
	}, nil
}
```

- [ ] **Step 7: Confirm the slice compiles so far**

```bash
cd backend
go build ./internal/auth/...
```

Expected: no output.

- [ ] **Step 8: Commit**

```bash
git add backend/internal/auth/domain.go backend/internal/auth/hasher.go backend/internal/auth/repository.go backend/internal/auth/postgres.go backend/internal/auth/queries.sql backend/internal/auth/db/
git commit -m "feat(backend): add auth slice domain + repository + postgres + sqlc"
```

---

## Task 4 — Auth slice: service + service tests

**Files:**
- Create: `backend/internal/auth/service.go`
- Create: `backend/internal/auth/service_test.go`

---

- [ ] **Step 1: Write the auth service with exported test helpers**

Create `backend/internal/auth/service.go`:

```go
package auth

import (
	"context"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
)

// Service holds business logic for the auth bounded context.
type Service struct {
	repo Repository
}

// NewService constructs a Service wrapping the given Repository.
func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

// Signup creates a new user with the given email and password. The password
// is hashed with argon2id. Returns ErrWeakPassword if the password is too
// short, ErrEmailTaken if the email is already registered.
func (s *Service) Signup(ctx context.Context, email, password string) (User, error) {
	if len(password) < MinPasswordLength {
		return User{}, ErrWeakPassword
	}
	normalisedEmail := strings.ToLower(strings.TrimSpace(email))
	hash, err := hashPassword(password)
	if err != nil {
		return User{}, fmt.Errorf("auth: hash password: %w", err)
	}
	rec, err := s.repo.CreateUser(ctx, normalisedEmail, hash)
	if err != nil {
		return User{}, err
	}
	return User{
		ID:        rec.ID,
		Email:     rec.Email,
		CreatedAt: rec.CreatedAt,
		UpdatedAt: rec.UpdatedAt,
	}, nil
}

// Login verifies the email/password combination. It returns
// ErrInvalidCredentials for both unknown emails and wrong passwords to
// prevent user enumeration.
func (s *Service) Login(ctx context.Context, email, password string) (User, error) {
	rec, err := s.repo.GetUserByEmail(ctx, strings.ToLower(strings.TrimSpace(email)))
	if err != nil {
		// Collapse ErrUserNotFound and any other lookup failure into
		// ErrInvalidCredentials — the client must not be able to tell
		// whether the email was known.
		return User{}, ErrInvalidCredentials
	}
	ok, err := verifyPassword(password, rec.PasswordHash)
	if err != nil {
		return User{}, fmt.Errorf("auth: verify password: %w", err)
	}
	if !ok {
		return User{}, ErrInvalidCredentials
	}
	return User{
		ID:        rec.ID,
		Email:     rec.Email,
		CreatedAt: rec.CreatedAt,
		UpdatedAt: rec.UpdatedAt,
	}, nil
}

// GetByID returns the user with the given UUID.
func (s *Service) GetByID(ctx context.Context, id uuid.UUID) (User, error) {
	rec, err := s.repo.GetUserByID(ctx, id)
	if err != nil {
		return User{}, fmt.Errorf("auth: get user by id: %w", err)
	}
	return User{
		ID:        rec.ID,
		Email:     rec.Email,
		CreatedAt: rec.CreatedAt,
		UpdatedAt: rec.UpdatedAt,
	}, nil
}

// --- test-only helpers -------------------------------------------------
// Exported so *_test.go files can construct fakes without touching the
// package-private Repository / userRecord types. The *testing.T parameter
// on NewServiceFake prevents misuse from non-test code.

// FakeRecord mirrors the private userRecord shape for test construction.
type FakeRecord struct {
	ID           uuid.UUID
	Email        string
	PasswordHash string
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

// FakeRepoAdapter lets tests supply behavior for each Repository method.
// Any unset callback falls back to a sensible default (typically
// ErrUserNotFound so tests can omit methods they don't exercise).
type FakeRepoAdapter struct {
	Create     func(ctx context.Context, email, hash string) (FakeRecord, error)
	GetByEmail func(ctx context.Context, email string) (FakeRecord, error)
	GetByID    func(ctx context.Context, id uuid.UUID) (FakeRecord, error)
}

// NewServiceFake builds a Service backed by an in-memory fake repository.
// Pass nil for *testing.T from code that only needs spec registration
// (e.g. cmd/openapi). Production code must never call this.
func NewServiceFake(_ *testing.T, a FakeRepoAdapter) *Service {
	return NewService(fakeRepoImpl{a: a})
}

type fakeRepoImpl struct{ a FakeRepoAdapter }

func (f fakeRepoImpl) CreateUser(ctx context.Context, email, hash string) (userRecord, error) {
	if f.a.Create == nil {
		return userRecord{}, fmt.Errorf("fake: Create not configured")
	}
	r, err := f.a.Create(ctx, email, hash)
	return toUserRecordFromFake(r), err
}

func (f fakeRepoImpl) GetUserByEmail(ctx context.Context, email string) (userRecord, error) {
	if f.a.GetByEmail == nil {
		return userRecord{}, ErrUserNotFound
	}
	r, err := f.a.GetByEmail(ctx, email)
	return toUserRecordFromFake(r), err
}

func (f fakeRepoImpl) GetUserByID(ctx context.Context, id uuid.UUID) (userRecord, error) {
	if f.a.GetByID == nil {
		return userRecord{}, ErrUserNotFound
	}
	r, err := f.a.GetByID(ctx, id)
	return toUserRecordFromFake(r), err
}

func toUserRecordFromFake(r FakeRecord) userRecord {
	return userRecord{
		ID:           r.ID,
		Email:        r.Email,
		PasswordHash: r.PasswordHash,
		CreatedAt:    r.CreatedAt,
		UpdatedAt:    r.UpdatedAt,
	}
}
```

- [ ] **Step 2: Write the service tests**

Create `backend/internal/auth/service_test.go`:

```go
package auth_test

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/alexedwards/argon2id"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"

	"github.com/z3tz3r0/ecommerce-space-craft/backend/internal/auth"
)

func validHash(t *testing.T) string {
	t.Helper()
	h, err := argon2id.CreateHash("hunter2!!", &argon2id.Params{
		Memory: 32 * 1024, Iterations: 1, Parallelism: 1, SaltLength: 8, KeyLength: 16,
	})
	require.NoError(t, err)
	return h
}

func TestService_Signup_WeakPassword_Returns_ErrWeakPassword(t *testing.T) {
	svc := auth.NewServiceFake(t, auth.FakeRepoAdapter{})
	_, err := svc.Signup(context.Background(), "a@b.com", "short")
	require.ErrorIs(t, err, auth.ErrWeakPassword)
}

func TestService_Signup_EmailTaken_Returns_ErrEmailTaken(t *testing.T) {
	svc := auth.NewServiceFake(t, auth.FakeRepoAdapter{
		Create: func(_ context.Context, _, _ string) (auth.FakeRecord, error) {
			return auth.FakeRecord{}, auth.ErrEmailTaken
		},
	})
	_, err := svc.Signup(context.Background(), "a@b.com", "hunter2!!")
	require.ErrorIs(t, err, auth.ErrEmailTaken)
}

func TestService_Signup_Success_ReturnsUserAndHashesPassword(t *testing.T) {
	uid := uuid.New()
	now := time.Now()
	var observedHash string
	adapter := auth.FakeRepoAdapter{
		Create: func(_ context.Context, email, hash string) (auth.FakeRecord, error) {
			observedHash = hash
			return auth.FakeRecord{ID: uid, Email: email, PasswordHash: hash, CreatedAt: now, UpdatedAt: now}, nil
		},
	}
	svc := auth.NewServiceFake(t, adapter)

	user, err := svc.Signup(context.Background(), "A@B.com", "hunter2!!")
	require.NoError(t, err)
	require.Equal(t, uid, user.ID)
	require.Equal(t, "a@b.com", user.Email)
	require.NotEmpty(t, observedHash)
	require.True(t, strings.HasPrefix(observedHash, "$argon2id$"))
}

func TestService_Login_UnknownEmail_Returns_ErrInvalidCredentials(t *testing.T) {
	svc := auth.NewServiceFake(t, auth.FakeRepoAdapter{
		GetByEmail: func(_ context.Context, _ string) (auth.FakeRecord, error) {
			return auth.FakeRecord{}, auth.ErrUserNotFound
		},
	})
	_, err := svc.Login(context.Background(), "nobody@x.com", "hunter2!!")
	require.ErrorIs(t, err, auth.ErrInvalidCredentials)
}

func TestService_Login_WrongPassword_Returns_ErrInvalidCredentials(t *testing.T) {
	uid := uuid.New()
	now := time.Now()
	svc := auth.NewServiceFake(t, auth.FakeRepoAdapter{
		GetByEmail: func(_ context.Context, _ string) (auth.FakeRecord, error) {
			return auth.FakeRecord{ID: uid, Email: "a@b.com", PasswordHash: validHash(t), CreatedAt: now, UpdatedAt: now}, nil
		},
	})
	_, err := svc.Login(context.Background(), "a@b.com", "wrong-password")
	require.ErrorIs(t, err, auth.ErrInvalidCredentials)
}

func TestService_Login_CorrectPassword_ReturnsUser(t *testing.T) {
	uid := uuid.New()
	now := time.Now()
	hash := validHash(t)
	svc := auth.NewServiceFake(t, auth.FakeRepoAdapter{
		GetByEmail: func(_ context.Context, email string) (auth.FakeRecord, error) {
			return auth.FakeRecord{ID: uid, Email: email, PasswordHash: hash, CreatedAt: now, UpdatedAt: now}, nil
		},
	})
	user, err := svc.Login(context.Background(), "a@b.com", "hunter2!!")
	require.NoError(t, err)
	require.Equal(t, uid, user.ID)
}

func TestService_GetByID_UnknownUser_WrapsErr(t *testing.T) {
	svc := auth.NewServiceFake(t, auth.FakeRepoAdapter{
		GetByID: func(_ context.Context, _ uuid.UUID) (auth.FakeRecord, error) {
			return auth.FakeRecord{}, auth.ErrUserNotFound
		},
	})
	_, err := svc.GetByID(context.Background(), uuid.New())
	require.ErrorIs(t, err, auth.ErrUserNotFound)
}

func TestService_GetByID_RepoOtherError_PropagatesWrapped(t *testing.T) {
	boom := errors.New("db exploded")
	svc := auth.NewServiceFake(t, auth.FakeRepoAdapter{
		GetByID: func(_ context.Context, _ uuid.UUID) (auth.FakeRecord, error) {
			return auth.FakeRecord{}, boom
		},
	})
	_, err := svc.GetByID(context.Background(), uuid.New())
	require.Error(t, err)
	require.NotErrorIs(t, err, auth.ErrUserNotFound)
}
```

- [ ] **Step 3: Run the tests**

```bash
cd backend
go test ./internal/auth/... -count=1
```

Expected: all eight tests pass. (Signup hashing test is the slowest — ~50-100 ms.)

- [ ] **Step 4: Commit**

```bash
git add backend/internal/auth/service.go backend/internal/auth/service_test.go
git commit -m "feat(backend): add auth service + tests (signup/login/getByID)"
```

---

## Task 5 — Auth slice: handler, middleware, error mapping, wiring

**Files:**
- Create: `backend/internal/auth/errors.go`
- Create: `backend/internal/auth/handler.go`
- Create: `backend/internal/auth/middleware.go`
- Create: `backend/internal/auth/handler_test.go`
- Modify: `backend/cmd/api/main.go`

---

- [ ] **Step 1: Write the error mapper**

Create `backend/internal/auth/errors.go`:

```go
package auth

import (
	"errors"
	"log/slog"

	"github.com/danielgtaylor/huma/v2"
)

// mapError converts a domain error into a Huma-compatible error response.
// Unknown errors are logged and returned as 500.
func mapError(logger *slog.Logger, err error) error {
	switch {
	case errors.Is(err, ErrInvalidCredentials):
		return huma.Error401Unauthorized("invalid email or password")
	case errors.Is(err, ErrEmailTaken):
		return huma.Error409Conflict("email already registered")
	case errors.Is(err, ErrWeakPassword):
		return huma.Error400BadRequest("password must be at least 8 characters")
	case errors.Is(err, ErrNotAuthenticated):
		return huma.Error401Unauthorized("not authenticated")
	case errors.Is(err, ErrUserNotFound):
		return huma.Error404NotFound("user not found")
	default:
		logger.Error("auth: unexpected error", "err", err.Error())
		return huma.Error500InternalServerError("internal error")
	}
}
```

- [ ] **Step 2: Write the RequireAuth middleware**

Create `backend/internal/auth/middleware.go`:

```go
package auth

import (
	"context"
	"log/slog"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"

	"github.com/z3tz3r0/ecommerce-space-craft/backend/internal/platform/session"
)

// userIDKey is the scs session key holding the authenticated user's UUID
// (string-encoded).
const userIDKey = "userID"

// contextKey is the per-request context.Value key for the authenticated User.
type contextKey struct{}

// CurrentUser retrieves the User that RequireAuth attached to the request
// context. Panics if the middleware did not run — callers must only use
// this inside routes registered behind RequireAuth.
func CurrentUser(ctx context.Context) User {
	u, ok := ctx.Value(contextKey{}).(User)
	if !ok {
		panic("auth: CurrentUser called outside RequireAuth-protected handler")
	}
	return u
}

// RequireAuth returns a Huma middleware that rejects unauthenticated
// requests with 401 and attaches the authenticated User to the downstream
// context on success.
func RequireAuth(api huma.API, sess session.Manager, svc *Service, logger *slog.Logger) func(huma.Context, func(huma.Context)) {
	return func(ctx huma.Context, next func(huma.Context)) {
		idStr := sess.GetString(ctx.Context(), userIDKey)
		if idStr == "" {
			_ = huma.WriteErr(api, ctx, http.StatusUnauthorized, "not authenticated")
			return
		}
		uid, err := uuid.Parse(idStr)
		if err != nil {
			logger.Warn("auth: malformed session userID", "value", idStr)
			_ = huma.WriteErr(api, ctx, http.StatusUnauthorized, "not authenticated")
			return
		}
		user, err := svc.GetByID(ctx.Context(), uid)
		if err != nil {
			logger.Warn("auth: session user lookup failed", "err", err.Error(), "userID", idStr)
			_ = huma.WriteErr(api, ctx, http.StatusUnauthorized, "not authenticated")
			return
		}
		next(huma.WithValue(ctx, contextKey{}, user))
	}
}
```

- [ ] **Step 3: Write the handler**

Create `backend/internal/auth/handler.go`:

```go
package auth

import (
	"context"
	"log/slog"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	"github.com/z3tz3r0/ecommerce-space-craft/backend/internal/platform/session"
)

// Register registers all auth endpoints on the given Huma API.
//
// The signup + login handlers regenerate the session token on success
// (session fixation mitigation) and store the current user's UUID under
// the userIDKey. The logout handler destroys the server-side session.
// The me endpoint is protected by RequireAuth middleware composed at
// registration time.
func Register(api huma.API, svc *Service, sess session.Manager, logger *slog.Logger) {
	huma.Register(api, huma.Operation{
		OperationID: "signup",
		Method:      http.MethodPost,
		Path:        "/api/auth/signup",
		Summary:     "Create a new account and start a session",
		Tags:        []string{"Auth"},
		DefaultStatus: http.StatusCreated,
	}, func(ctx context.Context, in *SignupInput) (*UserOutput, error) {
		user, err := svc.Signup(ctx, in.Body.Email, in.Body.Password)
		if err != nil {
			return nil, mapError(logger, err)
		}
		if err := sess.RenewToken(ctx); err != nil {
			logger.Error("auth: renew token on signup", "err", err.Error())
			return nil, huma.Error500InternalServerError("internal error")
		}
		sess.Put(ctx, userIDKey, user.ID.String())
		return &UserOutput{Body: user}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "login",
		Method:      http.MethodPost,
		Path:        "/api/auth/login",
		Summary:     "Log in with email and password",
		Tags:        []string{"Auth"},
	}, func(ctx context.Context, in *LoginInput) (*UserOutput, error) {
		user, err := svc.Login(ctx, in.Body.Email, in.Body.Password)
		if err != nil {
			return nil, mapError(logger, err)
		}
		if err := sess.RenewToken(ctx); err != nil {
			logger.Error("auth: renew token on login", "err", err.Error())
			return nil, huma.Error500InternalServerError("internal error")
		}
		sess.Put(ctx, userIDKey, user.ID.String())
		return &UserOutput{Body: user}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID:   "logout",
		Method:        http.MethodPost,
		Path:          "/api/auth/logout",
		Summary:       "End the current session",
		Tags:          []string{"Auth"},
		DefaultStatus: http.StatusNoContent,
	}, func(ctx context.Context, _ *struct{}) (*struct{}, error) {
		if err := sess.Destroy(ctx); err != nil {
			logger.Error("auth: destroy session on logout", "err", err.Error())
			return nil, huma.Error500InternalServerError("internal error")
		}
		return nil, nil
	})

	meOp := huma.Operation{
		OperationID: "getMe",
		Method:      http.MethodGet,
		Path:        "/api/auth/me",
		Summary:     "Fetch the currently authenticated user",
		Tags:        []string{"Auth"},
		Middlewares: huma.Middlewares{RequireAuth(api, sess, svc, logger)},
	}
	huma.Register(api, meOp, func(ctx context.Context, _ *struct{}) (*UserOutput, error) {
		return &UserOutput{Body: CurrentUser(ctx)}, nil
	})
}

// SignupInput is the request body for the signup endpoint.
type SignupInput struct {
	Body struct {
		Email    string `json:"email" format:"email" doc:"User email (case-insensitive)"`
		Password string `json:"password" minLength:"8" doc:"At least 8 characters"`
	}
}

// LoginInput is the request body for the login endpoint.
type LoginInput struct {
	Body struct {
		Email    string `json:"email" format:"email"`
		Password string `json:"password" minLength:"1"`
	}
}

// UserOutput wraps a single User for response bodies.
type UserOutput struct {
	Body User
}
```

- [ ] **Step 4: Write the handler integration tests**

Create `backend/internal/auth/handler_test.go`:

```go
package auth_test

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/alexedwards/scs/v2"
	"github.com/alexedwards/scs/v2/memstore"
	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/adapters/humago"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"

	"github.com/z3tz3r0/ecommerce-space-craft/backend/internal/auth"
)

// Build a Huma API with an in-memory session store so tests don't need
// Postgres. The scs SessionManager accepts any `scs.Store` implementation.
func newTestAPI(t *testing.T, svc *auth.Service) (huma.API, *scs.SessionManager, http.Handler) {
	t.Helper()
	mux := http.NewServeMux()
	api := humago.New(mux, huma.DefaultConfig("test", "0.0.0"))
	sess := scs.New()
	sess.Store = memstore.New()
	sess.Lifetime = time.Hour
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	auth.Register(api, svc, sess, logger)
	return api, sess, sess.LoadAndSave(mux)
}

func TestHandler_Signup_Success_SetsSessionCookie(t *testing.T) {
	uid := uuid.New()
	now := time.Now()
	svc := auth.NewServiceFake(t, auth.FakeRepoAdapter{
		Create: func(_ context.Context, email, hash string) (auth.FakeRecord, error) {
			return auth.FakeRecord{ID: uid, Email: email, PasswordHash: hash, CreatedAt: now, UpdatedAt: now}, nil
		},
	})
	_, _, handler := newTestAPI(t, svc)
	srv := httptest.NewServer(handler)
	defer srv.Close()

	body := `{"email":"a@b.com","password":"hunter2!!"}`
	resp, err := http.Post(srv.URL+"/api/auth/signup", "application/json", bytes.NewBufferString(body))
	require.NoError(t, err)
	defer resp.Body.Close()
	require.Equal(t, http.StatusCreated, resp.StatusCode)

	cookies := resp.Cookies()
	require.NotEmpty(t, cookies, "signup must set a session cookie")
	require.Equal(t, "session", cookies[0].Name)
	require.True(t, cookies[0].HttpOnly)

	var out auth.User
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&out))
	require.Equal(t, uid, out.ID)
	require.Equal(t, "a@b.com", out.Email)
}

func TestHandler_Signup_WeakPassword_Returns400(t *testing.T) {
	svc := auth.NewServiceFake(t, auth.FakeRepoAdapter{})
	_, _, handler := newTestAPI(t, svc)
	srv := httptest.NewServer(handler)
	defer srv.Close()

	// Huma's minLength:"8" rejects short passwords at schema validation
	// before the service runs, so the status is 422 (Huma default for
	// request validation failures).
	body := `{"email":"a@b.com","password":"short"}`
	resp, err := http.Post(srv.URL+"/api/auth/signup", "application/json", bytes.NewBufferString(body))
	require.NoError(t, err)
	defer resp.Body.Close()
	require.Equal(t, http.StatusUnprocessableEntity, resp.StatusCode)
}

func TestHandler_Login_WrongPassword_Returns401(t *testing.T) {
	svc := auth.NewServiceFake(t, auth.FakeRepoAdapter{
		GetByEmail: func(_ context.Context, _ string) (auth.FakeRecord, error) {
			return auth.FakeRecord{}, auth.ErrUserNotFound
		},
	})
	_, _, handler := newTestAPI(t, svc)
	srv := httptest.NewServer(handler)
	defer srv.Close()

	body := `{"email":"nobody@x.com","password":"hunter2!!"}`
	resp, err := http.Post(srv.URL+"/api/auth/login", "application/json", bytes.NewBufferString(body))
	require.NoError(t, err)
	defer resp.Body.Close()
	require.Equal(t, http.StatusUnauthorized, resp.StatusCode)
}

func TestHandler_Me_NoCookie_Returns401(t *testing.T) {
	svc := auth.NewServiceFake(t, auth.FakeRepoAdapter{})
	_, _, handler := newTestAPI(t, svc)
	srv := httptest.NewServer(handler)
	defer srv.Close()

	resp, err := http.Get(srv.URL + "/api/auth/me")
	require.NoError(t, err)
	defer resp.Body.Close()
	require.Equal(t, http.StatusUnauthorized, resp.StatusCode)
}

func TestHandler_SignupThenMe_ReturnsUserWithCookie(t *testing.T) {
	uid := uuid.New()
	now := time.Now()
	svc := auth.NewServiceFake(t, auth.FakeRepoAdapter{
		Create: func(_ context.Context, email, hash string) (auth.FakeRecord, error) {
			return auth.FakeRecord{ID: uid, Email: email, PasswordHash: hash, CreatedAt: now, UpdatedAt: now}, nil
		},
		GetByID: func(_ context.Context, id uuid.UUID) (auth.FakeRecord, error) {
			if id == uid {
				return auth.FakeRecord{ID: uid, Email: "a@b.com", CreatedAt: now, UpdatedAt: now}, nil
			}
			return auth.FakeRecord{}, auth.ErrUserNotFound
		},
	})
	_, _, handler := newTestAPI(t, svc)
	srv := httptest.NewServer(handler)
	defer srv.Close()

	jar, _ := cookieJar()
	client := &http.Client{Jar: jar}

	// Signup — captures session cookie into the jar.
	{
		body := `{"email":"a@b.com","password":"hunter2!!"}`
		resp, err := client.Post(srv.URL+"/api/auth/signup", "application/json", bytes.NewBufferString(body))
		require.NoError(t, err)
		resp.Body.Close()
		require.Equal(t, http.StatusCreated, resp.StatusCode)
	}

	// Me — cookie jar replays the session cookie.
	{
		resp, err := client.Get(srv.URL + "/api/auth/me")
		require.NoError(t, err)
		defer resp.Body.Close()
		require.Equal(t, http.StatusOK, resp.StatusCode)

		var out auth.User
		require.NoError(t, json.NewDecoder(resp.Body).Decode(&out))
		require.Equal(t, uid, out.ID)
	}
}

func TestHandler_Logout_ClearsSession(t *testing.T) {
	uid := uuid.New()
	now := time.Now()
	svc := auth.NewServiceFake(t, auth.FakeRepoAdapter{
		Create: func(_ context.Context, email, hash string) (auth.FakeRecord, error) {
			return auth.FakeRecord{ID: uid, Email: email, PasswordHash: hash, CreatedAt: now, UpdatedAt: now}, nil
		},
		GetByID: func(_ context.Context, _ uuid.UUID) (auth.FakeRecord, error) {
			return auth.FakeRecord{ID: uid, Email: "a@b.com", CreatedAt: now, UpdatedAt: now}, nil
		},
	})
	_, _, handler := newTestAPI(t, svc)
	srv := httptest.NewServer(handler)
	defer srv.Close()

	jar, _ := cookieJar()
	client := &http.Client{Jar: jar}

	body := `{"email":"a@b.com","password":"hunter2!!"}`
	resp, err := client.Post(srv.URL+"/api/auth/signup", "application/json", bytes.NewBufferString(body))
	require.NoError(t, err)
	resp.Body.Close()

	// Logout
	resp, err = client.Post(srv.URL+"/api/auth/logout", "application/json", nil)
	require.NoError(t, err)
	resp.Body.Close()
	require.Equal(t, http.StatusNoContent, resp.StatusCode)

	// Me should now 401
	resp, err = client.Get(srv.URL + "/api/auth/me")
	require.NoError(t, err)
	resp.Body.Close()
	require.Equal(t, http.StatusUnauthorized, resp.StatusCode)
}

func cookieJar() (http.CookieJar, error) {
	return cookiejar_New()
}

// cookiejar_New exists to keep the import grouping stable.
func cookiejar_New() (http.CookieJar, error) {
	return nethttpCookieJar()
}

func nethttpCookieJar() (http.CookieJar, error) {
	return httpcookiejar.New(nil)
}
```

The last three functions are indirection — replace them with a direct import. Final imports block for `handler_test.go`:

```go
import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/alexedwards/scs/v2"
	"github.com/alexedwards/scs/v2/memstore"
	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/adapters/humago"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"

	"github.com/z3tz3r0/ecommerce-space-craft/backend/internal/auth"
)
```

And replace `cookieJar()` and the two shim functions at the bottom with:

```go
func cookieJar() (http.CookieJar, error) {
	return cookiejar.New(nil)
}
```

- [ ] **Step 5: Wire auth into `cmd/api/main.go`**

Modify `backend/cmd/api/main.go`. Replace the block that constructs the API and registers catalog with the following version that adds session + auth wiring:

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

	"github.com/z3tz3r0/ecommerce-space-craft/backend/internal/auth"
	"github.com/z3tz3r0/ecommerce-space-craft/backend/internal/catalog"
	"github.com/z3tz3r0/ecommerce-space-craft/backend/internal/platform/config"
	"github.com/z3tz3r0/ecommerce-space-craft/backend/internal/platform/db"
	"github.com/z3tz3r0/ecommerce-space-craft/backend/internal/platform/logging"
	"github.com/z3tz3r0/ecommerce-space-craft/backend/internal/platform/server"
	"github.com/z3tz3r0/ecommerce-space-craft/backend/internal/platform/session"
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

	sess := session.New(pool, cfg.Environment == "production")

	catalogRepo := catalog.NewPostgres(pool)
	catalogSvc := catalog.NewService(catalogRepo)
	catalog.Register(api.Huma, catalogSvc, logger)

	authRepo := auth.NewPostgres(pool)
	authSvc := auth.NewService(authRepo)
	auth.Register(api.Huma, authSvc, sess, logger)

	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           sess.LoadAndSave(api.Mux),
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

Key changes:
- New `session.New(pool, cfg.Environment == "production")` call wires scs with Secure cookies gated on env.
- `auth.Register(api.Huma, authSvc, sess, logger)` registers the four endpoints.
- `sess.LoadAndSave(api.Mux)` wraps the mux so session state loads/saves per request — this is what plugs scs into every request, not just auth routes.

- [ ] **Step 6: Run the full auth test suite**

```bash
cd backend
go test ./internal/auth/... -count=1 -race
```

Expected: all tests pass.

- [ ] **Step 7: Build the binary to confirm main.go compiles**

```bash
cd backend
go build ./...
```

Expected: no output.

- [ ] **Step 8: Commit**

```bash
git add backend/internal/auth/errors.go backend/internal/auth/middleware.go backend/internal/auth/handler.go backend/internal/auth/handler_test.go backend/cmd/api/main.go
git commit -m "feat(backend): wire auth endpoints (signup/login/logout/me) with scs sessions"
```

---

## Task 6 — Cart slice: domain, repository, sqlc, postgres

**Files:**
- Create: `backend/internal/cart/domain.go`
- Create: `backend/internal/cart/repository.go`
- Create: `backend/internal/cart/postgres.go`
- Create: `backend/internal/cart/queries.sql`
- Create (via sqlc): `backend/internal/cart/db/db.go`, `models.go`, `queries.sql.go`

---

- [ ] **Step 1: Write the cart domain types**

Create `backend/internal/cart/domain.go`:

```go
// Package cart is the shopping-cart bounded context. Items are keyed on
// (user_id, product_id) with quantities clamped to each product's live
// stock. Guest carts live client-side and enter this context only through
// the Merge method during signup/login.
package cart

import (
	"errors"

	"github.com/google/uuid"
)

// Item is one row in the user's cart, enriched with the joined product
// fields the frontend needs to render without a second roundtrip.
type Item struct {
	ProductID     uuid.UUID `json:"productId"`
	Name          string    `json:"name"`
	PriceCents    int64     `json:"priceCents"`
	ImageURL      *string   `json:"imageUrl,omitempty"`
	Quantity      int32     `json:"quantity"`
	StockQuantity int32     `json:"stockQuantity"`
}

// Cart is a user's current cart state.
type Cart struct {
	Items []Item `json:"items"`
}

// MergeItem is the guest-cart line shape accepted by the merge endpoint.
type MergeItem struct {
	ProductID uuid.UUID `json:"productId"`
	Quantity  int32     `json:"quantity"`
}

// Sentinel errors exposed by the cart context.
var (
	ErrProductNotFound = errors.New("cart: product not found or inactive")
	ErrInvalidQuantity = errors.New("cart: quantity must be >= 1")
	ErrOverStock       = errors.New("cart: quantity exceeds available stock")
)
```

- [ ] **Step 2: Write the sqlc queries**

Create `backend/internal/cart/queries.sql`:

```sql
-- name: GetCartItems :many
SELECT
    ci.product_id,
    p.name,
    p.price_cents,
    p.image_url,
    ci.quantity,
    p.stock_quantity
FROM cart_items ci
JOIN products p ON p.id = ci.product_id
WHERE ci.user_id = $1 AND p.is_active = true
ORDER BY ci.created_at ASC;

-- name: GetProductForCart :one
SELECT id, name, price_cents, image_url, stock_quantity, is_active
FROM products
WHERE id = $1;

-- name: UpsertCartItem :one
INSERT INTO cart_items (user_id, product_id, quantity)
VALUES ($1, $2, $3)
ON CONFLICT (user_id, product_id) DO UPDATE
    SET quantity   = EXCLUDED.quantity,
        updated_at = now()
RETURNING user_id, product_id, quantity;

-- name: GetCartItemQuantity :one
SELECT quantity
FROM cart_items
WHERE user_id = $1 AND product_id = $2;

-- name: DeleteCartItem :exec
DELETE FROM cart_items
WHERE user_id = $1 AND product_id = $2;

-- name: ClearCart :exec
DELETE FROM cart_items
WHERE user_id = $1;
```

- [ ] **Step 3: Run sqlc**

```bash
cd backend
sqlc generate
```

Expected: three files under `backend/internal/cart/db/`.

- [ ] **Step 4: Write the Repository interface**

Create `backend/internal/cart/repository.go`:

```go
package cart

import (
	"context"

	"github.com/google/uuid"
)

// productSnapshot is the repository-layer view of a product that the cart
// service needs: enough to validate stock and render lines. It is NOT
// the catalog Product — this keeps the two contexts independent.
type productSnapshot struct {
	ID            uuid.UUID
	Name          string
	PriceCents    int64
	ImageURL      *string
	StockQuantity int32
	IsActive      bool
}

// Repository is the storage-facing interface the cart Service depends on.
type Repository interface {
	// GetItems returns the user's current cart, joined against live products
	// (inactive products are filtered out).
	GetItems(ctx context.Context, userID uuid.UUID) ([]Item, error)

	// GetProduct returns the product snapshot used for stock validation.
	// Returns ErrProductNotFound if the product is missing or inactive.
	GetProduct(ctx context.Context, productID uuid.UUID) (productSnapshot, error)

	// GetItemQuantity returns the quantity of a specific cart line, or 0
	// if the line does not exist.
	GetItemQuantity(ctx context.Context, userID, productID uuid.UUID) (int32, error)

	// UpsertItem inserts or updates a cart line to the given quantity.
	UpsertItem(ctx context.Context, userID, productID uuid.UUID, quantity int32) error

	// DeleteItem removes the cart line for the given (userID, productID).
	DeleteItem(ctx context.Context, userID, productID uuid.UUID) error
}
```

- [ ] **Step 5: Write the Postgres implementation**

Create `backend/internal/cart/postgres.go`:

```go
package cart

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	cartdb "github.com/z3tz3r0/ecommerce-space-craft/backend/internal/cart/db"
)

// Postgres is the pgx/sqlc-backed implementation of Repository.
type Postgres struct {
	q *cartdb.Queries
}

// NewPostgres wraps a pgxpool.Pool with the sqlc-generated Queries.
func NewPostgres(pool *pgxpool.Pool) *Postgres {
	return &Postgres{q: cartdb.New(pool)}
}

// GetItems returns the user's cart lines joined against active products.
func (p *Postgres) GetItems(ctx context.Context, userID uuid.UUID) ([]Item, error) {
	rows, err := p.q.GetCartItems(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("postgres: get cart items: %w", err)
	}
	out := make([]Item, 0, len(rows))
	for _, r := range rows {
		out = append(out, Item{
			ProductID:     r.ProductID,
			Name:          r.Name,
			PriceCents:    r.PriceCents,
			ImageURL:      r.ImageUrl,
			Quantity:      r.Quantity,
			StockQuantity: r.StockQuantity,
		})
	}
	return out, nil
}

// GetProduct returns the live product snapshot or ErrProductNotFound.
func (p *Postgres) GetProduct(ctx context.Context, productID uuid.UUID) (productSnapshot, error) {
	row, err := p.q.GetProductForCart(ctx, productID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return productSnapshot{}, ErrProductNotFound
		}
		return productSnapshot{}, fmt.Errorf("postgres: get product for cart: %w", err)
	}
	if !row.IsActive {
		return productSnapshot{}, ErrProductNotFound
	}
	return productSnapshot{
		ID:            row.ID,
		Name:          row.Name,
		PriceCents:    row.PriceCents,
		ImageURL:      row.ImageUrl,
		StockQuantity: row.StockQuantity,
		IsActive:      row.IsActive,
	}, nil
}

// GetItemQuantity returns the current quantity of a cart line, or 0 if none.
func (p *Postgres) GetItemQuantity(ctx context.Context, userID, productID uuid.UUID) (int32, error) {
	q, err := p.q.GetCartItemQuantity(ctx, cartdb.GetCartItemQuantityParams{
		UserID:    userID,
		ProductID: productID,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return 0, nil
		}
		return 0, fmt.Errorf("postgres: get cart item quantity: %w", err)
	}
	return q, nil
}

// UpsertItem inserts or updates the cart line to the given quantity.
func (p *Postgres) UpsertItem(ctx context.Context, userID, productID uuid.UUID, quantity int32) error {
	_, err := p.q.UpsertCartItem(ctx, cartdb.UpsertCartItemParams{
		UserID:    userID,
		ProductID: productID,
		Quantity:  quantity,
	})
	if err != nil {
		return fmt.Errorf("postgres: upsert cart item: %w", err)
	}
	return nil
}

// DeleteItem removes a cart line.
func (p *Postgres) DeleteItem(ctx context.Context, userID, productID uuid.UUID) error {
	if err := p.q.DeleteCartItem(ctx, cartdb.DeleteCartItemParams{
		UserID:    userID,
		ProductID: productID,
	}); err != nil {
		return fmt.Errorf("postgres: delete cart item: %w", err)
	}
	return nil
}
```

- [ ] **Step 6: Confirm the slice compiles**

```bash
cd backend
go build ./internal/cart/...
```

Expected: no output.

- [ ] **Step 7: Commit**

```bash
git add backend/internal/cart/domain.go backend/internal/cart/queries.sql backend/internal/cart/db/ backend/internal/cart/repository.go backend/internal/cart/postgres.go
git commit -m "feat(backend): add cart slice domain + repository + postgres + sqlc"
```

---

## Task 7 — Cart slice: service, handler, tests, main.go wiring, OpenAPI regen

**Files:**
- Create: `backend/internal/cart/service.go`
- Create: `backend/internal/cart/service_test.go`
- Create: `backend/internal/cart/errors.go`
- Create: `backend/internal/cart/handler.go`
- Create: `backend/internal/cart/handler_test.go`
- Modify: `backend/cmd/api/main.go`
- Modify: `backend/cmd/openapi/main.go`
- Modify: `backend/openapi.json` (regenerated)
- Modify: `.github/workflows/backend.yml` (expand codegen-drift file list)

---

- [ ] **Step 1: Write the cart service tests**

Create `backend/internal/cart/service_test.go`:

```go
package cart_test

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"

	"github.com/z3tz3r0/ecommerce-space-craft/backend/internal/cart"
)

func TestService_Get_Empty_ReturnsEmptyItems(t *testing.T) {
	uid := uuid.New()
	svc := cart.NewServiceFake(t, cart.FakeRepoAdapter{
		GetItems: func(_ context.Context, _ uuid.UUID) ([]cart.Item, error) {
			return nil, nil
		},
	})
	got, err := svc.Get(context.Background(), uid)
	require.NoError(t, err)
	require.Empty(t, got.Items)
}

func TestService_Add_NewItem_Upserts(t *testing.T) {
	uid := uuid.New()
	pid := uuid.New()
	var observedQty int32
	svc := cart.NewServiceFake(t, cart.FakeRepoAdapter{
		GetProduct: func(_ context.Context, _ uuid.UUID) (cart.FakeProduct, error) {
			return cart.FakeProduct{ID: pid, Name: "X-Wing", PriceCents: 12500000, StockQuantity: 10, IsActive: true}, nil
		},
		GetItemQuantity: func(_ context.Context, _, _ uuid.UUID) (int32, error) {
			return 0, nil
		},
		UpsertItem: func(_ context.Context, _, _ uuid.UUID, q int32) error {
			observedQty = q
			return nil
		},
	})
	item, err := svc.Add(context.Background(), uid, pid, 2)
	require.NoError(t, err)
	require.Equal(t, int32(2), item.Quantity)
	require.Equal(t, int32(2), observedQty)
}

func TestService_Add_ExistingItem_SumsQuantity(t *testing.T) {
	uid := uuid.New()
	pid := uuid.New()
	var observedQty int32
	svc := cart.NewServiceFake(t, cart.FakeRepoAdapter{
		GetProduct: func(_ context.Context, _ uuid.UUID) (cart.FakeProduct, error) {
			return cart.FakeProduct{ID: pid, StockQuantity: 10, IsActive: true}, nil
		},
		GetItemQuantity: func(_ context.Context, _, _ uuid.UUID) (int32, error) {
			return 3, nil
		},
		UpsertItem: func(_ context.Context, _, _ uuid.UUID, q int32) error {
			observedQty = q
			return nil
		},
	})
	item, err := svc.Add(context.Background(), uid, pid, 2)
	require.NoError(t, err)
	require.Equal(t, int32(5), item.Quantity)
	require.Equal(t, int32(5), observedQty)
}

func TestService_Add_OverStock_ClampsToStock(t *testing.T) {
	uid := uuid.New()
	pid := uuid.New()
	var observedQty int32
	svc := cart.NewServiceFake(t, cart.FakeRepoAdapter{
		GetProduct: func(_ context.Context, _ uuid.UUID) (cart.FakeProduct, error) {
			return cart.FakeProduct{ID: pid, StockQuantity: 4, IsActive: true}, nil
		},
		GetItemQuantity: func(_ context.Context, _, _ uuid.UUID) (int32, error) {
			return 3, nil
		},
		UpsertItem: func(_ context.Context, _, _ uuid.UUID, q int32) error {
			observedQty = q
			return nil
		},
	})
	item, err := svc.Add(context.Background(), uid, pid, 5)
	require.NoError(t, err)
	require.Equal(t, int32(4), item.Quantity, "sum 3+5 clamps down to stock 4")
	require.Equal(t, int32(4), observedQty)
}

func TestService_Add_InactiveProduct_Returns_ErrProductNotFound(t *testing.T) {
	uid := uuid.New()
	pid := uuid.New()
	svc := cart.NewServiceFake(t, cart.FakeRepoAdapter{
		GetProduct: func(_ context.Context, _ uuid.UUID) (cart.FakeProduct, error) {
			return cart.FakeProduct{}, cart.ErrProductNotFound
		},
	})
	_, err := svc.Add(context.Background(), uid, pid, 1)
	require.ErrorIs(t, err, cart.ErrProductNotFound)
}

func TestService_Add_NonPositiveQuantity_Returns_ErrInvalidQuantity(t *testing.T) {
	uid := uuid.New()
	pid := uuid.New()
	svc := cart.NewServiceFake(t, cart.FakeRepoAdapter{})
	_, err := svc.Add(context.Background(), uid, pid, 0)
	require.ErrorIs(t, err, cart.ErrInvalidQuantity)
}

func TestService_Set_ValidQuantity_Upserts(t *testing.T) {
	uid := uuid.New()
	pid := uuid.New()
	var observedQty int32
	svc := cart.NewServiceFake(t, cart.FakeRepoAdapter{
		GetProduct: func(_ context.Context, _ uuid.UUID) (cart.FakeProduct, error) {
			return cart.FakeProduct{ID: pid, StockQuantity: 10, IsActive: true}, nil
		},
		UpsertItem: func(_ context.Context, _, _ uuid.UUID, q int32) error {
			observedQty = q
			return nil
		},
	})
	item, err := svc.Set(context.Background(), uid, pid, 3)
	require.NoError(t, err)
	require.Equal(t, int32(3), item.Quantity)
	require.Equal(t, int32(3), observedQty)
}

func TestService_Set_OverStock_Returns_ErrOverStock(t *testing.T) {
	uid := uuid.New()
	pid := uuid.New()
	svc := cart.NewServiceFake(t, cart.FakeRepoAdapter{
		GetProduct: func(_ context.Context, _ uuid.UUID) (cart.FakeProduct, error) {
			return cart.FakeProduct{ID: pid, StockQuantity: 2, IsActive: true}, nil
		},
	})
	_, err := svc.Set(context.Background(), uid, pid, 5)
	require.ErrorIs(t, err, cart.ErrOverStock)
}

func TestService_Set_ZeroQuantity_Returns_ErrInvalidQuantity(t *testing.T) {
	uid := uuid.New()
	pid := uuid.New()
	svc := cart.NewServiceFake(t, cart.FakeRepoAdapter{})
	_, err := svc.Set(context.Background(), uid, pid, 0)
	require.ErrorIs(t, err, cart.ErrInvalidQuantity)
}

func TestService_Remove_Deletes(t *testing.T) {
	uid := uuid.New()
	pid := uuid.New()
	called := false
	svc := cart.NewServiceFake(t, cart.FakeRepoAdapter{
		DeleteItem: func(_ context.Context, _, _ uuid.UUID) error {
			called = true
			return nil
		},
	})
	err := svc.Remove(context.Background(), uid, pid)
	require.NoError(t, err)
	require.True(t, called)
}

func TestService_Merge_EmptyInput_ReturnsCurrentCart(t *testing.T) {
	uid := uuid.New()
	svc := cart.NewServiceFake(t, cart.FakeRepoAdapter{
		GetItems: func(_ context.Context, _ uuid.UUID) ([]cart.Item, error) {
			return []cart.Item{{ProductID: uuid.New(), Quantity: 1}}, nil
		},
	})
	got, err := svc.Merge(context.Background(), uid, nil)
	require.NoError(t, err)
	require.Len(t, got.Items, 1)
}

func TestService_Merge_SumsQuantities_AndSkipsInactive(t *testing.T) {
	uid := uuid.New()
	active := uuid.New()
	inactive := uuid.New()
	upserts := map[uuid.UUID]int32{}
	svc := cart.NewServiceFake(t, cart.FakeRepoAdapter{
		GetProduct: func(_ context.Context, id uuid.UUID) (cart.FakeProduct, error) {
			if id == active {
				return cart.FakeProduct{ID: active, StockQuantity: 10, IsActive: true}, nil
			}
			return cart.FakeProduct{}, cart.ErrProductNotFound
		},
		GetItemQuantity: func(_ context.Context, _, _ uuid.UUID) (int32, error) {
			return 0, nil
		},
		UpsertItem: func(_ context.Context, _, pid uuid.UUID, q int32) error {
			upserts[pid] = q
			return nil
		},
		GetItems: func(_ context.Context, _ uuid.UUID) ([]cart.Item, error) {
			return []cart.Item{{ProductID: active, Quantity: upserts[active]}}, nil
		},
	})
	got, err := svc.Merge(context.Background(), uid, []cart.MergeItem{
		{ProductID: active, Quantity: 2},
		{ProductID: inactive, Quantity: 5},
	})
	require.NoError(t, err)
	require.Len(t, got.Items, 1)
	require.Equal(t, int32(2), upserts[active])
	_, skipped := upserts[inactive]
	require.False(t, skipped, "inactive product must be silently skipped")
}

func TestService_Merge_SumWithExisting_ClampsToStock(t *testing.T) {
	uid := uuid.New()
	pid := uuid.New()
	var observedQty int32
	svc := cart.NewServiceFake(t, cart.FakeRepoAdapter{
		GetProduct: func(_ context.Context, _ uuid.UUID) (cart.FakeProduct, error) {
			return cart.FakeProduct{ID: pid, StockQuantity: 5, IsActive: true}, nil
		},
		GetItemQuantity: func(_ context.Context, _, _ uuid.UUID) (int32, error) {
			return 4, nil
		},
		UpsertItem: func(_ context.Context, _, _ uuid.UUID, q int32) error {
			observedQty = q
			return nil
		},
		GetItems: func(_ context.Context, _ uuid.UUID) ([]cart.Item, error) {
			return []cart.Item{{ProductID: pid, Quantity: observedQty, StockQuantity: 5}}, nil
		},
	})
	got, err := svc.Merge(context.Background(), uid, []cart.MergeItem{{ProductID: pid, Quantity: 3}})
	require.NoError(t, err)
	require.Len(t, got.Items, 1)
	require.Equal(t, int32(5), observedQty, "existing 4 + guest 3 = 7 clamps down to stock 5")
}
```

- [ ] **Step 2: Write the cart service and test-only fake helpers**

Create `backend/internal/cart/service.go`:

```go
package cart

import (
	"context"
	"fmt"
	"testing"

	"github.com/google/uuid"
)

// Service holds business logic for the cart bounded context.
type Service struct {
	repo Repository
}

// NewService constructs a Service wrapping the given Repository.
func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

// Get returns the user's current cart.
func (s *Service) Get(ctx context.Context, userID uuid.UUID) (Cart, error) {
	items, err := s.repo.GetItems(ctx, userID)
	if err != nil {
		return Cart{}, fmt.Errorf("cart: get: %w", err)
	}
	if items == nil {
		items = []Item{}
	}
	return Cart{Items: items}, nil
}

// Add increments the cart line for productID by the given quantity,
// clamping to the product's live stock. Creates the line if it doesn't
// exist. Returns the resulting line.
func (s *Service) Add(ctx context.Context, userID, productID uuid.UUID, quantity int32) (Item, error) {
	if quantity < 1 {
		return Item{}, ErrInvalidQuantity
	}
	prod, err := s.repo.GetProduct(ctx, productID)
	if err != nil {
		return Item{}, err
	}
	existing, err := s.repo.GetItemQuantity(ctx, userID, productID)
	if err != nil {
		return Item{}, fmt.Errorf("cart: get existing quantity: %w", err)
	}
	target := existing + quantity
	if target > prod.StockQuantity {
		target = prod.StockQuantity
	}
	if err := s.repo.UpsertItem(ctx, userID, productID, target); err != nil {
		return Item{}, fmt.Errorf("cart: upsert: %w", err)
	}
	return Item{
		ProductID:     prod.ID,
		Name:          prod.Name,
		PriceCents:    prod.PriceCents,
		ImageURL:      prod.ImageURL,
		Quantity:      target,
		StockQuantity: prod.StockQuantity,
	}, nil
}

// Set replaces the cart line's quantity. Rejects quantities <1 or above
// live stock.
func (s *Service) Set(ctx context.Context, userID, productID uuid.UUID, quantity int32) (Item, error) {
	if quantity < 1 {
		return Item{}, ErrInvalidQuantity
	}
	prod, err := s.repo.GetProduct(ctx, productID)
	if err != nil {
		return Item{}, err
	}
	if quantity > prod.StockQuantity {
		return Item{}, ErrOverStock
	}
	if err := s.repo.UpsertItem(ctx, userID, productID, quantity); err != nil {
		return Item{}, fmt.Errorf("cart: upsert: %w", err)
	}
	return Item{
		ProductID:     prod.ID,
		Name:          prod.Name,
		PriceCents:    prod.PriceCents,
		ImageURL:      prod.ImageURL,
		Quantity:      quantity,
		StockQuantity: prod.StockQuantity,
	}, nil
}

// Remove deletes the cart line.
func (s *Service) Remove(ctx context.Context, userID, productID uuid.UUID) error {
	if err := s.repo.DeleteItem(ctx, userID, productID); err != nil {
		return fmt.Errorf("cart: delete: %w", err)
	}
	return nil
}

// Merge adds the given guest items to the user's cart additively — for
// each input (productID, quantity), sum with the existing server quantity
// and clamp to live stock. Products that don't exist or are inactive are
// silently skipped. Returns the resulting full cart.
func (s *Service) Merge(ctx context.Context, userID uuid.UUID, items []MergeItem) (Cart, error) {
	for _, in := range items {
		if in.Quantity < 1 {
			continue
		}
		prod, err := s.repo.GetProduct(ctx, in.ProductID)
		if err != nil {
			if err == ErrProductNotFound {
				continue
			}
			return Cart{}, fmt.Errorf("cart: merge get product: %w", err)
		}
		existing, err := s.repo.GetItemQuantity(ctx, userID, in.ProductID)
		if err != nil {
			return Cart{}, fmt.Errorf("cart: merge get existing: %w", err)
		}
		target := existing + in.Quantity
		if target > prod.StockQuantity {
			target = prod.StockQuantity
		}
		if err := s.repo.UpsertItem(ctx, userID, in.ProductID, target); err != nil {
			return Cart{}, fmt.Errorf("cart: merge upsert: %w", err)
		}
	}
	return s.Get(ctx, userID)
}

// --- test-only helpers -------------------------------------------------

type FakeProduct struct {
	ID            uuid.UUID
	Name          string
	PriceCents    int64
	ImageURL      *string
	StockQuantity int32
	IsActive      bool
}

type FakeRepoAdapter struct {
	GetItems        func(ctx context.Context, userID uuid.UUID) ([]Item, error)
	GetProduct      func(ctx context.Context, productID uuid.UUID) (FakeProduct, error)
	GetItemQuantity func(ctx context.Context, userID, productID uuid.UUID) (int32, error)
	UpsertItem      func(ctx context.Context, userID, productID uuid.UUID, quantity int32) error
	DeleteItem      func(ctx context.Context, userID, productID uuid.UUID) error
}

func NewServiceFake(_ *testing.T, a FakeRepoAdapter) *Service {
	return NewService(fakeRepoImpl{a: a})
}

type fakeRepoImpl struct{ a FakeRepoAdapter }

func (f fakeRepoImpl) GetItems(ctx context.Context, userID uuid.UUID) ([]Item, error) {
	if f.a.GetItems == nil {
		return nil, nil
	}
	return f.a.GetItems(ctx, userID)
}

func (f fakeRepoImpl) GetProduct(ctx context.Context, productID uuid.UUID) (productSnapshot, error) {
	if f.a.GetProduct == nil {
		return productSnapshot{}, ErrProductNotFound
	}
	p, err := f.a.GetProduct(ctx, productID)
	if err != nil {
		return productSnapshot{}, err
	}
	return productSnapshot{
		ID:            p.ID,
		Name:          p.Name,
		PriceCents:    p.PriceCents,
		ImageURL:      p.ImageURL,
		StockQuantity: p.StockQuantity,
		IsActive:      p.IsActive,
	}, nil
}

func (f fakeRepoImpl) GetItemQuantity(ctx context.Context, userID, productID uuid.UUID) (int32, error) {
	if f.a.GetItemQuantity == nil {
		return 0, nil
	}
	return f.a.GetItemQuantity(ctx, userID, productID)
}

func (f fakeRepoImpl) UpsertItem(ctx context.Context, userID, productID uuid.UUID, quantity int32) error {
	if f.a.UpsertItem == nil {
		return nil
	}
	return f.a.UpsertItem(ctx, userID, productID, quantity)
}

func (f fakeRepoImpl) DeleteItem(ctx context.Context, userID, productID uuid.UUID) error {
	if f.a.DeleteItem == nil {
		return nil
	}
	return f.a.DeleteItem(ctx, userID, productID)
}
```

- [ ] **Step 3: Run the service tests**

```bash
cd backend
go test ./internal/cart/... -count=1
```

Expected: all 13 tests pass.

- [ ] **Step 4: Write the cart error mapper**

Create `backend/internal/cart/errors.go`:

```go
package cart

import (
	"errors"
	"log/slog"

	"github.com/danielgtaylor/huma/v2"
)

// mapError converts a cart domain error to a Huma-compatible response.
func mapError(logger *slog.Logger, err error) error {
	switch {
	case errors.Is(err, ErrProductNotFound):
		return huma.Error404NotFound("product not found or inactive")
	case errors.Is(err, ErrInvalidQuantity):
		return huma.Error400BadRequest("quantity must be >= 1")
	case errors.Is(err, ErrOverStock):
		return huma.Error409Conflict("quantity exceeds available stock")
	default:
		logger.Error("cart: unexpected error", "err", err.Error())
		return huma.Error500InternalServerError("internal error")
	}
}
```

- [ ] **Step 5: Write the cart handler**

Create `backend/internal/cart/handler.go`:

```go
package cart

import (
	"context"
	"log/slog"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"

	"github.com/z3tz3r0/ecommerce-space-craft/backend/internal/auth"
	"github.com/z3tz3r0/ecommerce-space-craft/backend/internal/platform/session"
)

// Register registers all cart endpoints. All endpoints are gated by
// auth.RequireAuth.
func Register(api huma.API, svc *Service, authSvc *auth.Service, sess session.Manager, logger *slog.Logger) {
	requireAuth := auth.RequireAuth(api, sess, authSvc, logger)

	huma.Register(api, huma.Operation{
		OperationID: "getCart",
		Method:      http.MethodGet,
		Path:        "/api/cart",
		Summary:     "Fetch the authenticated user's cart",
		Tags:        []string{"Cart"},
		Middlewares: huma.Middlewares{requireAuth},
	}, func(ctx context.Context, _ *struct{}) (*CartOutput, error) {
		u := auth.CurrentUser(ctx)
		c, err := svc.Get(ctx, u.ID)
		if err != nil {
			return nil, mapError(logger, err)
		}
		return &CartOutput{Body: c}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "addCartItem",
		Method:      http.MethodPost,
		Path:        "/api/cart/items",
		Summary:     "Add or increment a cart line (clamped to stock)",
		Tags:        []string{"Cart"},
		Middlewares: huma.Middlewares{requireAuth},
	}, func(ctx context.Context, in *AddCartItemInput) (*CartItemOutput, error) {
		u := auth.CurrentUser(ctx)
		pid, err := uuid.Parse(in.Body.ProductID)
		if err != nil {
			return nil, huma.Error400BadRequest("invalid productId")
		}
		item, err := svc.Add(ctx, u.ID, pid, in.Body.Quantity)
		if err != nil {
			return nil, mapError(logger, err)
		}
		return &CartItemOutput{Body: item}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "setCartItem",
		Method:      http.MethodPatch,
		Path:        "/api/cart/items/{productId}",
		Summary:     "Set the exact quantity of a cart line",
		Tags:        []string{"Cart"},
		Middlewares: huma.Middlewares{requireAuth},
	}, func(ctx context.Context, in *SetCartItemInput) (*CartItemOutput, error) {
		u := auth.CurrentUser(ctx)
		pid, err := uuid.Parse(in.ProductID)
		if err != nil {
			return nil, huma.Error400BadRequest("invalid productId")
		}
		item, err := svc.Set(ctx, u.ID, pid, in.Body.Quantity)
		if err != nil {
			return nil, mapError(logger, err)
		}
		return &CartItemOutput{Body: item}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID:   "removeCartItem",
		Method:        http.MethodDelete,
		Path:          "/api/cart/items/{productId}",
		Summary:       "Remove a cart line",
		Tags:          []string{"Cart"},
		DefaultStatus: http.StatusNoContent,
		Middlewares:   huma.Middlewares{requireAuth},
	}, func(ctx context.Context, in *RemoveCartItemInput) (*struct{}, error) {
		u := auth.CurrentUser(ctx)
		pid, err := uuid.Parse(in.ProductID)
		if err != nil {
			return nil, huma.Error400BadRequest("invalid productId")
		}
		if err := svc.Remove(ctx, u.ID, pid); err != nil {
			return nil, mapError(logger, err)
		}
		return nil, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "mergeCart",
		Method:      http.MethodPost,
		Path:        "/api/cart/merge",
		Summary:     "Merge a guest cart into the authenticated user's cart",
		Tags:        []string{"Cart"},
		Middlewares: huma.Middlewares{requireAuth},
	}, func(ctx context.Context, in *MergeCartInput) (*CartOutput, error) {
		u := auth.CurrentUser(ctx)
		items := make([]MergeItem, 0, len(in.Body.Items))
		for _, it := range in.Body.Items {
			pid, err := uuid.Parse(it.ProductID)
			if err != nil {
				continue
			}
			items = append(items, MergeItem{ProductID: pid, Quantity: it.Quantity})
		}
		c, err := svc.Merge(ctx, u.ID, items)
		if err != nil {
			return nil, mapError(logger, err)
		}
		return &CartOutput{Body: c}, nil
	})
}

// AddCartItemInput is the request body for POST /api/cart/items.
type AddCartItemInput struct {
	Body struct {
		ProductID string `json:"productId" doc:"Product UUID"`
		Quantity  int32  `json:"quantity" minimum:"1" doc:"Quantity to add (clamped to stock)"`
	}
}

// SetCartItemInput is the path+body for PATCH /api/cart/items/{productId}.
type SetCartItemInput struct {
	ProductID string `path:"productId" doc:"Product UUID"`
	Body      struct {
		Quantity int32 `json:"quantity" minimum:"1" doc:"Exact quantity to set"`
	}
}

// RemoveCartItemInput is the path for DELETE /api/cart/items/{productId}.
type RemoveCartItemInput struct {
	ProductID string `path:"productId" doc:"Product UUID"`
}

// MergeCartInput is the request body for POST /api/cart/merge.
type MergeCartInput struct {
	Body struct {
		Items []struct {
			ProductID string `json:"productId"`
			Quantity  int32  `json:"quantity" minimum:"1"`
		} `json:"items"`
	}
}

// CartOutput wraps a Cart for response bodies.
type CartOutput struct {
	Body Cart
}

// CartItemOutput wraps a single Item for response bodies.
type CartItemOutput struct {
	Body Item
}
```

- [ ] **Step 6: Write handler integration tests**

Create `backend/internal/cart/handler_test.go`:

```go
package cart_test

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/alexedwards/scs/v2"
	"github.com/alexedwards/scs/v2/memstore"
	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/adapters/humago"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"

	"github.com/z3tz3r0/ecommerce-space-craft/backend/internal/auth"
	"github.com/z3tz3r0/ecommerce-space-craft/backend/internal/cart"
)

// buildTestServer wires an in-memory session store + fake auth svc + fake
// cart svc behind a real httptest server so cookies and middleware flow
// exactly as they do in cmd/api.
func buildTestServer(t *testing.T, authSvc *auth.Service, cartSvc *cart.Service) *httptest.Server {
	t.Helper()
	mux := http.NewServeMux()
	api := humago.New(mux, huma.DefaultConfig("test", "0.0.0"))
	sess := scs.New()
	sess.Store = memstore.New()
	sess.Lifetime = time.Hour
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	auth.Register(api, authSvc, sess, logger)
	cart.Register(api, cartSvc, authSvc, sess, logger)
	return httptest.NewServer(sess.LoadAndSave(mux))
}

func newClient(t *testing.T) *http.Client {
	t.Helper()
	jar, err := cookiejar.New(nil)
	require.NoError(t, err)
	return &http.Client{Jar: jar}
}

func signupAndAuthenticate(t *testing.T, client *http.Client, baseURL string) {
	t.Helper()
	body := `{"email":"a@b.com","password":"hunter2!!"}`
	resp, err := client.Post(baseURL+"/api/auth/signup", "application/json", bytes.NewBufferString(body))
	require.NoError(t, err)
	resp.Body.Close()
	require.Equal(t, http.StatusCreated, resp.StatusCode)
}

func TestHandler_GetCart_NoSession_Returns401(t *testing.T) {
	authSvc := auth.NewServiceFake(t, auth.FakeRepoAdapter{})
	cartSvc := cart.NewServiceFake(t, cart.FakeRepoAdapter{})
	srv := buildTestServer(t, authSvc, cartSvc)
	defer srv.Close()

	resp, err := http.Get(srv.URL + "/api/cart")
	require.NoError(t, err)
	defer resp.Body.Close()
	require.Equal(t, http.StatusUnauthorized, resp.StatusCode)
}

func TestHandler_GetCart_WithSession_ReturnsEmptyItems(t *testing.T) {
	uid := uuid.New()
	now := time.Now()
	authSvc := auth.NewServiceFake(t, auth.FakeRepoAdapter{
		Create: func(_ context.Context, email, hash string) (auth.FakeRecord, error) {
			return auth.FakeRecord{ID: uid, Email: email, PasswordHash: hash, CreatedAt: now, UpdatedAt: now}, nil
		},
		GetByID: func(_ context.Context, _ uuid.UUID) (auth.FakeRecord, error) {
			return auth.FakeRecord{ID: uid, Email: "a@b.com", CreatedAt: now, UpdatedAt: now}, nil
		},
	})
	cartSvc := cart.NewServiceFake(t, cart.FakeRepoAdapter{
		GetItems: func(_ context.Context, _ uuid.UUID) ([]cart.Item, error) {
			return nil, nil
		},
	})
	srv := buildTestServer(t, authSvc, cartSvc)
	defer srv.Close()

	client := newClient(t)
	signupAndAuthenticate(t, client, srv.URL)

	resp, err := client.Get(srv.URL + "/api/cart")
	require.NoError(t, err)
	defer resp.Body.Close()
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var out cart.Cart
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&out))
	require.Empty(t, out.Items)
}

func TestHandler_AddItem_WithSession_ReturnsItem(t *testing.T) {
	uid := uuid.New()
	pid := uuid.New()
	now := time.Now()
	authSvc := auth.NewServiceFake(t, auth.FakeRepoAdapter{
		Create: func(_ context.Context, email, hash string) (auth.FakeRecord, error) {
			return auth.FakeRecord{ID: uid, Email: email, PasswordHash: hash, CreatedAt: now, UpdatedAt: now}, nil
		},
		GetByID: func(_ context.Context, _ uuid.UUID) (auth.FakeRecord, error) {
			return auth.FakeRecord{ID: uid, Email: "a@b.com", CreatedAt: now, UpdatedAt: now}, nil
		},
	})
	cartSvc := cart.NewServiceFake(t, cart.FakeRepoAdapter{
		GetProduct: func(_ context.Context, _ uuid.UUID) (cart.FakeProduct, error) {
			return cart.FakeProduct{ID: pid, Name: "X-Wing", PriceCents: 12500000, StockQuantity: 10, IsActive: true}, nil
		},
		GetItemQuantity: func(_ context.Context, _, _ uuid.UUID) (int32, error) {
			return 0, nil
		},
		UpsertItem: func(_ context.Context, _, _ uuid.UUID, _ int32) error {
			return nil
		},
	})
	srv := buildTestServer(t, authSvc, cartSvc)
	defer srv.Close()

	client := newClient(t)
	signupAndAuthenticate(t, client, srv.URL)

	body := fmt.Sprintf(`{"productId":%q,"quantity":2}`, pid.String())
	resp, err := client.Post(srv.URL+"/api/cart/items", "application/json", bytes.NewBufferString(body))
	require.NoError(t, err)
	defer resp.Body.Close()
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var out cart.Item
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&out))
	require.Equal(t, pid, out.ProductID)
	require.Equal(t, int32(2), out.Quantity)
}

func TestHandler_DeleteItem_WithSession_Returns204(t *testing.T) {
	uid := uuid.New()
	pid := uuid.New()
	now := time.Now()
	authSvc := auth.NewServiceFake(t, auth.FakeRepoAdapter{
		Create: func(_ context.Context, email, hash string) (auth.FakeRecord, error) {
			return auth.FakeRecord{ID: uid, Email: email, PasswordHash: hash, CreatedAt: now, UpdatedAt: now}, nil
		},
		GetByID: func(_ context.Context, _ uuid.UUID) (auth.FakeRecord, error) {
			return auth.FakeRecord{ID: uid, Email: "a@b.com", CreatedAt: now, UpdatedAt: now}, nil
		},
	})
	cartSvc := cart.NewServiceFake(t, cart.FakeRepoAdapter{
		DeleteItem: func(_ context.Context, _, _ uuid.UUID) error {
			return nil
		},
	})
	srv := buildTestServer(t, authSvc, cartSvc)
	defer srv.Close()

	client := newClient(t)
	signupAndAuthenticate(t, client, srv.URL)

	req, err := http.NewRequest(http.MethodDelete, srv.URL+"/api/cart/items/"+pid.String(), nil)
	require.NoError(t, err)
	resp, err := client.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()
	require.Equal(t, http.StatusNoContent, resp.StatusCode)
}
```

- [ ] **Step 7: Wire cart into `cmd/api/main.go`**

In `backend/cmd/api/main.go`, after the `auth.Register(...)` line add:

```go
	cartRepo := cart.NewPostgres(pool)
	cartSvc := cart.NewService(cartRepo)
	cart.Register(api.Huma, cartSvc, authSvc, sess, logger)
```

Add `cart` to the import block:

```go
	"github.com/z3tz3r0/ecommerce-space-craft/backend/internal/cart"
```

- [ ] **Step 8: Update `cmd/openapi/main.go` to include auth + cart routes**

Replace the file content entirely with:

```go
// Command openapi constructs the Huma API identically to cmd/api but dumps
// the OpenAPI spec to stdout without starting the HTTP server.
package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"

	"github.com/alexedwards/scs/v2"
	"github.com/alexedwards/scs/v2/memstore"
	"github.com/google/uuid"

	"github.com/z3tz3r0/ecommerce-space-craft/backend/internal/auth"
	"github.com/z3tz3r0/ecommerce-space-craft/backend/internal/cart"
	"github.com/z3tz3r0/ecommerce-space-craft/backend/internal/catalog"
	"github.com/z3tz3r0/ecommerce-space-craft/backend/internal/platform/logging"
	"github.com/z3tz3r0/ecommerce-space-craft/backend/internal/platform/server"
)

func main() {
	logger := logging.New("dev", slog.LevelError)
	api := server.New("Spacecraft Store API", "0.1.0", logger, nil)

	sess := scs.New()
	sess.Store = memstore.New()

	catalog.Register(api.Huma, catalog.NewService(nopCatalogRepo{}), logger)
	authSvc := auth.NewService(nopAuthRepo{})
	auth.Register(api.Huma, authSvc, sess, logger)
	cart.Register(api.Huma, cart.NewService(nopCartRepo{}), authSvc, sess, logger)

	out, err := api.Huma.OpenAPI().MarshalJSON()
	if err != nil {
		fmt.Fprintln(os.Stderr, "openapi marshal:", err)
		os.Exit(1)
	}
	if _, err := os.Stdout.Write(out); err != nil {
		fmt.Fprintln(os.Stderr, "openapi write:", err)
		os.Exit(1)
	}

	_ = http.StatusOK // keep net/http import live if scs drops it later
}

// nopCatalogRepo satisfies catalog.Repository with stubs.
type nopCatalogRepo struct{}

func (nopCatalogRepo) GetByID(_ context.Context, _ uuid.UUID) (catalog.Product, error) {
	return catalog.Product{}, nil
}
func (nopCatalogRepo) ListActive(_ context.Context) ([]catalog.Product, error) { return nil, nil }
func (nopCatalogRepo) ListFeatured(_ context.Context, _ int32) ([]catalog.Product, error) {
	return nil, nil
}

// nopAuthRepo satisfies auth.Repository with stubs.
type nopAuthRepo struct{}

func (nopAuthRepo) CreateUser(_ context.Context, _, _ string) (auth.FakeRecord, error) {
	return auth.FakeRecord{}, nil
}
func (nopAuthRepo) GetUserByEmail(_ context.Context, _ string) (auth.FakeRecord, error) {
	return auth.FakeRecord{}, nil
}
func (nopAuthRepo) GetUserByID(_ context.Context, _ uuid.UUID) (auth.FakeRecord, error) {
	return auth.FakeRecord{}, nil
}
```

The `nopAuthRepo` and `nopCartRepo` shapes above use **FakeRecord** (the exported type added in Task 4). But auth's real `Repository` interface uses the unexported `userRecord`, so this won't compile directly. Work around it by constructing the service through the existing `auth.NewServiceFake(nil, ...)` pattern:

Replace the `authSvc := auth.NewService(nopAuthRepo{})` line with:

```go
	authSvc := auth.NewServiceFake(nil, auth.FakeRepoAdapter{})
```

This uses the same `NewServiceFake` helper the tests use — it takes `*testing.T` which accepts nil when only the registration (not actual handler execution) matters. Do the same for cart:

```go
	cart.Register(api.Huma, cart.NewServiceFake(nil, cart.FakeRepoAdapter{}), authSvc, sess, logger)
```

Delete the `nopAuthRepo` and `nopCartRepo` struct definitions from the file — they are no longer needed. Also delete the trailing `_ = http.StatusOK` line and the `net/http` import.

Final `backend/cmd/openapi/main.go`:

```go
// Command openapi constructs the Huma API identically to cmd/api but dumps
// the OpenAPI spec to stdout without starting the HTTP server.
package main

import (
	"context"
	"fmt"
	"log/slog"
	"os"

	"github.com/alexedwards/scs/v2"
	"github.com/alexedwards/scs/v2/memstore"
	"github.com/google/uuid"

	"github.com/z3tz3r0/ecommerce-space-craft/backend/internal/auth"
	"github.com/z3tz3r0/ecommerce-space-craft/backend/internal/cart"
	"github.com/z3tz3r0/ecommerce-space-craft/backend/internal/catalog"
	"github.com/z3tz3r0/ecommerce-space-craft/backend/internal/platform/logging"
	"github.com/z3tz3r0/ecommerce-space-craft/backend/internal/platform/server"
)

func main() {
	logger := logging.New("dev", slog.LevelError)
	api := server.New("Spacecraft Store API", "0.1.0", logger, nil)

	sess := scs.New()
	sess.Store = memstore.New()

	catalog.Register(api.Huma, catalog.NewService(nopCatalogRepo{}), logger)
	authSvc := auth.NewServiceFake(nil, auth.FakeRepoAdapter{})
	auth.Register(api.Huma, authSvc, sess, logger)
	cart.Register(api.Huma, cart.NewServiceFake(nil, cart.FakeRepoAdapter{}), authSvc, sess, logger)

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

// nopCatalogRepo satisfies catalog.Repository with stubs.
type nopCatalogRepo struct{}

func (nopCatalogRepo) GetByID(_ context.Context, _ uuid.UUID) (catalog.Product, error) {
	return catalog.Product{}, nil
}
func (nopCatalogRepo) ListActive(_ context.Context) ([]catalog.Product, error) { return nil, nil }
func (nopCatalogRepo) ListFeatured(_ context.Context, _ int32) ([]catalog.Product, error) {
	return nil, nil
}
```

- [ ] **Step 9: Regenerate the OpenAPI JSON**

```bash
cd backend
go run ./cmd/openapi > openapi.json
```

Expected: `openapi.json` grows to include the four `/api/auth/*` paths and five `/api/cart/*` paths plus their request/response schemas. Verify with `jq '.paths | keys' openapi.json`.

- [ ] **Step 10: Expand the codegen-drift CI file list**

Modify `.github/workflows/backend.yml`. In the `codegen-drift` job, replace the `git diff --exit-code -- ...` block with:

```yaml
      - name: verify no drift
        run: |
          git diff --exit-code -- \
            backend/internal/catalog/db/db.go \
            backend/internal/catalog/db/models.go \
            backend/internal/catalog/db/queries.sql.go \
            backend/internal/auth/db/db.go \
            backend/internal/auth/db/models.go \
            backend/internal/auth/db/queries.sql.go \
            backend/internal/cart/db/db.go \
            backend/internal/cart/db/models.go \
            backend/internal/cart/db/queries.sql.go \
            backend/openapi.json
```

- [ ] **Step 11: Run the full backend test suite**

```bash
cd backend
go test ./... -race -count=1
```

Expected: all tests pass (catalog + auth + cart).

- [ ] **Step 12: Commit**

```bash
git add backend/internal/cart/service.go backend/internal/cart/service_test.go backend/internal/cart/errors.go backend/internal/cart/handler.go backend/internal/cart/handler_test.go backend/cmd/api/main.go backend/cmd/openapi/main.go backend/openapi.json .github/workflows/backend.yml
git commit -m "feat(backend): wire cart endpoints behind RequireAuth + regenerate OpenAPI"
```

---

## Task 8 — Push, PR, CI, merge, Render deploy verify

**Files:** none (git + CI + deploy operations).

---

- [ ] **Step 1: Push the branch**

```bash
cd /home/z3tz3r0/Projects/ecommerce-space-craft
git push -u origin phase-2a/identity-cart-backend
```

- [ ] **Step 2: Open the PR**

```bash
gh pr create --title "phase 2a — identity & cart backend" --body "$(cat <<'EOF'
## Summary

Ship Phase 2a per [docs/superpowers/specs/2026-04-18-phase-2-identity-cart-design.md](docs/superpowers/specs/2026-04-18-phase-2-identity-cart-design.md).

- **New slices**: `internal/auth/` (signup/login/logout/me) and `internal/cart/` (get/add/set/remove/merge) following the Phase 0 DDD-lite shape.
- **Session management**: `internal/platform/session/` wraps `alexedwards/scs/v2` with `pgxstore` so sessions live in the existing Neon pool.
- **Password hashing**: `alexedwards/argon2id` at 64 MB / 1 iter / 2 parallel (Render free-tier tuned).
- **Migrations**: `users` (citext email) and `sessions` + `cart_items` (keyed on `(user_id, product_id)`).
- **OpenAPI**: regenerated. Frontend Plan 2b will pick up the new types.

## Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | /api/auth/signup | no | Create account + start session |
| POST | /api/auth/login | no | Start session for existing user |
| POST | /api/auth/logout | no | Destroy session |
| GET | /api/auth/me | yes | Fetch current user |
| GET | /api/cart | yes | Fetch cart items |
| POST | /api/cart/items | yes | Add/increment line (clamped to stock) |
| PATCH | /api/cart/items/{productId} | yes | Set exact quantity |
| DELETE | /api/cart/items/{productId} | yes | Remove line |
| POST | /api/cart/merge | yes | Merge guest items additively with stock clamp |

## Test plan

- [ ] `go test ./... -race -count=1` green locally
- [ ] CI lint + test + codegen-drift + build jobs green
- [ ] Render deploys on merge; `goose` runs both new migrations automatically
- [ ] `curl -i https://<render-url>/api/auth/me` returns 401
- [ ] `curl -i -c /tmp/j -b /tmp/j -d '{"email":"smoke@x.com","password":"hunter2!!"}' -H 'Content-Type: application/json' https://<render-url>/api/auth/signup` returns 201 + Set-Cookie
- [ ] `curl -i -b /tmp/j https://<render-url>/api/auth/me` returns 200 + user JSON
- [ ] `curl -i -b /tmp/j https://<render-url>/api/cart` returns 200 + `{"items":[]}`
- [ ] `curl -i -b /tmp/j -X POST https://<render-url>/api/auth/logout` returns 204
- [ ] `curl -i -b /tmp/j https://<render-url>/api/auth/me` returns 401

EOF
)"
```

- [ ] **Step 3: Watch CI**

```bash
gh pr checks --watch
```

Expected: `lint`, `test`, `codegen-drift`, `build` all pass.

- [ ] **Step 4: Merge**

After CI is green:

```bash
gh pr merge --squash --delete-branch
```

- [ ] **Step 5: Wait for Render auto-deploy**

Render watches `main` and redeploys on push. Check the status via the Render dashboard or:

```bash
curl -i https://ecommerce-space-craft-api.onrender.com/healthz
```

Expected eventually: 200. Allow 3-5 minutes for the free-tier build + Neon cold start. The goose-on-boot wiring from Phase 0a automatically runs the two new migrations.

- [ ] **Step 6: Smoke-test production via curl**

Replace `<URL>` with the actual Render URL. Use a fresh email each run (or keep reusing `smoke@x.com` — signup will 409 on the second run, which is also a useful assertion).

```bash
URL=https://<your-render-host>
EMAIL=smoke+$(date +%s)@x.com
COOKIES=/tmp/phase2a-smoke.jar
rm -f "$COOKIES"

# Unauthenticated /me → 401
curl -s -o /dev/null -w "%{http_code}\n" "$URL/api/auth/me"

# Signup → 201 + cookie
curl -s -o /dev/null -w "%{http_code}\n" -c "$COOKIES" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"hunter2!!\"}" \
  "$URL/api/auth/signup"

# Me with cookie → 200
curl -s -o /dev/null -w "%{http_code}\n" -b "$COOKIES" "$URL/api/auth/me"

# Cart (empty) → 200 with {"items":[]}
curl -s -b "$COOKIES" "$URL/api/cart"

# Add a real product (grab one from the catalog)
PID=$(curl -s "$URL/api/products" | jq -r '.[0].id')
curl -s -b "$COOKIES" \
  -H "Content-Type: application/json" \
  -d "{\"productId\":\"$PID\",\"quantity\":2}" \
  "$URL/api/cart/items"

# Cart now has the item
curl -s -b "$COOKIES" "$URL/api/cart"

# Logout → 204
curl -s -o /dev/null -w "%{http_code}\n" -b "$COOKIES" -X POST "$URL/api/auth/logout"

# Me after logout → 401
curl -s -o /dev/null -w "%{http_code}\n" -b "$COOKIES" "$URL/api/auth/me"
```

Expected status sequence: `401 201 200 <cart body> <added item body> <cart body with item> 204 401`.

- [ ] **Step 7: Report back**

Once production smoke tests pass, report to the user that Plan 2a is shipped + verified. Plan 2b can be kicked off as a separate dispatch.

---

**End of Plan 2a.**
