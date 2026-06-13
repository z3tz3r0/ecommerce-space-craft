# API Contracts · Backend

Generated with Huma v2. The machine-readable source of truth is
[`backend/openapi.json`](../backend/openapi.json); the frontend client is
generated from it. This page is the human summary.

## Base

- Local: `http://localhost:8080`
- Path prefix: `/api` (except `/health`)
- Auth: cookie session named `session` (declared in OpenAPI as an `apiKey` in
  cookie). Browser clients send it automatically with `credentials: include`.

## Auth · `internal/auth/handler.go`

| Method | Path | Auth | Success | Purpose |
|---|---|---|---|---|
| POST | `/api/auth/signup` | public | 201 | Create account, start session, return `User` |
| POST | `/api/auth/login` | public | 200 | Log in, renew session token, return `User` |
| POST | `/api/auth/logout` | public | 204 | Destroy the current session |
| GET | `/api/auth/me` | required | 200 | Return the authenticated `User` |

Notes: both signup and login renew the session token (session-fixation defense).
Signup calls `RenewToken` before the DB write, so a failed renew cannot leave an
orphaned account. Login verifies credentials first, then renews. Login also maps
`ErrUserNotFound` to `ErrInvalidCredentials` (401) and uses a dummy argon2id hash
on the not-found path, so timing does not reveal whether an email exists.

## Cart · `internal/cart/handler.go`

All cart endpoints require authentication (`RequireAuth` middleware).

| Method | Path | Success | Purpose |
|---|---|---|---|
| GET | `/api/cart` | 200 | Fetch the user's cart (`Cart`) |
| POST | `/api/cart/items` | 200 | Add or increment a line; quantity clamped to stock |
| PATCH | `/api/cart/items/{productId}` | 200 | Set an exact line quantity |
| DELETE | `/api/cart/items/{productId}` | 204 | Remove a line |
| POST | `/api/cart/merge` | 200 | Merge a guest cart into the user's cart |

Notes: add/set/merge are atomic via `pgx.BeginFunc` + `SELECT … FOR UPDATE`
(`LockProductForCart`). The clamp `target = min(existing + delta, stock)` runs
inside the transaction. Merge sorts inputs by `ProductID` before locking to keep
lock-acquisition order deterministic and avoid deadlocks. The item-level writes
(`POST`/`PATCH /api/cart/items`) return the affected `Item`, while `GET /api/cart`
and `POST /api/cart/merge` return the full `Cart`.

## Catalog · `internal/catalog/handler.go`

| Method | Path | Auth | Success | Purpose |
|---|---|---|---|---|
| GET | `/api/products` | public | 200 | List active products. `?featured=true` returns featured only with `limit` 1–24 applied. `limit` is ignored when not featured |
| GET | `/api/products/{id}` | public | 200 | Fetch one product by UUID |

## System · `internal/platform/server/health.go`

| Method | Path | Auth | Success | Purpose |
|---|---|---|---|---|
| GET | `/health` | public | 200 | Liveness probe (`status: "ok"`); used by Render `healthCheckPath` |

## Error mapping

Each context owns an `errors.go` `mapError` that converts domain sentinels to
Huma errors:

| Context | Sentinel | HTTP |
|---|---|---|
| catalog | `ErrProductNotFound` | 404 |
| catalog | `ErrInvalidID` | 400 |
| cart | `ErrProductNotFound` | 404 |
| cart | `ErrInvalidQuantity` | 400 |
| cart | `ErrOverStock` | 409 |
| auth | `ErrInvalidCredentials` | 401 |
| auth | `ErrEmailTaken` | 409 |
| auth | `ErrWeakPassword` | 400 |
| auth | `ErrNotAuthenticated` | 401 |
| auth | `ErrUserNotFound` | 404 |

Any unmapped error is logged and returned as 500.

> Not yet present: no checkout, order, or payment endpoints exist. Phase 3
> (checkout & orders) is design-spec only.
