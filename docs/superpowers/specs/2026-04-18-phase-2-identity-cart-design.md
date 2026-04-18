# Phase 2 — Identity & Cart: Design Spec

**Date:** 2026-04-18
**Status:** Approved (pending user review of this written spec)
**Phase:** 2 of 6
**Owner:** z3tz3r0
**Predecessors:**
- [Phase 0 — Foundation](./2026-04-17-phase-0-foundation-design.md)
- [Phase 1 — Catalog](./2026-04-18-phase-1-catalog-design.md)

---

## Project context

Phases 0 and 1 are merged + browser-verified in production. The site at `https://ecommerce-space-craft.vercel.app/` shows a working catalog with filter/sort/search and a product detail page — all public, no auth, no cart action. Phase 2 introduces the first user-gated surfaces: account creation, session-based login, and a per-user cart. Phase 3 (Checkout & Orders) will consume Phase 2's cart as its starting point.

Project discipline from prior phases is unchanged:

- **Layout-only Tailwind** through Phase 3 (no color, typography, motion utilities — shadcn primitive neutral defaults only). Phase 4 is the first styling pass.
- **FSD boundaries** enforced by Steiger.
- **DDD-lite** vertical slices on the backend under `backend/internal/<context>/`.
- **Codegen drift = CI failure**; regenerated files committed.
- **Free-tier hard constraint** — no paid-only services.
- **No email infrastructure in Phase 2** — password reset and email verification are explicitly deferred.

## Phase 2 scope

### In scope

| Capability | Notes |
|---|---|
| Signup with email + password | Unique email (citext). Password min 8 chars. argon2id hashing. Starts a session immediately. |
| Login with email + password | Same shape as signup; starts a session; returns the current user. |
| Logout | Destroys server-side session; clears cookie. |
| `me` endpoint | Returns the current user or 401. Used by the frontend to gate protected UI. |
| Session cookies | HttpOnly, SameSite=Lax, Secure in prod, 30-day rolling lifetime. |
| Account page | Minimal: email + created date + logout button. Phase 3 adds order history. |
| Guest cart | `zustand + persist` client store (localStorage). "Add to cart" works before signup. |
| Server cart for logged-in users | Per-user, persisted in Postgres. Source of truth once logged in. |
| Guest → server cart merge on login | Additive — union items; sum quantities; clamp to current `stock_quantity`. |
| "Add to cart" affordance | Button on ProductDetailPage only. Phase 4 polish may add quick-add. |
| Cart page `/cart` | Line items with +/- quantity controls, remove button, subtotal, disabled "Checkout" button (Phase 3). Visible to guests (shows localStorage cart). |
| Cart button in site header | Shows current item count as a neutral badge. Routes to `/cart`. |
| Stock-quantity enforcement | Server rejects quantities above `stock_quantity`. Frontend clamps on the controls. |
| Protected routes | `/account` redirects to `/login` if unauthenticated. |

### Explicitly out of scope (deferred)

| Deferral | Why | Picked back up in |
|---|---|---|
| Password reset flow | Needs email infrastructure (SendGrid, Resend, etc.) and a verified sender domain. Out of free-tier reach for Phase 2. | Phase 6 (Admin) — adds a manual admin-triggered reset button. Email-based self-serve reset is a post-roadmap add-on. |
| Email verification on signup | Same infrastructure problem. | Same as above. |
| Profile edit (change email, change password) | YAGNI for Phase 2 scope. | Phase 5 (Engagement) or Phase 6. |
| Social login (Google, GitHub) | Adds OAuth client setup, redirect URIs in prod, extra surface area. Post-roadmap. | Post-roadmap if ever. |
| Order history on account page | No orders exist until Phase 3. | Phase 3. |
| Quick-add on catalog cards | Extra surface area + stock validation at card level. Phase 4 polish. | Phase 4. |
| Cart drawer overlay (on every page) | Adds a widget + its state management. Phase 4 polish. | Phase 4. |
| Multi-session / "sign out everywhere" | Phase 2 uses single-session-cookie model. | Post-roadmap. |
| Remember-me checkbox | Default 30-day rolling session covers the same UX. | Post-roadmap. |
| Rate limiting on auth endpoints | Render's free tier has limited observability. Deferred to Phase 4+ polish (alongside any other security hardening pass). | Phase 4+. |
| CSRF token on form submits | SameSite=Lax cookie + same-origin XHR (Vercel FE → Render BE across subdomains) — per OWASP, SameSite=Lax is sufficient protection for the common CSRF vectors at this scope. | Revisit if the threat model changes. |

---

## Donor research summary

The following repos informed the design. None are ported wholesale; specific patterns are lifted from each.

### Primary donor for cart architecture — `kiettt23/vendoor`

Vendoor is a NextJS + Prisma + FSD marketplace with a well-shaped `entities/cart` slice. We port the **zustand + persist pattern** with these adaptations:

| Vendoor | Our adaptation |
|---|---|
| `entities/cart/model/store.ts` — zustand store with persist middleware, validate-quantity logic, toast on failure | Direct port, minus vendor-multi-tenant fields. Toast via `sonner` (instead of vendoor's custom). |
| `entities/cart/model/types.ts` — `CartItem` + `CartStore` interfaces | Slimmer shape — single-tenant, no variant/vendor fields. |
| `entities/cart/api/actions.ts` — Next server action for stock sync | Replaced with TanStack Query mutations against our REST API. |
| `entities/cart/lib/utils.ts` — helpers | Keep for quantity/subtotal helpers. |

Vendoor's NextJS server actions don't port; the zustand pattern and the cart-store interface shape do.

### UX reference — `basir/next-pg-shadcn-ecommerce`

83★ NextJS + shadcn tutorial repo. Used for the signup/login/account/cart-button UX shape and the shadcn Form + react-hook-form + zod integration pattern. The NextAuth implementation does not port to our Go backend; we use native scs sessions instead. What we lift:

- Cart-button-with-count-badge in site header
- Sign-in form layout (email + password + submit)
- User menu (dropdown with "Account" + "Logout" actions)
- shadcn Form primitive usage with react-hook-form + zodResolver

### Backend session library — `alexedwards/scs` (2545★)

The canonical Go HTTP session library. Supports pluggable stores; we use the `pgxstore` adapter so sessions live in the existing Neon Postgres. Features we use:

- Automatic session loading/saving via middleware
- Session token regeneration on login (prevents session fixation)
- Idle + absolute timeouts
- HttpOnly, SameSite, Secure cookie config

### Backend password hashing — `alexedwards/argon2id` (632★, same author)

Thin wrapper around `golang.org/x/crypto/argon2` with OWASP-recommended defaults (argon2id variant, 1 iteration, 64 MB memory, 4 parallelism, 32-byte salt, 32-byte key). Params are centralized so upgrades are one line.

### Rejected alternatives (for the record)

| Library | Why not |
|---|---|
| `gorilla/sessions` | scs is smaller, faster, more actively maintained. |
| `golang-jwt/jwt` with token auth | JWT requires client-side token handling, bigger client code, harder revocation. Cookie sessions are strictly simpler. |
| `bcrypt` | Still safe but argon2id is OWASP's current recommendation and has better GPU/ASIC resistance. Cheap to use argon2id since both sides integrate the same way. |
| `NextAuth` / `Auth.js` | NextJS-only idioms. Doesn't port to Go backend. |
| `better-auth` (vendoor's choice) | Cross-framework auth lib but primarily JS/TS ecosystem; doesn't help with a Go backend. |
| `Redis` for session store | Would need another paid service / Render add-on. Postgres is already provisioned. |

---

## Locked decisions for Phase 2

These were settled during brainstorming. They are not relitigated in the body of this spec.

| Decision | Choice | Rejected alternatives & why |
|---|---|---|
| Auth mechanism | **Cookie sessions via scs** | JWT in httpOnly cookie (unnecessary complexity); JWT in localStorage (XSS exposure). |
| Session store | **Postgres via `scs/pgxstore`** | Redis (another service); in-memory (no persistence across restarts). |
| Password hashing | **argon2id via `alexedwards/argon2id`** | bcrypt (still safe but older); scrypt (less mainstream). |
| Password reset flow | **Deferred** | Email infra out of free-tier scope. |
| Cart persistence model | **Hybrid — zustand+localStorage for guests, server for logged-in, additive merge on login** | Server-only (blocks add-to-cart funnel); client-only (loses cart across devices). |
| Cart DB schema | **Single `cart_items` keyed on `(user_id, product_id)` unique** | Separate `carts` + `cart_items` (extra join, no payoff at this scope); JSON blob (breaks referential integrity). |
| Guest→server merge | **Additive — union items, sum quantities, clamp to `stock_quantity`** | Replace (loses existing server cart); ignore (surprises the user). |
| Account page scope | **Email + created date + logout** | Profile edit / order history (later phases). |
| Email verification | **Format + DB uniqueness only** | Deliverability check or link-verification (needs email infra). |
| Signup fields | **Email + password only** | +name (YAGNI); +confirm-password (client-only UX hint, not worth the form state). |
| Password rules | **8+ chars, no complexity requirements** | NIST breach-check (needs external service); complexity rules (reduce entropy and frustrate users). |
| "Add to cart" UX | **Button on ProductDetailPage only** | Quick-add on cards / drawer (Phase 4 polish). |
| Cart page route | **`/cart` (public; guests see localStorage cart)** | Auth-gated (blocks funnel); drawer-only (state complexity). |
| Session cookie config | **HttpOnly + SameSite=Lax + Secure in prod + 30-day rolling** | Strict (breaks cross-subdomain FE/BE); JS-readable (XSS exposure). |
| Guest cart storage | **zustand + `persist` middleware → localStorage** | sessionStorage (dies on tab close); none (no guest cart). |
| CSRF protection | **SameSite=Lax cookie + same-origin XHR, no token layer** | Double-submit cookie / synchronizer token (unnecessary at this threat model). |
| Rate limiting on auth | **Deferred to Phase 4+** | Per-endpoint rate limit middleware (adds state + tuning; not valuable until real traffic). |
| Frontend state (auth) | **TanStack Query — `useAuth()` wraps the `me` query + login/signup/logout mutations** | Zustand for auth (would duplicate cache invalidation logic TanStack already has). |
| Frontend state (cart) | **Zustand for guest cart; TanStack Query mutations for server cart** | All-zustand (needs hand-rolled sync); all-TanStack (no offline persistence path). |
| Form library | **react-hook-form + `@hookform/resolvers` + zod** | Native `onSubmit` (verbose error state); Formik (older, bigger). |
| Toast library | **sonner** | shadcn's built-in toast (deprecated in favor of sonner per shadcn docs). |

---

## Section 1 — Backend changes (Plan 2a)

### 1.1 Dependencies

Add to `backend/go.mod`:

- `github.com/alexedwards/scs/v2` — session middleware
- `github.com/alexedwards/scs/pgxstore` — Postgres session store using the existing pgx pool
- `github.com/alexedwards/argon2id` — password hashing

No other runtime deps. All three are under Alex Edwards's maintenance, same author ships coherent versions.

### 1.2 Migrations

Two new goose migrations under `backend/migrations/`.

**Migration A — `<timestamp>_create_users.sql`:**

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

`citext` gives case-insensitive email uniqueness without manual lowercasing. OWASP-aligned.

**Migration B — `<timestamp>_create_sessions_and_cart.sql`:**

```sql
-- +goose Up
-- scs/pgxstore table (schema from the scs docs, verbatim)
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

`ON DELETE CASCADE` on both `user_id` and `product_id` keeps the cart in sync when products are retired or users deleted.

### 1.3 `internal/auth/` DDD-lite slice

New package following the Phase 0 shape.

```
backend/internal/auth/
├── domain.go       (User struct, sentinel errors, Category-style type aliases)
├── service.go      (Signup, Login, Logout, Me methods)
├── repository.go   (Repository interface)
├── postgres.go     (Postgres implementation)
├── queries.sql     (sqlc queries)
├── db/             (sqlc-generated code)
├── handler.go      (Huma routes)
├── middleware.go   (RequireAuth middleware — returns 401 if no session)
└── service_test.go
```

**`domain.go`** types:

```go
type User struct {
    ID        uuid.UUID `json:"id"`
    Email     string    `json:"email"`
    CreatedAt time.Time `json:"createdAt"`
    UpdatedAt time.Time `json:"updatedAt"`
    // PasswordHash intentionally NOT exposed.
}

var (
    ErrInvalidCredentials = errors.New("invalid email or password")
    ErrEmailTaken         = errors.New("email already registered")
    ErrWeakPassword       = errors.New("password must be at least 8 characters")
    ErrNotAuthenticated   = errors.New("not authenticated")
)
```

**`service.go`** methods:

```go
func (s *Service) Signup(ctx, email, password) (User, error)
func (s *Service) Login(ctx, email, password) (User, error)
func (s *Service) GetByID(ctx, id uuid.UUID) (User, error)   // used by RequireAuth middleware to hydrate current user
```

Logout is a pure session operation — no service method needed; the handler clears the session directly.

**Password validation:** `len(password) >= 8` — no complexity rules. Too-short passwords return `ErrWeakPassword` (400).

**Login:** constant-time comparison via argon2id's `ComparePasswordAndHash`. Failed login returns `ErrInvalidCredentials` regardless of whether the email exists — prevents user enumeration.

### 1.4 Session wiring — `internal/platform/session/`

New package to own the scs setup so it can be injected into multiple handlers.

```go
// session.Manager wraps scs.SessionManager with our config.
type Manager = *scs.SessionManager

func New(pool *pgxpool.Pool) Manager {
    s := scs.New()
    s.Store = pgxstore.New(pool)
    s.Lifetime = 30 * 24 * time.Hour       // 30-day absolute
    s.IdleTimeout = 7 * 24 * time.Hour      // 7-day rolling
    s.Cookie.Name = "session"
    s.Cookie.HttpOnly = true
    s.Cookie.Secure = true                   // flipped to false in dev via env
    s.Cookie.SameSite = http.SameSiteLaxMode
    s.Cookie.Path = "/"
    return s
}
```

`cmd/api/main.go` wires this in before the Huma API registration and adds `LoadAndSave` middleware to the router. The frontend's existing `credentials: "include"` on openapi-fetch already sends the cookie back.

**Dev vs prod cookie:** `Secure = true` is fine in prod (HTTPS). Locally, Vite dev server is `http://localhost:5173` — set `Secure = false` when `APP_ENV != "production"`.

### 1.5 Auth handlers

```
POST /api/auth/signup   {email, password}   → 201 {user} + session cookie
POST /api/auth/login    {email, password}   → 200 {user} + session cookie
POST /api/auth/logout                        → 204 + clears session cookie
GET  /api/auth/me                            → 200 {user} | 401 if not authenticated
```

All Huma operations. Input validation via Huma tags (`format:"email"`, `minLength:"8"`). Error mapping:
- `ErrInvalidCredentials` → 401
- `ErrEmailTaken` → 409
- `ErrWeakPassword` → 400 (Huma catches `minLength` first; this is defense in depth)
- Everything else → 500 via `mapError`

On successful signup or login, `session.RenewToken(ctx)` regenerates the token (prevents session fixation), then `session.Put(ctx, "userID", user.ID.String())` stores the current user.

### 1.6 `internal/cart/` DDD-lite slice

New package following the Phase 0 shape.

```
backend/internal/cart/
├── domain.go
├── service.go
├── repository.go
├── postgres.go
├── queries.sql
├── db/
├── handler.go
└── service_test.go
```

**`domain.go`** types:

```go
type Item struct {
    ProductID     uuid.UUID `json:"productId"`
    Name          string    `json:"name"`
    PriceCents    int64     `json:"priceCents"`
    ImageURL      *string   `json:"imageUrl,omitempty"`
    Quantity      int32     `json:"quantity"`
    StockQuantity int32     `json:"stockQuantity"` // snapshot; frontend uses for clamping
}

type Cart struct {
    Items []Item `json:"items"`
}

var (
    ErrProductNotFound = errors.New("cart: product not found or inactive")
    ErrInvalidQuantity = errors.New("cart: quantity must be >= 1")
    ErrOverStock       = errors.New("cart: quantity exceeds available stock")
)
```

The `Item` shape is deliberately "what the FE needs to render a cart line" — joins `cart_items` → `products` at query time so the FE gets current prices/stock without a second roundtrip.

**`service.go`** methods:

```go
func (s *Service) Get(ctx, userID) (Cart, error)
func (s *Service) Add(ctx, userID, productID, quantity) (Item, error)      // add or increment; clamps to stock
func (s *Service) Set(ctx, userID, productID, quantity) (Item, error)      // set exact quantity; validates stock
func (s *Service) Remove(ctx, userID, productID) error
func (s *Service) Merge(ctx, userID, items []MergeItem) (Cart, error)      // guest → server on login
```

`Merge` semantics: for each `(productID, quantity)` in the input, upsert into `cart_items` with the sum of (existing + incoming, capped at product's current stock). Products that don't exist or are inactive are silently skipped. Result is the full merged cart.

**sqlc queries:** `UpsertCartItem`, `GetCartItems` (JOIN on products), `SetCartItem`, `DeleteCartItem`, `ClearCart`.

### 1.7 Cart handlers

```
GET    /api/cart                            → {items} (auth required)
POST   /api/cart/items       {productId, quantity}  → {item} (auth required)
PATCH  /api/cart/items/{productId}  {quantity}      → {item} (auth required)
DELETE /api/cart/items/{productId}                  → 204 (auth required)
POST   /api/cart/merge       {items: [...]}         → {items} (auth required)
```

All cart endpoints pass through the `RequireAuth` middleware defined in `internal/auth/middleware.go`. 401 if no session.

### 1.8 CORS

No change. Existing allowlist covers both origins. The Phase 0b CORS fix (trim trailing slashes) is unchanged. `credentials: "include"` on the frontend side is already set from Phase 0b.

### 1.9 Tests

Per the existing Phase 0 convention:
- `auth/service_test.go` — table-driven tests for signup (email taken, weak password, success), login (invalid, success), GetByID.
- `cart/service_test.go` — table-driven tests for Get (empty, populated), Add (new, increment, over-stock, inactive-product), Set (negative, over-stock, success), Remove, Merge (empty-both, guest-only, merge-with-existing, stock-clamp, skip-inactive).
- Handler tests via `httptest` against the Huma-registered routes — cover the auth happy path (signup → cookie received → me returns user → logout clears) and the cart auth-gating (401 without cookie, 200 with cookie).

Target ≥ 80% coverage on the new packages.

### 1.10 OpenAPI regeneration

After handler changes, `make openapi-dump` regenerates `backend/openapi.json`. The new paths and schemas land in the committed artifact. Frontend codegen in Plan 2b consumes them.

---

## Section 2 — Frontend architecture (Plan 2b)

### 2.1 Routing

```
/                         HomePage           (unchanged)
/products                 CatalogPage        (unchanged)
/products/:id             ProductDetailPage  + add-to-cart button
/cart                     CartPage           (NEW — public, shows guest or server cart)
/login                    LoginPage          (NEW)
/signup                   SignupPage         (NEW)
/account                  AccountPage        (NEW — auth-gated; redirects to /login if 401)
```

Auth-gating happens in the route element via a small `RequireAuth` component that uses `useAuth()` — if `isError` (401), it renders `<Navigate to="/login" replace />`. No loader/action-based route protection needed.

### 2.2 FSD layer placement

```
src/
├── entities/
│   ├── product/          (unchanged, add nothing here)
│   ├── user/             (NEW)
│   │   ├── api/
│   │   │   ├── useAuth.ts         (me query + login/signup/logout mutations)
│   │   │   └── user-keys.ts
│   │   ├── model/
│   │   │   └── types.ts           (re-export User from OpenAPI)
│   │   └── index.ts
│   └── cart/             (NEW)
│       ├── api/
│       │   ├── useServerCart.ts      (GET /api/cart query)
│       │   ├── useCartMutations.ts   (POST/PATCH/DELETE/MERGE mutations)
│       │   └── cart-keys.ts
│       ├── model/
│       │   ├── types.ts              (CartItem, guest + server shapes)
│       │   ├── guest-store.ts        (zustand + persist, port from vendoor)
│       │   └── subtotal.ts           (pure helper: items → cents)
│       ├── lib/
│       │   └── cart-facade.ts        (useCart() — routes to guest or server based on auth state)
│       └── index.ts
│
├── features/
│   ├── auth-login/               (NEW — LoginForm)
│   ├── auth-signup/              (NEW — SignupForm)
│   ├── auth-logout/              (NEW — LogoutButton)
│   └── cart-actions/             (NEW — AddToCartButton + QuantityStepper)
│
├── widgets/
│   ├── site-header/              (NEW — logo + nav + cart button + auth menu)
│   ├── cart-line/                (NEW — one row in the cart table)
│   ├── ...existing widgets
│
├── pages/
│   ├── login/                    (NEW)
│   ├── signup/                   (NEW)
│   ├── account/                  (NEW)
│   ├── cart/                     (NEW)
│   ├── ...existing pages
│
└── shared/
    ├── ui/                (add: form, label, separator, dialog, dropdown-menu, sonner)
    └── lib/               (add: use-require-auth.ts → small navigate-on-401 helper)
```

### 2.3 Cart facade — the one tricky piece

`entities/cart/lib/cart-facade.ts` exports a single `useCart()` hook that downstream UI consumes without caring whether the user is logged in:

```ts
export function useCart(): {
  items: CartItem[]
  isLoading: boolean
  add: (productId: string, quantity?: number) => Promise<void>
  set: (productId: string, quantity: number) => Promise<void>
  remove: (productId: string) => Promise<void>
  clear: () => Promise<void>
  subtotalCents: number
}
```

Internally it reads `useAuth().data` to decide:

- **Logged in**: delegates to `useServerCart()` (TanStack Query) and the mutation hooks.
- **Guest**: delegates to the `useGuestCart` zustand store.

The shape is identical so `CartPage`, `AddToCartButton`, `SiteHeader.CartButton` don't care.

### 2.4 Merge on login — the other tricky piece

When the user signs up or logs in, the login/signup mutation's `onSuccess` runs:

```ts
const guestItems = useGuestCartStore.getState().items
if (guestItems.length > 0) {
  await cartMergeMutation.mutateAsync({
    items: guestItems.map((i) => ({ productId: i.productId, quantity: i.quantity })),
  })
  useGuestCartStore.getState().clear()
}
queryClient.invalidateQueries({ queryKey: cartKeys.all })
queryClient.invalidateQueries({ queryKey: userKeys.me })
```

Cleared guest store + invalidated server cart query = `useCart()` seamlessly switches to the server view.

### 2.5 Guest cart store (port from vendoor)

```ts
// entities/cart/model/guest-store.ts
interface GuestCartItem {
  productId: string
  name: string
  priceCents: number
  imageUrl?: string
  quantity: number
  stockQuantity: number  // snapshot at add-time; server refreshes on next fetch
}

interface GuestCartStore {
  items: GuestCartItem[]
  add: (item: Omit<GuestCartItem, "quantity"> & { quantity?: number }) => void
  set: (productId: string, quantity: number) => void
  remove: (productId: string) => void
  clear: () => void
}

export const useGuestCartStore = create<GuestCartStore>()(
  persist(
    (set, get) => ({ /* ... */ }),
    { name: "guest-cart" },
  ),
)
```

Quantity validation: on `add` and `set`, clamp to `stockQuantity` (the value captured when the item was added). A dedicated `useStockSync()` hook fetches current stock for visible cart items periodically (or on cart page mount) and reconciles.

### 2.6 `useAuth()` — the root auth hook

```ts
// entities/user/api/useAuth.ts
export function useAuth() {
  const meQuery = useQuery<User>({
    queryKey: userKeys.me(),
    queryFn: async () => {
      const { data, error } = await api.GET("/api/auth/me")
      if (error) throw error                     // 401 → isError
      if (!data) throw new Error("no user")
      return data
    },
    retry: false,                                // 401 is terminal, not transient
    staleTime: 5 * 60 * 1000,                    // 5 min; cart mutations invalidate when needed
  })
  return meQuery
}

// Mutation hooks emit the `onSuccess` merge cascade (Section 2.4) and invalidate the `me` query.
export function useLoginMutation() { /* ... */ }
export function useSignupMutation() { /* ... */ }
export function useLogoutMutation() { /* ... */ }
```

The `useAuth()` result drives:
- `widgets/site-header` — shows Login/Signup links or user menu with Logout
- `RequireAuth` component — redirects if 401
- `cart-facade` — routes to guest vs server cart

### 2.7 Pages

**`LoginPage` / `SignupPage`** — centered card with a shadcn `Form`:

- `useForm<{email: string; password: string}>({ resolver: zodResolver(schema) })`
- `schema` = `z.object({ email: z.string().email(), password: z.string().min(8) })`
- `onSubmit` calls the mutation
- Error from server (401, 409) shown as form-level error
- Success: mutation's `onSuccess` triggers guest-cart merge then `navigate("/")`

Cross-link between the two: "Already have an account? Log in" / "Need an account? Sign up".

**`AccountPage`** — wrapped in `<RequireAuth>`:

```
<h1>Account</h1>
<dl>
  <dt>Email</dt> <dd>{user.email}</dd>
  <dt>Member since</dt> <dd>{formatDate(user.createdAt)}</dd>
</dl>
<LogoutButton />
```

**`CartPage`** — public. Uses `useCart()`:

- Empty state: "Your cart is empty" + "Browse catalog" link
- Populated: table of `CartLine` widgets + subtotal + `<Button disabled>Checkout (coming Phase 3)</Button>`

### 2.8 `widgets/site-header`

Site-wide header rendered inside the `App` layout component. Shape:

- Logo / wordmark (text-only in layout-only phase) → `/`
- "Catalog" link → `/products`
- Right side: cart button (with item count badge, links to `/cart`) + auth menu

Auth menu behavior:
- `useAuth().isLoading` → `<Skeleton className="h-9 w-20" />`
- `isError` (401) → `<Link to="/login">Log in</Link> <Link to="/signup">Sign up</Link>`
- `isSuccess` → shadcn `DropdownMenu` showing email + "Account" + "Logout"

Cart count: `useCart().items.reduce((sum, i) => sum + i.quantity, 0)`.

### 2.9 Add-to-cart on ProductDetailPage

Single button, delegates to the facade:

```tsx
<Button onClick={() => cart.add(product.id, 1)} disabled={product.stockQuantity === 0}>
  {product.stockQuantity === 0 ? "Out of stock" : "Add to cart"}
</Button>
```

On success: sonner toast `"{product.name} added to cart"` with a "View cart" action that routes to `/cart`.

### 2.10 Tests (Vitest + RTL)

Per the spec convention, ≥ 80% coverage on new feature code.

| File | Tests |
|---|---|
| `entities/user/api/useAuth.test.tsx` | me query success / 401, login mutation flow (mocked API) |
| `entities/cart/model/guest-store.test.ts` | add new, increment existing, set, remove, clear, stock-clamp |
| `entities/cart/model/subtotal.test.ts` | empty → 0, single, multi, handles large |
| `entities/cart/lib/cart-facade.test.tsx` | routes to guest when 401, routes to server when auth, subtotal matches |
| `features/auth-login/LoginForm.test.tsx` | validates email+password, submits, shows server error |
| `features/auth-signup/SignupForm.test.tsx` | same as login + weak-password client validation |
| `features/cart-actions/AddToCartButton.test.tsx` | disabled when out of stock, calls add on click, toast on success |
| `features/cart-actions/QuantityStepper.test.tsx` | increments, clamps to stock, decrements, removes at 0 |
| `widgets/site-header/SiteHeader.test.tsx` | guest state (login/signup links), loading state, logged-in (dropdown) |
| `widgets/cart-line/CartLine.test.tsx` | renders fields, calls stepper on +/-, calls remove on button |
| `pages/login/LoginPage.test.tsx` | integration — mounts form, happy path |
| `pages/signup/SignupPage.test.tsx` | integration — mounts form, happy path |
| `pages/account/AccountPage.test.tsx` | redirects on 401, renders on 200 |
| `pages/cart/CartPage.test.tsx` | empty state, populated, guest path, server path |

### 2.11 Codegen

After Plan 2a's OpenAPI regeneration lands on `main`, Plan 2b's Task 1 runs `make codegen-ts` to pick up the new `User`, `Cart`, and auth/cart endpoint types.

---

## Section 3 — Deployment

### 3.1 Backend (Render)

Two new migrations run automatically via the goose-on-boot wiring from Phase 0a. Both are additive — no downtime risk on the live service.

New env var on Render: `APP_ENV=production` (so session cookies get `Secure: true`). If not set, the backend defaults to non-secure (dev mode).

No CORS changes. `credentials: "include"` on the frontend is already set from Phase 0b.

### 3.2 Frontend (Vercel)

No new env vars. Vercel auto-deploys on merge to main.

### 3.3 Order of merge

Plan 2a (backend) must merge before Plan 2b (frontend) — the frontend's regenerated types depend on the new endpoints. Order:

1. Plan 2a PR → CI → merge → Render auto-deploy → backend smoke tests (curl signup/login/me/cart endpoints).
2. Pull main into Plan 2b branch (or rebase), re-run codegen if needed, push → CI → merge → Vercel auto-deploy → frontend browser smoke test.

---

## Section 4 — Success criteria

The phase is shipped when all of these are true and **the user has confirmed in a real browser**:

1. **Backend:**
   - `POST /api/auth/signup` creates a user and returns the user object with a session cookie.
   - `POST /api/auth/login` returns the user and session cookie for existing users; returns 401 for wrong password; returns 401 for unknown email (no enumeration).
   - `POST /api/auth/logout` clears the session cookie.
   - `GET /api/auth/me` returns 200 + user when the session cookie is valid, 401 otherwise.
   - `GET /api/cart` returns `{items: []}` for a fresh user, populated for users with cart_items.
   - `POST /api/cart/items` adds items; re-adding the same product increments quantity (up to stock).
   - `PATCH /api/cart/items/:id` sets exact quantity.
   - `DELETE /api/cart/items/:id` removes the line.
   - `POST /api/cart/merge` with guest items correctly adds / sums / clamps.
   - All backend tests pass with ≥ 80% coverage on auth + cart packages.
   - Render deploy healthy; both migrations applied.

2. **Frontend:**
   - `/signup`: form validates inputs, submits, creates account, lands logged in.
   - `/login`: same shape; wrong password shows form-level error.
   - `/account`: shows email + created date + logout button. Unauthenticated access redirects to `/login`.
   - Site header shows login/signup when logged out; dropdown menu when logged in.
   - Cart button in header shows item count; routes to `/cart`.
   - `/cart`: shows guest items from localStorage for unauthenticated users; shows server items for authenticated; +/- controls work; remove works; subtotal updates.
   - "Add to cart" on product detail page works for both guest and logged-in flows. Toast fires.
   - Guest adds 2 items → signs up → cart shows same 2 items from the server (merge worked).
   - Guest adds 2 items → logs in with an account that has 1 different item → cart shows all 3 items.
   - Log out → session cleared; cart button reverts to guest-localStorage source; `/account` redirects to `/login`.
   - Layout-only Tailwind discipline intact.
   - All frontend tests pass with ≥ 80% coverage on new code.

3. **Integration:**
   - Cookies work across Vercel → Render despite the different subdomains. (SameSite=Lax + Secure + HttpOnly allow cross-site XHR with `credentials: include` on same-site top-level navigation.)
   - Render cold starts don't break session retrieval (scs's pgxstore is stateless per request).

---

## Section 5 — Risks & mitigations

| Risk | Mitigation |
|---|---|
| Cross-site cookie pitfalls (Vercel ↔ Render) | SameSite=Lax works for the common flows. If a future sub-flow breaks, revisit with SameSite=None+Secure (requires HTTPS everywhere, which we have). |
| argon2id default params are too CPU-expensive for Render free tier | `alexedwards/argon2id` defaults (64 MB, 1 iter, 4 parallel) take ~50-100 ms on typical hardware. Acceptable for signup/login. If Render free instances throttle badly, tune down to 32 MB / 2 parallel. Document in quirks memory if this happens. |
| Guest-cart → server-cart merge edge cases (product deleted between add and login) | Service silently skips missing/inactive products in the merge. Frontend receives the clean server cart; any dropped guest items simply aren't there. |
| localStorage quota on guests with lots of items | Not realistic at current scope (15 products). Graceful failure anyway — zustand persist catches write errors. |
| Session fixation on login | `scs.Manager.RenewToken(ctx)` in the login/signup handler regenerates the token after authentication. Standard mitigation, easy one-liner. |
| Password hash upgrade path later | `argon2id.ComparePasswordAndHash` includes the params in the hash string — if we change the default params in the future, existing hashes still validate against their stored params, and we can re-hash on next login. |
| Stock mismatch between guest's snapshot and current DB | Server clamps on add / merge; frontend re-syncs on cart page mount. Worst case: user sees "only 3 available, you requested 5" — an acceptable state. |
| Coverage of negative test cases (bad sessions, tampered cookies) | scs handles decoding internally — tampered cookies become `userID` lookup failures → 401. Our tests cover the happy path; the scs library owns the security edge cases. |
| User enumeration via signup error messages | Signup returns 409 only when email is actually registered. This is information disclosure but considered acceptable vs. UX cost of obscuring it. Documented as a known trade-off. |
| User enumeration via login error messages | Login returns the same 401 for "unknown email" and "wrong password". Prevents enumeration via login specifically (the higher-value vector). |

---

## Execution shape (for the plans)

Per `workflow_preference.md`:

1. This spec → two plan documents under `docs/superpowers/plans/`:
   - `2026-04-18-phase-2a-identity-cart-backend.md` (~8 tasks)
   - `2026-04-18-phase-2b-identity-cart-frontend.md` (~12 tasks)
2. Each task is a fresh subagent dispatch via `superpowers:subagent-driven-development`, with spec-compliance + code-quality review per task.
3. Plan 2a must merge before Plan 2b (frontend types depend on the OpenAPI regeneration).
4. Each plan ends with explicit push → PR → CI → merge → deploy verify steps.
5. Manual production verification at the end of Plan 2b: user confirms the full guest-cart-to-login merge flow in a real browser.

---

**End of spec.**
