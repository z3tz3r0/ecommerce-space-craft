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
    files: [
      "src/features/catalog-filter/**",
      "src/features/catalog-sort/**",
      "src/features/catalog-search/**",
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
    // Widget slices keep implementation files flat in the slice root rather
    // than inside segment dirs — suppress until a future phase reorganises.
    files: [
      "src/widgets/product-card/**",
      "src/widgets/product-grid/**",
      "src/widgets/filter-sidebar/**",
      "src/widgets/featured-section/**",
    ],
    rules: { "fsd/no-segmentless-slices": "off" },
  },
])
