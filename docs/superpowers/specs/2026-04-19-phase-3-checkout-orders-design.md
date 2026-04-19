# Phase 3 — Checkout & Orders: Design Spec

**Date:** 2026-04-19
**Status:** Approved (pending user review of this written spec)
**Phase:** 3 of 6
**Owner:** z3tz3r0
**Predecessors:**
- [Phase 0 — Foundation](./2026-04-17-phase-0-foundation-design.md)
- [Phase 1 — Catalog](./2026-04-18-phase-1-catalog-design.md)
- [Phase 2 — Identity & Cart](./2026-04-18-phase-2-identity-cart-design.md)

---

## Project context

Phases 0, 1, and 2 are merged + production-verified at `https://ecommerce-space-craft.vercel.app/`. The site supports browsing the catalog, signing up / logging in, and adding items to a per-user cart (with guest cart merge on login). Cart concurrency is hardened with `SELECT FOR UPDATE` row locks inside `pgx.BeginFunc` transactions and deterministic ProductID lock order.

Phase 3 adds the payment endpoint of the funnel: a hosted Stripe Checkout session, an orders bounded context, a webhook handler that mutates order state in response to Stripe events, and an order history surface on `/account/orders`. Everything runs in **Stripe test mode** (`sk_test_*` / `whsec_*` keys) — no real money ever moves; the deployed production site continues to be a portfolio piece.

Project discipline from prior phases is unchanged:

- **Layout-only Tailwind** — Phase 3 stays on shadcn neutral defaults; visual polish lands in Phase 4.
- **FSD boundaries** enforced by Steiger; bounded contexts on the backend do not import each other.
- **DDD-lite vertical slices** under `backend/internal/<context>/`.
- **Codegen drift = CI failure** — `make codegen` after sqlc/Huma changes; commit regenerated artefacts.
- **Free-tier hard constraint** — Stripe test mode is permanently free; no cron or paid worker tier.
- **No outbound email infrastructure** — receipts are Stripe's hosted receipt only; no Resend/Postmark account.

## Phase 3 scope

### In scope

| Capability | Notes |
|---|---|
| Stripe Checkout (hosted) | Full payment page rendered by Stripe; we redirect to `session.url` and they redirect back to our success/cancel URLs |
| Orders bounded context | New slice `backend/internal/orders/` with `domain`, `repository`, `postgres`, `service`, `handler`, `errors`, `queries.sql`, `db/`, `*_test.go` |
| Stripe SDK wrapper | New infra package `backend/internal/platform/stripe/` isolating `stripe-go/v82` from the orders slice |
| Order schema | `orders` + `order_items` tables; full snapshot of product details into `order_items` |
| Stripe webhook handler | Public endpoint `POST /api/webhooks/stripe`; verifies signature; idempotent; handles `checkout.session.completed`, `checkout.session.expired`, `charge.refunded` |
| Stock decrement on payment | `SELECT FOR UPDATE` + decrement inside `pgx.BeginFunc` from inside the webhook handler |
| Guest checkout | `orders.user_id` nullable; Stripe-collected email persisted on order; guest gets Stripe's hosted receipt + nothing in our UI |
| Authenticated order history | `/account/orders` (list) + `/account/orders/:id` (detail) — RequireAuth-gated; both paginate-eligible (defer infinite-scroll to Phase 4) |
| Cart + Account integration | "Checkout" button on `/cart`; "Order history" link on `/account` |
| Success / cancel pages | `/checkout/success?session_id=…` (clears guest cart, links to receipt + order history); `/checkout/cancel` (back-to-cart link) |

### Out of scope (deferred to later phases)

| Deferred item | When |
|---|---|
| Custom transactional email (Resend/Postmark) | Phase 4+ |
| Admin order management UI | Phase 4+ |
| Fulfillment states (`shipped`, `delivered`) | Phase 4+ if real fulfillment ever lands |
| Multi-country shipping | Phase 4+ |
| Tax computation (Stripe Tax) | Phase 4+ |
| Shipping rate cards (flat / weight-based) | Phase 4+ |
| Coupon codes / discount logic | Phase 4+ |
| Inventory holds / reservations + cleanup cron | only if traffic ever materialises |
| Email-claim of guest orders post-signup | Phase 4+ |
| Refund initiation from our UI | never — refunds are a Stripe-dashboard action, status flows back via `charge.refunded` webhook |
| Playwright E2E coverage of checkout | Phase 4+ (manual `stripe trigger` for now) |
| FE Stripe.js publishable key + Elements/Embedded variants | Phase 4+ if visual polish wants checkout-on-our-domain |

## Architecture

```
backend/
├── internal/
│   ├── orders/                    # NEW bounded context
│   │   ├── domain.go              # Order, OrderItem, ShippingAddress, status sentinels, sentinel errors
│   │   ├── repository.go          # Repository interface + exported record types
│   │   ├── postgres.go            # sqlc-backed impl; var _ Repository = (*Postgres)(nil)
│   │   ├── service.go             # CreateCheckoutSession + HandleWebhookEvent + ListByUser + GetByID
│   │   ├── handler.go             # Huma operation registration + Security on auth-protected ones
│   │   ├── errors.go              # mapError(domain err) → huma.ErrorXXX
│   │   ├── queries.sql            # sqlc input
│   │   ├── db/                    # sqlc-generated
│   │   ├── service_test.go        # service unit tests with fake Stripe + fake repo
│   │   ├── handler_test.go        # httptest tests
│   │   └── fakes_test.go          # in-package test fakes
│   └── platform/
│       └── stripe/                # NEW infra package
│           ├── client.go          # Wraps stripe-go/v82; CreateCheckoutSession + VerifyWebhookSignature
│           └── client_test.go
└── migrations/
    └── 20260419120000_create_orders.sql   # NEW

frontend/src/
├── entities/
│   └── order/                     # NEW entity
│       ├── api/
│       │   ├── use-orders.ts      # GET /api/orders (TanStack Query)
│       │   └── use-order.ts       # GET /api/orders/{id}
│       └── model/types.ts         # re-exports from generated
├── features/
│   └── checkout-start/            # NEW feature
│       └── ui/
│           └── CheckoutButton.tsx # POST /api/checkout/sessions → window.location = checkoutUrl
└── pages/
    ├── checkout-success/          # NEW
    ├── checkout-cancel/           # NEW
    ├── orders-list/               # NEW (route: /account/orders)
    ├── order-detail/              # NEW (route: /account/orders/:id)
    ├── cart/                      # MODIFIED — adds <CheckoutButton />
    └── account/                   # MODIFIED — adds link to /account/orders
```

## Data model

### Migration: `backend/migrations/20260419120000_create_orders.sql`

```sql
-- +goose Up
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  stripe_session_id TEXT UNIQUE NOT NULL,
  stripe_payment_intent_id TEXT UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('pending','paid','cancelled','refunded')),
  email TEXT NOT NULL DEFAULT '',
  subtotal_cents BIGINT NOT NULL CHECK (subtotal_cents >= 0),
  total_cents BIGINT NOT NULL CHECK (total_cents >= 0),
  shipping_address JSONB,
  receipt_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ
);

CREATE INDEX idx_orders_user_id_created_at
  ON orders (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

CREATE INDEX idx_orders_email_created_at
  ON orders (email, created_at DESC);

CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL,
  product_title TEXT NOT NULL,
  product_image_url TEXT NOT NULL,
  unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents > 0),
  quantity INTEGER NOT NULL CHECK (quantity > 0)
);

CREATE INDEX idx_order_items_order_id ON order_items (order_id);

-- +goose Down
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
```

### Schema decisions

- **`product_id` is intentionally not a FK on `order_items`.** This is the snapshot guarantee: an order keeps rendering correctly even if the product is later deleted or rekeyed.
- **`stripe_session_id UNIQUE NOT NULL`** is the idempotency anchor. Webhook handler uses it (or `client_reference_id` = our `order.id`) to look up the order; duplicate `checkout.session.completed` events for the same session are no-ops.
- **`stripe_payment_intent_id UNIQUE` (nullable)** — set after payment; lets us look up the order on `charge.refunded` events (which carry `payment_intent`, not `checkout_session`).
- **`email NOT NULL DEFAULT ''`** — Stripe collects the email on the hosted page, so the column is empty between session-creation and webhook-completion. `NOT NULL DEFAULT ''` is simpler than nullable + null-check at every read site.
- **`shipping_address JSONB`** — Stripe returns a structured address on the webhook payload; storing as JSONB avoids a 7-column shipping table for what is essentially an opaque snapshot. Indexed lookups by address are not in scope.
- **`status` CHECK constraint** — defends against typos in app code; serves as documentation of the state machine in the schema itself.
- **Indexes** —
  - `(user_id, created_at DESC) WHERE user_id IS NOT NULL` — partial index for the auth-gated list query
  - `(email, created_at DESC)` — for the deferred guest-lookup-by-email feature
  - `(order_id)` on `order_items` — JOIN performance for detail page

### Domain types (`backend/internal/orders/domain.go`)

```go
package orders

import (
    "errors"
    "time"

    "github.com/google/uuid"
)

type Status string

const (
    StatusPending   Status = "pending"
    StatusPaid      Status = "paid"
    StatusCancelled Status = "cancelled"
    StatusRefunded  Status = "refunded"
)

type ShippingAddress struct {
    Line1      string `json:"line1"`
    Line2      string `json:"line2,omitempty"`
    City       string `json:"city"`
    State      string `json:"state"`
    PostalCode string `json:"postalCode"`
    Country    string `json:"country"`
}

type OrderItem struct {
    ID              uuid.UUID
    ProductID       uuid.UUID
    ProductTitle    string
    ProductImageURL string
    UnitPriceCents  int32
    Quantity        int32
}

type Order struct {
    ID                    uuid.UUID
    UserID                *uuid.UUID
    StripeSessionID       string
    StripePaymentIntentID *string
    Status                Status
    Email                 string
    SubtotalCents         int64
    TotalCents            int64
    ShippingAddress       *ShippingAddress
    ReceiptURL            *string
    Items                 []OrderItem
    CreatedAt             time.Time
    UpdatedAt             time.Time
    PaidAt                *time.Time
    CancelledAt           *time.Time
    RefundedAt            *time.Time
}

var (
    ErrOrderNotFound          = errors.New("order: not found")
    ErrInvalidStatusTransition = errors.New("order: invalid status transition")
    ErrInsufficientStock       = errors.New("order: insufficient stock")
    ErrEmptyCart               = errors.New("order: cart is empty")
    ErrStripeUnavailable       = errors.New("order: stripe API unavailable")
    ErrInvalidWebhookSignature = errors.New("order: invalid webhook signature")
)
```

## API endpoints

### `POST /api/checkout/sessions`

Auth-optional. Reads cart from session.

**Request body:** empty (cart is server-side state).

**Success (200):**
```json
{
  "checkoutUrl": "https://checkout.stripe.com/c/pay/cs_test_..."
}
```

**Errors:**
- `422 Unprocessable Entity` — empty cart or insufficient stock; body `{ "unavailable": [{ "productId": "...", "requested": 5, "available": 3 }] }`
- `502 Bad Gateway` — Stripe API failure
- `500 Internal Server Error` — DB failure

### `POST /api/webhooks/stripe`

Public (no auth, no CORS). Body is the raw Stripe event payload. Signature in `Stripe-Signature` header.

**Success (200):** body `{ "received": true }`. Always 200 once signature verifies — including for unknown event types and orphan orders. Stripe retries non-2xx responses.

**Errors:**
- `400 Bad Request` — missing or invalid signature

### `GET /api/orders`

Auth-required (`Security: cartSecurity` shape, reuses the session security scheme).

**Query params:** `limit` (default 20, max 100), `cursor` (ISO timestamp; rows where `created_at < cursor`).

**Success (200):**
```json
{
  "orders": [
    {
      "id": "...",
      "status": "paid",
      "totalCents": 12500,
      "createdAt": "2026-04-19T...",
      "itemCount": 3
    }
  ],
  "nextCursor": "2026-04-15T..."
}
```

`itemCount` is computed via `COUNT(order_items.id)` aggregated; lets the list render without fetching full snapshots.

### `GET /api/orders/{id}`

Auth-required. Returns 404 if the order's `user_id` doesn't match the session user — never leak existence.

**Success (200):** full Order shape including items + shipping address + receipt URL.

## Stripe integration

### `internal/platform/stripe/client.go`

Wraps `github.com/stripe/stripe-go/v82` (verify latest version at impl time — January 2026 cutoff means a check is required). Surface area kept minimal:

```go
package stripe

type Client interface {
    CreateCheckoutSession(ctx context.Context, params CheckoutSessionParams) (*CheckoutSession, error)
    VerifyWebhookSignature(payload []byte, signatureHeader, secret string) (*Event, error)
}

type CheckoutSessionParams struct {
    LineItems          []LineItem
    SuccessURL         string  // {success_url}?session_id={CHECKOUT_SESSION_ID}
    CancelURL          string
    ClientReferenceID  string  // = order.id, used for webhook lookup
    AllowedCountries   []string
}

type LineItem struct {
    ProductTitle    string
    ProductImageURL string
    UnitAmountCents int64
    Quantity        int64
}

type CheckoutSession struct {
    ID  string
    URL string
}

type Event struct {
    Type string
    Data json.RawMessage
}
```

The handler depends on the `Client` interface; the prod binary wires up the `stripe-go` impl, tests inject a fake. This keeps the `stripe-go` SDK out of the orders slice entirely (only domain + interface contracts cross the package boundary).

### Session-creation parameters

```go
&stripe.CheckoutSessionParams{
    Mode:                stripe.String(string(stripe.CheckoutSessionModePayment)),
    LineItems:           lineItems,                              // built from cart items
    SuccessURL:          successURL + "?session_id={CHECKOUT_SESSION_ID}",
    CancelURL:           cancelURL,
    ClientReferenceID:   stripe.String(order.ID.String()),
    ShippingAddressCollection: &stripe.CheckoutSessionShippingAddressCollectionParams{
        AllowedCountries: stripe.StringSlice([]string{"US"}),
    },
    BillingAddressCollection: stripe.String("auto"),  // Stripe defaults
}
```

Note: `mode: payment` (one-shot payment, no subscription). `automatic_tax` is not enabled (out of scope). Shipping rate is not configured → free shipping.

### Webhook events handled

| Event | Effect | Notes |
|---|---|---|
| `checkout.session.completed` | `pending → paid`; decrement stock; persist email + shipping address + receipt URL + payment intent ID | Idempotent: re-firing for an already-`paid` order is a no-op |
| `checkout.session.expired` | `pending → cancelled`; set `cancelled_at` | Default session TTL is 24 hours |
| `charge.refunded` | `paid → refunded`; set `refunded_at` | Looked up via `payment_intent.id` (already stored on the order) |

Other events (everything in `payment_intent.*`, `checkout.session.async_payment_*`, etc.) are accepted with 200 + `slog.Debug("stripe: ignored event", "type", evt.Type)`.

### Webhook signature verification

```go
sig := r.Header.Get("Stripe-Signature")
body, _ := io.ReadAll(r.Body)
event, err := stripe.VerifyWebhookSignature(body, sig, cfg.StripeWebhookSecret)
if err != nil {
    http.Error(w, "invalid signature", http.StatusBadRequest)
    return
}
```

Constant-time comparison is handled by `stripe-go`'s `webhook.ConstructEvent`; we don't roll our own.

## Frontend

### Entity: `entities/order/`

```
entities/order/
├── api/
│   ├── use-orders.ts            # useOrders({ limit, cursor }) → infinite query later, regular query for now
│   └── use-order.ts             # useOrder(id)
├── model/
│   └── types.ts                 # re-exports OrderSummary, OrderDetail from generated
└── ui/
    └── OrderStatusBadge.tsx     # tiny reusable status badge (paid/cancelled/refunded/pending)
```

### Feature: `features/checkout-start/`

```tsx
// CheckoutButton.tsx
export function CheckoutButton() {
  const mutation = useMutation({
    mutationFn: () => apiClient.POST('/api/checkout/sessions', { body: {} }),
    onSuccess: (data) => {
      if (data.data?.checkoutUrl) {
        window.location.href = data.data.checkoutUrl
      }
    },
    onError: (err) => {
      // 422 → show inline "out of stock" toast; 502 → "couldn't reach payment provider"
      toast.error(getErrorMessage(err))
    },
  })

  return (
    <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
      {mutation.isPending ? 'Starting checkout…' : 'Checkout'}
    </Button>
  )
}
```

### Pages

| Route | Component | Notes |
|---|---|---|
| `/checkout/success` | `pages/checkout-success/ui/CheckoutSuccessPage.tsx` | Reads `?session_id=`; clears guest cart store on mount; shows "Thanks!" + "View your orders" (authed) or "Check your email for your receipt" (guest); does NOT poll for paid status — trust Stripe redirect |
| `/checkout/cancel` | `pages/checkout-cancel/ui/CheckoutCancelPage.tsx` | "No worries, your cart is safe" + "Back to cart" link |
| `/account/orders` | `pages/orders-list/ui/OrdersListPage.tsx` | RequireAuth; renders list via `useOrders()`; empty state ("No orders yet"); status badges |
| `/account/orders/:id` | `pages/order-detail/ui/OrderDetailPage.tsx` | RequireAuth; renders Order via `useOrder(id)`; line items table + totals + shipping address + Stripe receipt link |

### Cart + Account integration

- `pages/cart/ui/CartPage.tsx` — Add `<CheckoutButton />` below the cart summary. Disabled when cart is empty.
- `pages/account/ui/AccountPage.tsx` — Add `<Link to="/account/orders">Order history</Link>` between member-since and logout.

### Router additions

`app/router.tsx` adds 4 routes above. `/checkout/success` and `/checkout/cancel` are public; `/account/orders` and `/account/orders/:id` go inside the auth-required branch.

## Data flow

### Happy path (auth)

```
User on /cart
   │
   │  click "Checkout"
   ▼
FE: POST /api/checkout/sessions  (cookie-auth via session)
   │
   ▼
BE: orders.Service.CreateCheckoutSession
   │  1. Read cart items from session
   │  2. Validate each item: products.stock_quantity >= cart.quantity (read-only)
   │  3. INSERT pending order (user_id from session) + order_items snapshots in one tx
   │  4. Call stripe.CreateCheckoutSession with line_items + client_reference_id=order.id
   ▼
Stripe API: returns session { id, url }
   │
   ▼
FE: receives { checkoutUrl }; window.location.href = checkoutUrl
   │
   ▼
Stripe-hosted page: user enters card 4242…, completes 3DS if needed
   │
   ├─→ Stripe webhook fires (async, can arrive before or after redirect)
   │      POST /api/webhooks/stripe  with checkout.session.completed
   │      │
   │      ▼
   │   BE: orders.Service.HandleWebhookEvent
   │      1. Verify signature
   │      2. Look up order by client_reference_id
   │      3. Idempotency: if order.status == 'paid', return 200
   │      4. pgx.BeginFunc:
   │           - For each order_item: LockProductForOrder (SELECT FOR UPDATE)
   │           - Validate stock (insufficient → mark paid + log CRITICAL — see Error handling)
   │           - Decrement stock
   │           - UPDATE order: status=paid, paid_at=NOW(), email, shipping_address (JSONB),
   │             receipt_url, stripe_payment_intent_id
   │      5. Return 200
   │
   └─→ Stripe browser redirect
          window.location = /checkout/success?session_id=cs_test_…
          │
          ▼
       FE: CheckoutSuccessPage
          - Clears guest cart store (Zustand persist)
          - Shows "Thanks! Your order is being processed."
          - Link to /account/orders (authed) or "Check your email for your receipt" (guest)
```

### Cancel path

```
User on Stripe page → clicks "Back" or session expires
   │
   ├─→ If user-cancel: Stripe redirects to /checkout/cancel
   │      FE: shows "No worries, your cart is safe" + back-to-cart link
   │      (cart is untouched; nothing to roll back since stock wasn't decremented)
   │
   └─→ If session expires (24h default): Stripe webhooks checkout.session.expired
          BE: order.status = 'cancelled', cancelled_at = NOW()
          (No FE side-effect; user already left)
```

### Refund path

```
Operator (you) opens Stripe dashboard → finds payment → clicks "Refund"
   │
   ▼
Stripe webhooks charge.refunded (carries payment_intent.id)
   │
   ▼
BE: look up order by stripe_payment_intent_id
   - Update: status=refunded, refunded_at=NOW()
   - Note: stock is NOT re-incremented automatically; if you want stock back,
     do it manually via psql. (Adding a refund-restocks-inventory toggle is a Phase 4+ decision.)
```

## Error handling

| Failure mode | Behavior |
|---|---|
| Cart empty at session-creation | 422, body `{ "error": "Cart is empty" }`; FE: button shouldn't be reachable, but guard with toast |
| Stock insufficient at session-creation | 422, body `{ "unavailable": [{ "productId", "requested", "available" }] }`; FE: toast lists offending items |
| Stripe API down at session-creation | 502, body `{ "error": "Couldn't reach payment provider" }`; FE: "Try again in a moment" toast |
| Database error at session-creation | 500; order row is not created (transaction rolls back); user can retry |
| Invalid webhook signature | 400, log `slog.Warn("stripe: signature verification failed")` |
| Webhook event for unknown order | 200 (Stripe doesn't retry success), log `slog.Warn("stripe: orphan event", "type", evt.Type, "session_id", …)` |
| Webhook stock race (the 1-in-a-billion) | Mark order `paid` anyway, log `slog.Error("stripe: paid order with insufficient stock", "order_id", id)`. Operator refunds via Stripe dashboard; `charge.refunded` webhook flips status. **Never leave Stripe holding payment for an order we silently failed to fulfil — always mark `paid` so it shows up in `/account/orders` and the operator notices.** |
| Webhook DB error after signature passes | Return 500 so Stripe retries the event |
| FE reaches `/checkout/success` before webhook fires | Show generic "Thanks! Your order is being processed." — do NOT show order details inline. The user finds them in `/account/orders` once webhook lands (typically <1s after redirect). |

## Testing

### Backend

Service unit tests in `backend/internal/orders/service_test.go` with a `fakeStripeClient` and the existing fake-repo pattern from cart:

| Test | Assertion |
|---|---|
| `TestCreateCheckoutSession_HappyPath` | Returns checkoutUrl; INSERTs pending order + order_items; calls Stripe with correct line_items |
| `TestCreateCheckoutSession_EmptyCart` | Returns ErrEmptyCart; no Stripe call |
| `TestCreateCheckoutSession_InsufficientStock` | Returns ErrInsufficientStock with affected items; no Stripe call |
| `TestCreateCheckoutSession_StripeFailure` | Wraps Stripe error; rolls back order INSERT |
| `TestHandleWebhookEvent_CompletedHappyPath` | Marks paid, decrements stock, persists email + address + receipt + PI ID |
| `TestHandleWebhookEvent_CompletedIdempotent` | Re-firing for already-paid order is a no-op (no second decrement) |
| `TestHandleWebhookEvent_CompletedStockRace` | Order still marked paid + CRITICAL log emitted; stock not decremented below 0 |
| `TestHandleWebhookEvent_Expired` | Marks cancelled |
| `TestHandleWebhookEvent_Refunded` | Marks refunded; lookup by payment_intent_id |
| `TestHandleWebhookEvent_OrphanOrder` | Returns nil (200 to Stripe); warn log |
| `TestListByUser` | Returns user's orders ordered by created_at DESC |
| `TestGetByID_NotOwner` | Returns ErrOrderNotFound (no existence leak) |

Handler tests in `handler_test.go` via `httptest`:

| Test | Assertion |
|---|---|
| `POST /api/checkout/sessions authed` | 200 + checkoutUrl |
| `POST /api/checkout/sessions unauth` | 200 + checkoutUrl (guest path) |
| `POST /api/checkout/sessions empty cart` | 422 |
| `POST /api/webhooks/stripe bad signature` | 400 |
| `POST /api/webhooks/stripe valid signed payload` | 200; service called |
| `GET /api/orders unauth` | 401 |
| `GET /api/orders authed` | 200 + list |
| `GET /api/orders/{id} not owner` | 404 |

Coverage target: 80%+ on `orders` slice, matching prior phases.

### Frontend

Vitest + RTL:

| File | Coverage |
|---|---|
| `entities/order/api/use-orders.test.ts` | Mock fetch; assert query result, loading, error states |
| `entities/order/api/use-order.test.ts` | Same for single-order detail |
| `features/checkout-start/ui/CheckoutButton.test.tsx` | Mock mutation; assert window.location set on success; assert error toast on 422 |
| `pages/orders-list.test.tsx` | List rendering, empty state, status badge variants |
| `pages/order-detail.test.tsx` | Detail rendering, missing-order 404 state |
| `pages/checkout-success.test.tsx` | Clears guest cart store on mount; renders auth + guest variants |
| `pages/checkout-cancel.test.tsx` | Renders back-to-cart link |

### Manual / E2E

Stripe CLI in dev:
```bash
stripe listen --forward-to localhost:8080/api/webhooks/stripe
# Note the whsec_… → put in backend/.env as STRIPE_WEBHOOK_SECRET
stripe trigger checkout.session.completed
```

Full-flow manual test before each PR merge:
1. Local: `make dev` + `stripe listen …` in third terminal
2. Add items to cart, click Checkout, complete with `4242 4242 4242 4242`
3. Verify webhook fires, order shows paid, stock decremented, FE redirects to success page, `/account/orders` shows the order
4. Production verification: re-seed if needed, run same flow against vercel.app + onrender.com (Stripe webhook URL configured in Stripe dashboard pointing at `https://spacecraft-api.onrender.com/api/webhooks/stripe`)

## Env vars

| Var | Where | Source | Notes |
|---|---|---|---|
| `STRIPE_SECRET_KEY` | backend `.env` + Render dashboard | Stripe dashboard → Developers → API keys | `sk_test_*` only; never `sk_live_*` |
| `STRIPE_WEBHOOK_SECRET` | backend `.env` + Render dashboard | Dev: `stripe listen` output. Prod: Stripe dashboard → Developers → Webhooks → click endpoint → "Signing secret" | `whsec_*`; rotate-able |
| `CHECKOUT_SUCCESS_URL` | backend (optional) | Defaults to `${CORS_ORIGINS[0]}/checkout/success` if unset | Override for local-vs-prod |
| `CHECKOUT_CANCEL_URL` | backend (optional) | Defaults to `${CORS_ORIGINS[0]}/checkout/cancel` if unset | Override for local-vs-prod |

`render.yaml` adds the four vars (with `sync: false` for both secrets). No new FE env vars — hosted Checkout doesn't need a publishable key on the client.

`backend/internal/platform/config/config.go` extends `Config` with `StripeSecretKey`, `StripeWebhookSecret`, `CheckoutSuccessURL`, `CheckoutCancelURL`. The two secret fields are required; the URL fields default from `CORSOrigins[0]` if blank. New tests cover the validation + default behaviour, matching the Phase 0/2 pattern.

## Resolved decisions

The following choices were made during the brainstorming session and locked in:

1. **Stripe integration model:** Hosted Checkout (Stripe-owned page; redirect flow). Embedded and custom Elements deferred to Phase 4+.
2. **Stripe mode:** Test mode permanently; production deploy uses `sk_test_*` and a "DEMO MODE — no real charge" disclosure.
3. **Guest checkout:** Allowed; `orders.user_id` nullable; guest gets Stripe email receipt + no UI history (deferred email-claim feature).
4. **Order line snapshot:** Full snapshot of `product_title`, `product_image_url`, `unit_price_cents` into `order_items`. `product_id` is not a FK.
5. **Stock decrement timing:** Validate at session-creation (read-only check), decrement in webhook on `checkout.session.completed` inside `pgx.BeginFunc` with `SELECT FOR UPDATE`.
6. **Order status state machine:** `pending`, `paid`, `cancelled`, `refunded`. Webhook events: `checkout.session.completed`, `checkout.session.expired`, `charge.refunded`. Fulfillment states deferred.
7. **Order history page scope:** List + detail (`/account/orders` + `/account/orders/:id`).
8. **Email confirmations:** Stripe's hosted receipt only. No Resend/Postmark.
9. **Shipping address storage:** JSONB column on `orders`, copied from Stripe webhook payload.
10. **Webhook delivery in dev:** Stripe CLI (`stripe listen`).
11. **Checkout button placement:** Cart page only.
12. **Allowed countries:** `["US"]`.
13. **Shipping cost:** Free (no shipping rates configured in Stripe session).
14. **Tax:** Skipped (no `automatic_tax`).

## Workflow

Two paired plans following the established a/b split:

- `docs/superpowers/plans/2026-04-19-phase-3a-checkout-orders-backend.md`
  - Migration → orders slice (domain → repository → postgres → service → handler) → stripe wrapper → webhook handler → codegen → tests → push/PR/merge/deploy-verify
- `docs/superpowers/plans/2026-04-19-phase-3b-checkout-orders-frontend.md`
  - Entity → feature → success/cancel pages → orders-list page → order-detail page → cart + account integration → tests → push/PR/merge/deploy-verify

3a merges first; FE codegen depends on the backend OpenAPI changes. Subagent-driven-development per task with two-stage review (spec compliance → code quality), as in Phases 1 and 2.

Branch names: `phase-3a/checkout-orders-backend` and `phase-3b/checkout-orders-frontend`.

## Production deployment notes

- **Render:** Add `STRIPE_SECRET_KEY` (sync: false) + `STRIPE_WEBHOOK_SECRET` (sync: false) to the dashboard manually after merging 3a (Render Blueprint env-var sync requires manual trigger per `render_backend_quirks.md`).
- **Stripe dashboard webhook endpoint:** Add `https://spacecraft-api.onrender.com/api/webhooks/stripe`, subscribe to `checkout.session.completed`, `checkout.session.expired`, `charge.refunded`. Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.
- **Cold-start consideration:** Render free-tier sleeps after 15min idle. A Stripe webhook arriving cold takes 30–60s to wake the server; Stripe retries with exponential backoff (default 3 days), so the first webhook may complete the order on the second attempt. Acceptable for a demo. Document in operator runbook.
- **Vercel:** No new env vars required.
