import fsd from "@feature-sliced/steiger-plugin"
import { defineConfig } from "steiger"

export default defineConfig([
  ...fsd.configs.recommended,
  {
    files: ["src/shared/api/generated/**"],
    rules: { "fsd/public-api": "off" },
  },
  {
    // Phase 0b: empty placeholder layers and the lone foundation entity.
    // Re-enable in Phase 1 once feature/widget slices populate.
    // The `.*` patterns silence the rule on placeholder dirs that only contain
    // a `.gitkeep` — micromatch's default behaviour skips dotfiles for `**`.
    files: [
      "src/widgets/**",
      "src/widgets/**/.*",
      "src/features/**",
      "src/features/**/.*",
      "src/entities/**",
      "src/entities/**/.*",
    ],
    rules: { "fsd/insignificant-slice": "off" },
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
    // Widget slices keep implementation files flat in the slice root rather
    // than inside segment dirs — suppress until Task 10 reorganises if needed.
    files: ["src/widgets/product-card/**", "src/widgets/product-grid/**"],
    rules: { "fsd/no-segmentless-slices": "off" },
  },
])
