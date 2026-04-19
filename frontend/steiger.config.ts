import fsd from "@feature-sliced/steiger-plugin"
import { defineConfig } from "steiger"

export default defineConfig([
  ...fsd.configs.recommended,
  {
    files: ["src/shared/api/generated/**"],
    rules: { "fsd/public-api": "off" },
  },
  {
    // catalog-filter, catalog-sort, catalog-search intentionally share the
    // "catalog" prefix as a domain namespace — suppress the false positive.
    // auth-login, auth-signup, auth-logout share the "auth" namespace for
    // the same reason.
    files: [
      "src/features/catalog-filter/**",
      "src/features/catalog-sort/**",
      "src/features/catalog-search/**",
      "src/features/auth-login/**",
      "src/features/auth-signup/**",
      "src/features/auth-logout/**",
    ],
    rules: { "fsd/repetitive-naming": "off" },
  },
  {
    // catalog-* features are intentionally single-consumer slices — each
    // encapsulates one catalog behavior (filter / sort / search) and is only
    // referenced from pages/catalog by design.  Merging them into the page
    // would break FSD separation of concerns.
    files: [
      "src/features/catalog-filter/**",
      "src/features/catalog-sort/**",
      "src/features/catalog-search/**",
    ],
    rules: { "fsd/insignificant-slice": "off" },
  },
  {
    // entities/user and entities/cart are introduced in Plan 2b ahead of
    // their consumers (auth pages + cart facade arrive in later tasks).
    // The "no references" warning is structurally correct but premature —
    // suppress until the slice graph is complete.
    files: ["src/entities/user/**", "src/entities/cart/**"],
    rules: { "fsd/insignificant-slice": "off" },
  },
  {
    // features/auth-* and features/cart-actions slices are introduced ahead
    // of their consumers (LoginPage / SignupPage / Account widgets and the
    // ProductDetailPage AddToCartButton wiring arrive in Task 11).
    // Suppress fsd/insignificant-slice until then.
    files: [
      "src/features/auth-login/**",
      "src/features/auth-signup/**",
      "src/features/auth-logout/**",
      "src/features/cart-actions/**",
    ],
    rules: { "fsd/insignificant-slice": "off" },
  },
  {
    // features/require-auth is a route guard used by AccountPage and any
    // future gated page. It lives in features/ because FSD forbids
    // shared → entities imports (it depends on useAuth from entities/user).
    // Currently only AccountPage consumes it — suppress until more gated
    // pages arrive (checkout, orders, profile edit in later phases).
    files: ["src/features/require-auth/**"],
    rules: { "fsd/insignificant-slice": "off" },
  },
  {
    // Widget slices keep implementation files flat in the slice root rather
    // than inside segment dirs — suppress until a future phase reorganises.
    files: [
      "src/widgets/product-card/**",
      "src/widgets/product-grid/**",
      "src/widgets/filter-sidebar/**",
      "src/widgets/featured-section/**",
      "src/widgets/site-header/**",
      "src/widgets/cart-line/**",
    ],
    rules: { "fsd/no-segmentless-slices": "off" },
  },
])
