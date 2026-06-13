# Data Models · Backend

Postgres, accessed through sqlc-generated typed Go. Schema lives in
[`backend/migrations/`](../backend/migrations/); domain entities (the public
shapes, distinct from DB rows) live in each context's `domain.go`.

## sqlc setup

`backend/sqlc.yaml` (version 2) generates three packages with the pgx/v5 driver
and pointers for nullable columns:

| Package | Path | Context |
|---|---|---|
| `catalogdb` | `internal/catalog/db` | products |
| `authdb` | `internal/auth/db` | users |
| `cartdb` | `internal/cart/db` | cart items |

Type overrides (all three packages): DB `uuid` → `github.com/google/uuid.UUID`
and `timestamptz` → `time.Time`. The auth package additionally maps `citext` →
`string`.

## Tables

### `products` · `20260417120000_create_products.sql` (+ `…_add_products_is_featured`)

| Column | Type | Null | Constraint / default |
|---|---|---|---|
| `id` | uuid | no | PK, `gen_random_uuid()` (pgcrypto) |
| `name` | varchar(100) | no | length ≥ 3 |
| `description` | text | no | |
| `price_cents` | bigint | no | ≥ 0 |
| `image_url` | text | yes | |
| `manufacturer` | text | yes | |
| `crew_amount` | integer | yes | ≥ 0 when set |
| `max_speed` | text | yes | |
| `category` | text | no | enum: Fighter, Freighter, Shuttle, Speeder, Cruiser, Capital Ship |
| `stock_quantity` | integer | no | default 0, ≥ 0 |
| `is_active` | boolean | no | default true |
| `is_featured` | boolean | no | default false |
| `created_at` | timestamptz | no | default `now()` |
| `updated_at` | timestamptz | no | default `now()` |

Indexes: `idx_products_category_active` (category where active),
`idx_products_created_at` (created_at DESC),
`idx_products_featured` (partial, where featured).

### `users` · `20260418130000_create_users.sql`

| Column | Type | Null | Constraint / default |
|---|---|---|---|
| `id` | uuid | no | PK, `gen_random_uuid()` |
| `email` | citext | no | UNIQUE (case-insensitive) |
| `password_hash` | text | no | argon2id encoded string |
| `created_at` | timestamptz | no | default `now()` |
| `updated_at` | timestamptz | no | default `now()` |

Uses the `citext` extension for case-insensitive email uniqueness.

### `cart_items` · `20260418130100_create_sessions_and_cart.sql`

| Column | Type | Null | Constraint / default |
|---|---|---|---|
| `user_id` | uuid | no | FK → `users(id)` ON DELETE CASCADE |
| `product_id` | uuid | no | FK → `products(id)` ON DELETE CASCADE |
| `quantity` | integer | no | > 0 |
| `created_at` | timestamptz | no | default `now()` |
| `updated_at` | timestamptz | no | default `now()` |

Composite primary key `(user_id, product_id)`.

### `sessions` · `20260418130100_create_sessions_and_cart.sql`

Owned by `alexedwards/scs` + `pgxstore`, not hand-queried by the app.

| Column | Type | Null | Notes |
|---|---|---|---|
| `token` | text | no | PK |
| `data` | bytea | no | serialized session payload |
| `expiry` | timestamptz | no | indexed (`sessions_expiry_idx`) for the cleanup sweeper |

## Domain entities (public shapes)

- **`catalog.Product`** (`internal/catalog/domain.go`): `ID`, `Name`,
  `Description`, `PriceCents int64`, `ImageURL *string`, `Manufacturer *string`,
  `CrewAmount *int32`, `MaxSpeed *string`, `Category` (enum), `StockQuantity`,
  `IsActive`, `IsFeatured`, `CreatedAt`, `UpdatedAt`.
  Errors: `ErrProductNotFound`, `ErrInvalidID`.
- **`auth.User`** (`internal/auth/domain.go`): `ID`, `Email`, `CreatedAt`,
  `UpdatedAt`. `PasswordHash` is deliberately excluded from the public type.
  `MinPasswordLength = 8`. Errors: `ErrInvalidCredentials`, `ErrEmailTaken`,
  `ErrWeakPassword`, `ErrUserNotFound`, `ErrNotAuthenticated`.
- **`cart.Item` / `cart.Cart` / `cart.MergeItem`** (`internal/cart/domain.go`):
  `Item{ProductID, Name, PriceCents int64, ImageURL *string, Quantity int32,
  StockQuantity int32}`; `Cart` wraps `[]Item`; `MergeItem{ProductID, Quantity}`.
  Errors: `ErrProductNotFound`, `ErrInvalidQuantity`, `ErrOverStock`.

## Queries (sqlc)

- **catalog**: `GetProductByID` (active products only · an inactive id returns
  not-found), `ListActiveProducts`, `ListFeaturedProducts`, `InsertProduct`,
  `TruncateProducts`.
- **auth**: `CreateUser`, `GetUserByEmail`, `GetUserByID`.
- **cart**: `GetCartItems` (joins products, filters active), `GetProductForCart`,
  `LockProductForCart` (`FOR UPDATE`), `UpsertCartItem` (on-conflict),
  `GetCartItemQuantity`, `DeleteCartItem`, `ClearCart`.

> Not yet present: no orders, line-item-snapshot, or payment tables. Phase 3
> (checkout & orders) is design-spec only.
