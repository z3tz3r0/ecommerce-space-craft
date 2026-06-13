# UI Components · Frontend

The frontend is organized by Feature-Sliced Design (FSD), not by a generic
"components" folder. UI lives at four levels: reusable primitives in `shared/ui`,
entity-specific UI in `entities/*/ui`, interactive concerns in `features/*/ui`,
and composite blocks in `widgets`. Pages assemble these.

## Component library

[shadcn/ui](https://ui.shadcn.com) (new-york style) built on Radix primitives and
[lucide-react](https://lucide.dev) icons, styled with Tailwind v4. There is no
separate `tailwind.config` file: Tailwind is wired through `@tailwindcss/vite`,
and the theme placeholder lives in `src/app/styles/global.css`. `components.json`
aliases `components` and `ui` to `@/shared/ui`, `utils` to `@/shared/lib/utils`, and `lib` and `hooks` to `@/shared/lib`.

> Layout-only Tailwind is in force through Phase 3: spacing and structure only,
> shadcn primitive defaults for everything else. The visual-polish pass comes
> later.

## `shared/ui` primitives

Generated/owned shadcn primitives (12):

`badge` · `button` · `card` · `checkbox` · `dropdown-menu` · `form` · `input` ·
`label` · `select` · `separator` · `skeleton` · `sonner`

`form` wraps React Hook Form (`FormField` / `FormControl` / `FormMessage`).
`sonner` is the toast `Toaster`, mounted in the app shell.

## Widgets · composite blocks (`widgets/`)

| Widget | Role |
|---|---|
| `site-header` | Global header (nav, cart entry); rendered in the app shell |
| `product-grid` | Grid layout of product cards |
| `product-card` | Single product summary card |
| `cart-line` | One cart line with quantity controls |
| `filter-sidebar` | Category filter sidebar for the catalog |
| `featured-section` | Featured-products block on the home page |

## Features · interactive concerns (`features/`)

| Feature | UI / model |
|---|---|
| `auth-login` | `LoginForm` (+ Zod schema, cart-merge orchestration) |
| `auth-signup` | `SignupForm` (+ Zod schema, cart-merge orchestration) |
| `auth-logout` | `LogoutButton` |
| `cart-actions` | `AddToCartButton`, `QuantityStepper` |
| `catalog-search` | `SearchInput` + `useSearchQuery` |
| `catalog-filter` | `useCategoryFilter` |
| `catalog-sort` | `SortDropdown` + `useSortOrder` |
| `require-auth` | `RequireAuth` route guard |

## Entity UI (`entities/*/ui`)

- `product` · `StockBadge` (driven by `model/stock.ts`) plus product display bits.
- `cart` · cart item rendering shared by guest and server modes.

## Pages (`pages/`) and routes

Seven routes, defined in `app/providers/router/routes.tsx`:

| Route | Page |
|---|---|
| `/` | `home` (featured section) |
| `/products` | `catalog` (grid + search/filter/sort) |
| `/products/:id` | `product-detail` |
| `/cart` | `cart` |
| `/login` | `login` |
| `/signup` | `signup` |
| `/account` | `account` (auth-guarded) |

The app shell (`app/App.tsx`) renders `SiteHeader` + the routed `Outlet` + the
sonner `Toaster`.

## Shared utilities (`shared/lib`)

- `format-price` · cents → display string
- `use-query-params` · URL search-param helper (backs catalog search/filter/sort)
- `test-setup` · Vitest + Testing Library setup
