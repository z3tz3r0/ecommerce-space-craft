# State Management · Frontend

Three layers of state, each with a clear owner:

| State | Tool | Where |
|---|---|---|
| Server state (products, server cart, auth) | TanStack Query v5 | `entities/*/api/` |
| Guest cart (logged-out) | Zustand 5 + persist (localStorage) | `entities/cart/model/guest-store.ts` |
| Form state | React Hook Form + Zod | `features/auth-*/` |
| Toasts | sonner | `shared/ui/sonner` |

The QueryClient is configured in `app/providers/query` with `staleTime` 30s,
`retry` 1, `refetchOnWindowFocus` false.

## Auth state

`entities/user/api/use-auth.ts` queries `GET /api/auth/me` with `retry: false`
and a 5-minute `staleTime`. A 401 surfaces as `isError` and is treated as the
logged-out signal. Login and signup mutations call `setQueryData(userKeys.me(),
user)` on success so the UI reflects auth immediately without a refetch.

## The cart facade (the load-bearing piece)

`entities/cart/lib/cart-facade.ts` exposes a single `useCart()` hook that routes
reads and writes based on auth status:

- **Auth loading** (`auth.isLoading`) → an empty list. Neither store is read on
  first mount, which prevents a flash of guest items before auth resolves.
- **Logged out** (resolved, not authenticated) → the Zustand guest store. Items
  persist to localStorage under the `guest-cart` key. Quantities are clamped to a
  `stockQuantity` snapshot that is refreshed on every `add` (and used as the
  ceiling for `set`).
- **Logged in** (`auth.isSuccess`) → the server cart via TanStack Query
  (`use-server-cart.ts`, `enabled`-gated on auth) and the cart mutations.

Both shapes share a unified `CartItem` type (`productId`, `name`, `priceCents`,
`imageUrl`, `quantity`, `stockQuantity`), so widgets and the subtotal reducer
(`model/subtotal.ts`, sums `priceCents * quantity`) work regardless of mode.

## Optimistic server-cart mutations

`entities/cart/api/use-cart-mutations.ts` follows the TanStack Query
`onMutate / onError / onSettled` pattern:

- **Add** optimistically inserts a placeholder line (name `…`, `priceCents` 0)
  only when the product is not yet in the cart. If the line already exists, its
  quantity is incremented in place, clamped to `stockQuantity`. `onSettled`
  refetches in both cases to fill in real data.
- **Set** and **Remove** apply the same optimistic-update-then-rollback pattern.

## Guest → server merge on login

On login or signup (`features/auth-login` and `features/auth-signup`), the form:
(1) runs the auth mutation (a failure stops here and surfaces an error), (2) if
the guest cart is non-empty, POSTs the items to `/api/cart/merge` via
`use-merge-cart-mutation.ts` then clears the guest store, all inside a best-effort
`try/catch` (a merge failure is swallowed and the guest store is left intact,
since the user is already authenticated and blocking navigation would mislead),
(3) navigates to `/`. The merge mutation's `onSettled` invalidates the server-cart
query unconditionally (even on the empty-input no-op path) so the merged cart
loads fresh.

## Forms

`features/auth-login` and `features/auth-signup` use `useForm` with `zodResolver`.
Schemas live in each feature's `model/schema.ts`: login requires a valid email +
non-empty password; signup requires password ≥ 8 chars (matching the backend
`MinPasswordLength`). Validation messages render through the
`shared/ui/form` `FormField` / `FormControl` / `FormMessage` components.

## Feedback

`shared/ui/sonner` mounts a top-right `Toaster` (`richColors`) in the app shell.
`AddToCartButton` surfaces success (with a link to `/cart`) and error toasts;
`CartPage` set/remove handlers toast on error.

## Key files

- `entities/cart/lib/cart-facade.ts` · the `useCart` router
- `entities/cart/model/guest-store.ts` · Zustand guest cart (persisted)
- `entities/cart/api/use-server-cart.ts` · auth-gated server cart query
- `entities/cart/api/use-cart-mutations.ts` · optimistic add/set/remove
- `entities/cart/api/use-merge-cart-mutation.ts` · login-time merge
- `entities/user/api/use-auth.ts` · `/api/auth/me` gate
- `app/providers/query` · QueryClient setup
- `shared/api/client.ts` · `openapi-fetch` client (`credentials: include`)
