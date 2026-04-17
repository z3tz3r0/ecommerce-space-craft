# Phase 0b — Frontend Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a deployable React 19 SPA on Vercel that renders a `HomePage` at `/` showing "Loaded N products" by calling the live Render backend via a typed codegen client, with all scaffolding (FSD 6-layer layout, Tailwind v4, shadcn/ui primitives, TanStack Query, React Router v7, Biome, Steiger, Vitest, openapi-typescript + openapi-fetch, Lefthook, CI).

**Architecture:** Feature-Sliced Design frontend. Six layers (`app`, `pages`, `widgets`, `features`, `entities`, `shared`) with strict downward-only imports enforced by Steiger (*Steiger is the FSD linter*). Every slice exposes a Public API via `index.ts`; no `export *`. Server state goes through TanStack Query; UI state is local by default. The only `fetch` call lives in `shared/api/client.ts`, wrapping `openapi-fetch` (*runtime fetcher typed by the generated OpenAPI paths*) against types emitted by `openapi-typescript` (*CLI that reads the backend's `openapi.json` and produces a `paths` TS type*). Phase 0b ships exactly one page (`HomePage`) backed by one entity (`product`), plus `Button` and `Card` shadcn primitives. **Layout-only Tailwind discipline:** no color, typography, or motion utilities until Phase 4.

**Tech Stack:** Bun 1.3+, Vite 6, React 19, TypeScript, Tailwind v4, shadcn/ui, TanStack Query v5, React Router v7, openapi-typescript, openapi-fetch, Biome 2, Steiger, Vitest + React Testing Library + jsdom, Lefthook, Vercel, GitHub Actions.

**Spec reference:** `docs/superpowers/specs/2026-04-17-phase-0-foundation-design.md` — Sections 1 (repo layout), 3 (frontend skeleton), 5 (Makefile FE targets + Lefthook), 6 (Vercel deploy + FE CI).

---

## Prerequisites

Before starting, the engineer must have:

- [ ] Bun 1.3+ installed (`bun --version`)
- [ ] `lefthook` installed from Plan 0a (`lefthook --help`)
- [ ] `gh` (GitHub CLI) authenticated
- [ ] A Vercel account (https://vercel.com) — no project created yet
- [ ] Backend from Plan 0a deployed and live at `https://spacecraft-api.onrender.com` (confirmed by `curl https://spacecraft-api.onrender.com/health` returning `{"status":"ok"}`)
- [ ] `backend/openapi.json` committed on `main` (Plan 0a artifact)

## Branch & worktree

Create a feature branch. Every task commit goes on this branch; PR merges to `main` at the end.

```bash
git checkout main && git pull
git checkout -b phase-0b/frontend-foundation
```

## File structure map

Plan 0b creates/modifies these files. Files marked `(generated)` are committed but produced by tooling and regenerated on demand.

```
ecommerce-space-craft/
├── Makefile                                         # MODIFY — add FE targets
├── lefthook.yml                                     # MODIFY — add biome + steiger hooks
├── .github/workflows/frontend.yml                   # NEW
│
└── frontend/                                        # NEW — entire directory
    ├── package.json                                 # NEW — via bun create vite, then modified
    ├── bun.lock                                     # NEW
    ├── tsconfig.json                                # MODIFY — add FSD path aliases
    ├── tsconfig.app.json                            # MODIFY — add paths
    ├── tsconfig.node.json                           # KEEP (from scaffold)
    ├── vite.config.ts                               # MODIFY — react, tailwind, aliases, vitest
    ├── biome.json                                   # NEW
    ├── components.json                              # NEW — shadcn config (points at @/shared/ui)
    ├── index.html                                   # MODIFY — title + root div only
    ├── vercel.json                                  # NEW — SPA rewrite
    ├── .env.example                                 # NEW
    ├── .gitignore                                   # NEW (Vite scaffold default)
    │
    └── src/
        ├── vite-env.d.ts                            # MODIFY — typed ImportMetaEnv
        │
        ├── app/
        │   ├── entrypoint/main.tsx                  # NEW
        │   ├── providers/
        │   │   ├── index.tsx                        # NEW — composed providers
        │   │   ├── router/
        │   │   │   ├── index.tsx                    # NEW — BrowserRouter wrapper
        │   │   │   └── routes.tsx                   # NEW — route table
        │   │   └── query/
        │   │       └── index.tsx                    # NEW — QueryClientProvider
        │   ├── styles/global.css                    # NEW — @import "tailwindcss"
        │   └── App.tsx                              # NEW — shell + <Outlet />
        │
        ├── pages/
        │   └── home/
        │       ├── ui/HomePage.tsx                  # NEW
        │       ├── ui/HomePage.test.tsx             # NEW
        │       └── index.ts                         # NEW — Public API
        │
        ├── widgets/.gitkeep                         # NEW
        ├── features/.gitkeep                        # NEW
        │
        ├── entities/
        │   └── product/
        │       ├── api/
        │       │   ├── getProducts.ts               # NEW — useProducts hook
        │       │   └── index.ts                     # NEW
        │       ├── model/types.ts                   # NEW — Product alias
        │       └── index.ts                         # NEW — Public API
        │
        ├── shared/
        │   ├── api/
        │   │   ├── client.ts                        # NEW — openapi-fetch instance
        │   │   ├── generated/types.ts               # (generated) — openapi-typescript output
        │   │   └── index.ts                         # NEW — exports api + paths
        │   ├── config/
        │   │   ├── env.ts                           # NEW — typed env
        │   │   └── env.test.ts                      # NEW
        │   ├── lib/
        │   │   ├── utils.ts                         # NEW — cn() from shadcn
        │   │   └── test-setup.ts                    # NEW — vitest global setup
        │   └── ui/
        │       ├── button/
        │       │   ├── Button.tsx                   # NEW — shadcn-generated, moved into folder
        │       │   └── index.ts                     # NEW
        │       └── card/
        │           ├── Card.tsx                     # NEW — shadcn-generated, moved into folder
        │           └── index.ts                     # NEW
```

## Hard constraints

- Every task ends with a commit unless explicitly marked `(no commit — combines with next)`.
- Use Conventional Commits format: `<type>(<scope>): <description>`. Scope is `frontend` for FE changes, `repo` for root-level changes.
- Attribution is disabled globally; do not add co-author footers.
- Never use `--no-verify` or `--amend`. If a pre-commit hook fails, fix and make a new commit.
- **Layout-only Tailwind.** Do NOT add color (`bg-*`/`text-*`-with-color/`border-*`-color/`ring-*`), typography (`font-*`/`text-{size}`/`tracking-*`/`leading-*`), theme tokens, `transition-*`, `animate-*`, `duration-*`, or custom CSS variables. shadcn primitives use their built-in neutral defaults — leave as generated. Reviewer will block PRs violating this.
- **No barrel `export *`.** All `index.ts` files list named exports explicitly.
- **FSD imports downward-only.** `entities/*` must not import other entities. Same-layer slices must not import each other.
- Generated files (`src/shared/api/generated/types.ts`) are committed. CI fails on drift.

---

## Task 1: Scaffold Vite + React + TypeScript with Bun

**Files:**
- Create: `frontend/` (via official scaffolder)

- [ ] **Step 1: Confirm you're on the feature branch**

```bash
git status
git branch --show-current
```

Expected: `phase-0b/frontend-foundation`.

- [ ] **Step 2: Run the official Vite scaffolder with React + TS template**

```bash
cd /home/z3tz3r0/Projects/ecommerce-space-craft
bun create vite@latest frontend --template react-ts
```

Expected: `frontend/` directory populated with `package.json`, `tsconfig.json`, `vite.config.ts`, `src/App.tsx`, `src/main.tsx`, `index.html`, `public/vite.svg`, etc. No interactive prompts because we passed `--template`.

- [ ] **Step 3: Install dependencies**

```bash
cd frontend
bun install
```

Expected: `bun.lock` written; `node_modules/` populated.

- [ ] **Step 4: Verify the scaffold builds and the dev server starts**

```bash
bun run build
```

Expected: `tsc -b && vite build` succeeds; `dist/` emitted.

- [ ] **Step 5: Commit the raw scaffold**

```bash
cd ..
git add frontend/
git commit -m "chore(frontend): scaffold Vite + React 19 + TypeScript via bun create vite"
```

---

## Task 2: Prune scaffold cruft to prepare for FSD layout

**Files:**
- Delete: `frontend/src/App.css`
- Delete: `frontend/src/index.css`
- Delete: `frontend/src/assets/react.svg`
- Delete: `frontend/public/vite.svg`
- Delete: `frontend/src/App.tsx` (will be recreated under `src/app/`)
- Delete: `frontend/src/main.tsx` (will be recreated under `src/app/entrypoint/`)
- Modify: `frontend/index.html` (remove `/vite.svg` favicon ref, set title)
- Modify: `frontend/src/vite-env.d.ts` (add typed `ImportMetaEnv`)

- [ ] **Step 1: Delete default styles, assets, and App/main that will be recreated under FSD**

```bash
cd frontend
rm -f src/App.css src/index.css src/App.tsx src/main.tsx
rm -f src/assets/react.svg public/vite.svg
rmdir src/assets public 2>/dev/null || true
```

- [ ] **Step 2: Replace `frontend/index.html` content**

Full file:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Spacecraft Store</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/app/entrypoint/main.tsx"></script>
  </body>
</html>
```

Note: the `src` attribute now points at the FSD entrypoint location we'll create in Task 14.

- [ ] **Step 3: Replace `frontend/src/vite-env.d.ts` content**

Full file:

```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
```

- [ ] **Step 4: Commit**

```bash
cd ..
git add -A frontend/
git status  # verify only scaffold cruft deletions + index.html + vite-env.d.ts
git commit -m "chore(frontend): prune scaffold defaults in preparation for FSD layout"
```

---

## Task 3: Install runtime and dev dependencies

**Files:**
- Modify: `frontend/package.json` (via `bun add`)
- Modify: `frontend/bun.lock`

- [ ] **Step 1: Install runtime dependencies**

```bash
cd frontend
bun add react-router @tanstack/react-query @tanstack/react-query-devtools openapi-fetch clsx tailwind-merge class-variance-authority
```

Notes:
- `react-router` is the v7 import name (the `-dom` suffix is optional in v7; spec uses `react-router`).
- `clsx`, `tailwind-merge`, `class-variance-authority` are shadcn prerequisites.

- [ ] **Step 2: Install dev dependencies**

```bash
bun add -d tailwindcss @tailwindcss/vite @biomejs/biome steiger @feature-sliced/steiger-plugin openapi-typescript vitest @vitest/ui jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @types/node
```

Notes:
- `@tailwindcss/vite` is the Tailwind v4 Vite plugin.
- `steiger` + `@feature-sliced/steiger-plugin` enforce FSD boundaries.
- `@types/node` lets `vite.config.ts` use `path` / `fileURLToPath` with typed signatures.

- [ ] **Step 3: Verify `package.json` lists the new deps**

```bash
cat package.json | grep -E 'react-router|tanstack|openapi-|tailwindcss|biome|steiger|vitest|testing-library'
```

Expected: each package present under `dependencies` or `devDependencies`.

- [ ] **Step 4: Commit**

```bash
cd ..
git add frontend/package.json frontend/bun.lock
git commit -m "chore(frontend): add runtime and dev dependencies"
```

---

## Task 4: Configure TypeScript with FSD path aliases

**Files:**
- Modify: `frontend/tsconfig.json`
- Modify: `frontend/tsconfig.app.json`

- [ ] **Step 1: Replace `frontend/tsconfig.json` content**

Full file:

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ],
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/app/*": ["src/app/*"],
      "@/pages/*": ["src/pages/*"],
      "@/widgets/*": ["src/widgets/*"],
      "@/features/*": ["src/features/*"],
      "@/entities/*": ["src/entities/*"],
      "@/shared/*": ["src/shared/*"]
    }
  }
}
```

Note: top-level `baseUrl` + `paths` enables editor-level resolution; the app-level config repeats them for the compiler.

- [ ] **Step 2: Replace `frontend/tsconfig.app.json` content**

Full file:

```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,

    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",

    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedSideEffectImports": true,

    "baseUrl": ".",
    "paths": {
      "@/app/*": ["src/app/*"],
      "@/pages/*": ["src/pages/*"],
      "@/widgets/*": ["src/widgets/*"],
      "@/features/*": ["src/features/*"],
      "@/entities/*": ["src/entities/*"],
      "@/shared/*": ["src/shared/*"]
    },

    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Verify tsc parses the config with no errors (no FSD files exist yet, so a clean parse is success)**

```bash
cd frontend
bunx tsc -b --dry
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd ..
git add frontend/tsconfig.json frontend/tsconfig.app.json
git commit -m "chore(frontend): configure TypeScript with FSD path aliases"
```

---

## Task 5: Configure Vite with React, Tailwind v4, path aliases, and Vitest

**Files:**
- Modify: `frontend/vite.config.ts`

- [ ] **Step 1: Replace `frontend/vite.config.ts` content**

Full file:

```ts
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { fileURLToPath, URL } from "node:url"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@/app": fileURLToPath(new URL("./src/app", import.meta.url)),
      "@/pages": fileURLToPath(new URL("./src/pages", import.meta.url)),
      "@/widgets": fileURLToPath(new URL("./src/widgets", import.meta.url)),
      "@/features": fileURLToPath(new URL("./src/features", import.meta.url)),
      "@/entities": fileURLToPath(new URL("./src/entities", import.meta.url)),
      "@/shared": fileURLToPath(new URL("./src/shared", import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/shared/lib/test-setup.ts"],
    css: true,
  },
})
```

Note: the `test` block uses Vitest's `defineConfig` merging — no separate `vitest.config.ts` needed.

- [ ] **Step 2: Commit**

```bash
cd ..
git add frontend/vite.config.ts
git commit -m "chore(frontend): configure Vite with Tailwind v4, FSD aliases, and Vitest"
```

---

## Task 6: Create FSD skeleton directories with .gitkeep placeholders

**Files:**
- Create (empty placeholders): `frontend/src/app/`, `frontend/src/pages/`, `frontend/src/widgets/.gitkeep`, `frontend/src/features/.gitkeep`, `frontend/src/entities/`, `frontend/src/shared/`

- [ ] **Step 1: Create all FSD directories**

```bash
cd frontend/src
mkdir -p app/entrypoint app/providers/router app/providers/query app/styles \
         pages/home/ui \
         widgets features \
         entities/product/api entities/product/model \
         shared/api/generated shared/config shared/lib shared/ui
```

- [ ] **Step 2: Add .gitkeep placeholders for empty layers / dirs that stay empty in Phase 0b**

```bash
touch widgets/.gitkeep features/.gitkeep
```

Note: do not add `.gitkeep` to directories that get populated in later tasks (they'll pick up files anyway).

- [ ] **Step 3: Verify tree**

```bash
cd /home/z3tz3r0/Projects/ecommerce-space-craft
find frontend/src -type d | sort
```

Expected: all 6 top-level FSD layers under `frontend/src/`, with sub-dirs for populated slices.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/
git commit -m "chore(frontend): scaffold FSD 6-layer skeleton with placeholders"
```

---

## Task 7: Add Tailwind v4 global stylesheet (layout-only, empty theme)

**Files:**
- Create: `frontend/src/app/styles/global.css`

- [ ] **Step 1: Create `frontend/src/app/styles/global.css`**

Full file:

```css
@import "tailwindcss";

/*
 * Theme tokens (colors, typography, radii, motion) are intentionally empty in
 * Phase 0. The first styling pass happens in Phase 4.
 * @theme block goes here when the styling pass begins.
 */
```

- [ ] **Step 2: Commit**

```bash
cd /home/z3tz3r0/Projects/ecommerce-space-craft
git add frontend/src/app/styles/global.css
git commit -m "feat(frontend): add Tailwind v4 global stylesheet with empty theme"
```

---

## Task 8: Add typed env accessor with a failing test, then implementation

**Files:**
- Create: `frontend/src/shared/config/env.test.ts`
- Create: `frontend/src/shared/config/env.ts`

- [ ] **Step 1: Write the failing test**

Full file `frontend/src/shared/config/env.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from "vitest"

describe("env", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it("returns the configured VITE_API_URL", async () => {
    vi.stubEnv("VITE_API_URL", "https://example.test")
    const { env } = await import("./env")
    expect(env.apiUrl).toBe("https://example.test")
  })

  it("throws when VITE_API_URL is missing", async () => {
    vi.stubEnv("VITE_API_URL", "")
    await expect(import("./env")).rejects.toThrow(/VITE_API_URL/)
  })
})
```

- [ ] **Step 2: Write test setup at `frontend/src/shared/lib/test-setup.ts`**

Full file:

```ts
import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"
import { afterEach } from "vitest"

afterEach(() => {
  cleanup()
})
```

- [ ] **Step 3: Run the env test to confirm it fails (import-not-found)**

```bash
cd frontend
bunx vitest run src/shared/config/env.test.ts
```

Expected: FAIL — module `./env` not found.

- [ ] **Step 4: Implement `frontend/src/shared/config/env.ts`**

Full file:

```ts
const apiUrl = import.meta.env.VITE_API_URL

if (!apiUrl) {
  throw new Error("VITE_API_URL is not set — check frontend/.env and Vercel project env vars")
}

export const env = {
  apiUrl,
} as const
```

- [ ] **Step 5: Run the test to confirm it passes**

```bash
bunx vitest run src/shared/config/env.test.ts
```

Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
cd ..
git add frontend/src/shared/config/ frontend/src/shared/lib/test-setup.ts
git commit -m "feat(frontend): add typed env accessor with tests"
```

---

## Task 9: Configure openapi-typescript codegen and run it against backend/openapi.json

**Files:**
- Modify: `frontend/package.json` (add `codegen:api` script)
- Create: `frontend/src/shared/api/generated/types.ts` (via codegen)

- [ ] **Step 1: Add a codegen script to `frontend/package.json`**

Open `frontend/package.json`. In the `"scripts"` block, add this entry (keep existing scripts):

```json
    "codegen:api": "openapi-typescript ../backend/openapi.json -o src/shared/api/generated/types.ts"
```

- [ ] **Step 2: Run codegen**

```bash
cd frontend
bun run codegen:api
```

Expected: `src/shared/api/generated/types.ts` written. Should contain `paths`, `components`, and `operations` exports.

- [ ] **Step 3: Verify the generated types include the expected operations**

```bash
grep -E "listProducts|getProduct|health" src/shared/api/generated/types.ts | head -5
```

Expected: matches for all three operation IDs from `backend/openapi.json`.

- [ ] **Step 4: Commit**

```bash
cd ..
git add frontend/package.json frontend/src/shared/api/generated/types.ts
git commit -m "feat(frontend): add openapi-typescript codegen and generate initial types"
```

---

## Task 10: Add the typed API client and its Public API

**Files:**
- Create: `frontend/src/shared/api/client.ts`
- Create: `frontend/src/shared/api/index.ts`

- [ ] **Step 1: Create `frontend/src/shared/api/client.ts`**

Full file:

```ts
import createClient from "openapi-fetch"
import type { paths } from "./generated/types"
import { env } from "@/shared/config/env"

export const api = createClient<paths>({
  baseUrl: env.apiUrl,
  credentials: "include",
})
```

Note: `credentials: "include"` is a no-op now. It's set up front so Phase 2 session cookies work without revisiting this file.

- [ ] **Step 2: Create `frontend/src/shared/api/index.ts`**

Full file:

```ts
export { api } from "./client"
export type { paths, components, operations } from "./generated/types"
```

- [ ] **Step 3: Commit**

```bash
cd /home/z3tz3r0/Projects/ecommerce-space-craft
git add frontend/src/shared/api/client.ts frontend/src/shared/api/index.ts
git commit -m "feat(frontend): add typed openapi-fetch client with Public API"
```

---

## Task 11: Initialize shadcn/ui with FSD-aware config

**Files:**
- Create: `frontend/components.json`
- Create: `frontend/src/shared/lib/utils.ts` (shadcn `cn` helper)

- [ ] **Step 1: Create `frontend/components.json`**

Full file:

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/app/styles/global.css",
    "baseColor": "neutral",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/shared/ui",
    "ui": "@/shared/ui",
    "utils": "@/shared/lib/utils",
    "lib": "@/shared/lib",
    "hooks": "@/shared/lib"
  },
  "iconLibrary": "lucide"
}
```

Notes:
- `config: ""` tells shadcn we're on Tailwind v4 (no `tailwind.config.*` file).
- `aliases.ui` points primitives at `@/shared/ui/` instead of the default `@/components/ui/`.
- `baseColor: "neutral"` is shadcn's most neutral palette — matches our "no styling decisions in Phase 0" discipline.

- [ ] **Step 2: Create `frontend/src/shared/lib/utils.ts`**

Full file:

```ts
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

Note: this is shadcn's required `cn` helper. We create it by hand rather than letting `shadcn init` touch our global.css (ours is already configured for Tailwind v4 layout-only).

- [ ] **Step 3: Commit**

```bash
git add frontend/components.json frontend/src/shared/lib/utils.ts
git commit -m "chore(frontend): configure shadcn with FSD-aware aliases and add cn helper"
```

---

## Task 12: Add Button and Card shadcn primitives, then reorganize into folder-per-component

**Files:**
- Create: `frontend/src/shared/ui/button/Button.tsx`
- Create: `frontend/src/shared/ui/button/index.ts`
- Create: `frontend/src/shared/ui/card/Card.tsx`
- Create: `frontend/src/shared/ui/card/index.ts`

- [ ] **Step 1: Add button and card via the shadcn CLI**

```bash
cd frontend
bunx shadcn@latest add button card --yes
```

Expected: writes `src/shared/ui/button.tsx` and `src/shared/ui/card.tsx` (shadcn emits flat files); may modify `global.css` — we'll inspect next.

- [ ] **Step 2: Inspect any changes shadcn made to `src/app/styles/global.css`**

```bash
git diff src/app/styles/global.css
```

If shadcn added `@theme`/`:root` blocks, **revert the CSS file to its post-Task-7 content** — Phase 0 is layout-only, no theme tokens. The primitives will still render; they just won't have our (nonexistent) theme colors applied.

```bash
# If and only if global.css was modified:
git checkout src/app/styles/global.css
```

- [ ] **Step 3: Reorganize `button.tsx` into folder-per-component layout**

```bash
cd src/shared/ui
mkdir -p button card
mv button.tsx button/Button.tsx
mv card.tsx card/Card.tsx
```

- [ ] **Step 4: Create `src/shared/ui/button/index.ts`**

Full file:

```ts
export { Button, buttonVariants } from "./Button"
```

Note: `buttonVariants` is exported by shadcn's Button for consumers that need the CVA variants without the component — keep it in the Public API.

- [ ] **Step 5: Create `src/shared/ui/card/index.ts`**

Full file:

```ts
export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
  CardAction,
} from "./Card"
```

Note: shadcn's Card exports several sub-components. If a version you install does not emit `CardAction`, remove that line from the named exports — check `Card.tsx` for what's actually exported.

- [ ] **Step 6: Verify the typescript build still passes**

```bash
cd /home/z3tz3r0/Projects/ecommerce-space-craft/frontend
bunx tsc -b --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
cd ..
git add frontend/src/shared/ui/
git commit -m "feat(frontend): add Button and Card shadcn primitives in folder-per-component layout"
```

---

## Task 13: Add the product entity (model + api + Public API)

**Files:**
- Create: `frontend/src/entities/product/model/types.ts`
- Create: `frontend/src/entities/product/api/getProducts.ts`
- Create: `frontend/src/entities/product/api/index.ts`
- Create: `frontend/src/entities/product/index.ts`

- [ ] **Step 1: Create `frontend/src/entities/product/model/types.ts`**

Full file:

```ts
import type { components } from "@/shared/api"

export type Product = components["schemas"]["Product"]
```

Note: we alias the generated schema rather than redeclaring. One source of truth — the backend spec.

- [ ] **Step 2: Create `frontend/src/entities/product/api/getProducts.ts`**

Full file:

```ts
import { useQuery } from "@tanstack/react-query"
import { api } from "@/shared/api"
import type { Product } from "../model/types"

export function useProducts() {
  return useQuery<Product[]>({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await api.GET("/api/products")
      if (error) {
        throw new Error(
          `Failed to load products: ${error.detail ?? error.title ?? "unknown error"}`,
        )
      }
      return data ?? []
    },
  })
}
```

Note: Huma serves products as a top-level array at `/api/products`; our backend spec returns `Product[]` (not a wrapper). `error` is Huma's `ErrorModel` (RFC 7807 problem+json).

- [ ] **Step 3: Create `frontend/src/entities/product/api/index.ts`**

Full file:

```ts
export { useProducts } from "./getProducts"
```

- [ ] **Step 4: Create `frontend/src/entities/product/index.ts`**

Full file:

```ts
export { useProducts } from "./api"
export type { Product } from "./model/types"
```

- [ ] **Step 5: Verify the typescript build still passes**

```bash
cd frontend
bunx tsc -b --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd ..
git add frontend/src/entities/
git commit -m "feat(frontend): add product entity with useProducts TanStack Query hook"
```

---

## Task 14: Add QueryClient provider

**Files:**
- Create: `frontend/src/app/providers/query/index.tsx`

- [ ] **Step 1: Create `frontend/src/app/providers/query/index.tsx`**

Full file:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import type { ReactNode } from "react"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

export function QueryProvider({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
```

Note: devtools render a small floating icon in dev only; they no-op in production builds.

- [ ] **Step 2: Commit**

```bash
cd /home/z3tz3r0/Projects/ecommerce-space-craft
git add frontend/src/app/providers/query/
git commit -m "feat(frontend): add TanStack Query provider with sensible defaults"
```

---

## Task 15: Add the App shell

**Files:**
- Create: `frontend/src/app/App.tsx`

- [ ] **Step 1: Create `frontend/src/app/App.tsx`**

Full file:

```tsx
import { Outlet } from "react-router"

export function App() {
  return (
    <div className="min-h-screen">
      <Outlet />
    </div>
  )
}
```

Note: layout shell only. Header/footer widgets land in Phase 1. `min-h-screen` is the only utility — layout (sizing), not style.

- [ ] **Step 2: Verify typescript still parses**

```bash
cd frontend
bunx tsc -b --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd ..
git add frontend/src/app/App.tsx
git commit -m "feat(frontend): add App shell with Outlet"
```

---

## Task 16: Add the HomePage with a render test

**Files:**
- Create: `frontend/src/pages/home/ui/HomePage.tsx`
- Create: `frontend/src/pages/home/ui/HomePage.test.tsx`
- Create: `frontend/src/pages/home/index.ts`

- [ ] **Step 1: Update test setup to stub `VITE_API_URL` globally**

Replace `frontend/src/shared/lib/test-setup.ts` content:

```ts
import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"
import { afterEach, vi } from "vitest"

vi.stubEnv("VITE_API_URL", "https://test.api")

afterEach(() => {
  cleanup()
})
```

Note: stubbing at setup time guarantees `shared/config/env.ts` always sees a valid URL in tests, regardless of whether the suite imports it directly.

- [ ] **Step 2: Write the failing test `frontend/src/pages/home/ui/HomePage.test.tsx`**

Full file:

```tsx
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { HomePage } from "./HomePage"

vi.mock("@/entities/product", () => ({
  useProducts: () => ({
    data: [
      { id: "1", name: "X-Wing" },
      { id: "2", name: "Millennium Falcon" },
      { id: "3", name: "Naboo N-1" },
    ],
    isLoading: false,
    error: null,
  }),
}))

describe("HomePage", () => {
  it("renders the loaded product count", () => {
    render(<HomePage />)
    expect(screen.getByText(/Loaded 3 products/i)).toBeInTheDocument()
  })
})
```

Note: mocking the entity hook keeps the test unit-scoped. Integration between `useProducts` and the real HTTP client is verified by the live smoke test (Task 25) rather than a mock server here.

- [ ] **Step 3: Run the test — it should fail because HomePage doesn't exist**

```bash
cd frontend
bunx vitest run src/pages/home/ui/HomePage.test.tsx
```

Expected: FAIL — module `./HomePage` not found.

- [ ] **Step 4: Implement `frontend/src/pages/home/ui/HomePage.tsx`**

Full file:

```tsx
import { useProducts } from "@/entities/product"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card"

export function HomePage() {
  const { data, isLoading, error } = useProducts()

  return (
    <main className="p-8">
      <Card>
        <CardHeader>
          <CardTitle>Spacecraft Store — Phase 0 Demo</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <p>Loading products…</p>}
          {error && <p>Error: {error.message}</p>}
          {data && <p>Loaded {data.length} products</p>}
        </CardContent>
      </Card>
    </main>
  )
}
```

Layout-only Tailwind verification: only `p-8` used (spacing utility, layout-only). No colors, no typography, no motion.

- [ ] **Step 5: Create `frontend/src/pages/home/index.ts`**

Full file:

```ts
export { HomePage } from "./ui/HomePage"
```

- [ ] **Step 6: Run the test to confirm it passes**

```bash
bunx vitest run src/pages/home/ui/HomePage.test.tsx
```

Expected: PASS (1 test).

- [ ] **Step 7: Commit**

```bash
cd ..
git add frontend/src/pages/home/ frontend/src/shared/lib/test-setup.ts
git commit -m "feat(frontend): add HomePage with useProducts integration and render test"
```

---

## Task 17: Add router provider, compose all providers, and wire the entrypoint

**Files:**
- Create: `frontend/src/app/providers/router/routes.tsx`
- Create: `frontend/src/app/providers/router/index.tsx`
- Create: `frontend/src/app/providers/index.tsx`
- Create: `frontend/src/app/entrypoint/main.tsx`

- [ ] **Step 1: Create `frontend/src/app/providers/router/routes.tsx`**

Full file:

```tsx
import type { RouteObject } from "react-router"
import { HomePage } from "@/pages/home"
import { App } from "@/app/App"

export const routes: RouteObject[] = [
  {
    path: "/",
    element: <App />,
    children: [{ index: true, element: <HomePage /> }],
  },
]
```

Note: both `HomePage` (Task 16) and `App` (Task 15) exist at this point, so imports resolve.

- [ ] **Step 2: Create `frontend/src/app/providers/router/index.tsx`**

Full file:

```tsx
import { BrowserRouter, useRoutes } from "react-router"
import { routes } from "./routes"

function AppRoutes() {
  return useRoutes(routes)
}

export function RouterProvider() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}
```

Note: we use React Router's data-less API for Phase 0. Data-router features (loaders, actions) can be adopted per-slice later; they're not needed for a single demo page.

- [ ] **Step 3: Create `frontend/src/app/providers/index.tsx`**

Full file:

```tsx
import { StrictMode } from "react"
import { QueryProvider } from "./query"
import { RouterProvider } from "./router"

export function Providers() {
  return (
    <StrictMode>
      <QueryProvider>
        <RouterProvider />
      </QueryProvider>
    </StrictMode>
  )
}
```

Note: BrowserRouter lives inside the RouterProvider, so it's automatically the innermost relevant provider under Query. No `<App />` rendered here — routes render it for us.

- [ ] **Step 4: Create `frontend/src/app/entrypoint/main.tsx`**

Full file:

```tsx
import { createRoot } from "react-dom/client"
import { Providers } from "@/app/providers"
import "@/app/styles/global.css"

const rootEl = document.getElementById("root")
if (!rootEl) {
  throw new Error("Root element #root not found in index.html")
}

createRoot(rootEl).render(<Providers />)
```

- [ ] **Step 5: Verify the app builds end-to-end**

```bash
cd frontend
bunx tsc -b --noEmit
bun run build
```

Expected: tsc clean; `vite build` succeeds; `dist/` emitted.

- [ ] **Step 6: Commit**

```bash
cd ..
git add frontend/src/app/providers/ frontend/src/app/entrypoint/
git commit -m "feat(frontend): wire router, compose providers, and add entrypoint"
```

---

## Task 18: Add Biome config and run formatter + linter

**Files:**
- Create: `frontend/biome.json`
- Modify: staged files (auto-formatted)

- [ ] **Step 1: Create `frontend/biome.json`**

Full file:

```json
{
  "$schema": "https://biomejs.dev/schemas/2.0.0/schema.json",
  "files": {
    "includes": ["src/**/*.ts", "src/**/*.tsx", "*.ts", "*.tsx", "*.json"],
    "ignoreUnknown": true,
    "experimentalScannerIgnores": [
      "src/shared/api/generated/**",
      "dist/**",
      "node_modules/**"
    ]
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "linter": {
    "enabled": true,
    "rules": { "recommended": true }
  },
  "javascript": {
    "formatter": {
      "semicolons": "asNeeded",
      "quoteStyle": "double",
      "arrowParentheses": "always",
      "trailingCommas": "all"
    }
  }
}
```

Note: `experimentalScannerIgnores` replaces the older `files.ignore` key in Biome 2. If the installed Biome version predates that (Biome 1.x), use `"ignore": ["src/shared/api/generated/**", "dist/**"]` under `files` instead. Verify with `bunx biome --version`.

- [ ] **Step 2: Run Biome formatter once to normalize the existing code**

```bash
cd frontend
bunx biome format --write .
```

- [ ] **Step 3: Run the Biome check (lint + format verify) and fix any remaining issues**

```bash
bunx biome check .
```

Expected: green (no errors).

If Biome complains about any of our generated or configuration output, expand the ignores block; do not weaken the rules.

- [ ] **Step 4: Commit**

```bash
cd ..
git add frontend/biome.json frontend/
git commit -m "chore(frontend): add Biome config and apply formatter"
```

---

## Task 19: Add Steiger config for FSD boundary enforcement

**Files:**
- Create: `frontend/steiger.config.ts`

- [ ] **Step 1: Create `frontend/steiger.config.ts`**

Full file:

```ts
import { defineConfig } from "steiger"
import fsd from "@feature-sliced/steiger-plugin"

export default defineConfig([
  ...fsd.configs.recommended,
  {
    files: ["src/shared/api/generated/**"],
    rules: { "fsd/public-api": "off" },
  },
])
```

Note: the generated types file doesn't need an index/barrel — hence the scoped rule suppression.

- [ ] **Step 2: Run Steiger**

```bash
cd frontend
bunx steiger src
```

Expected: green, or — if Steiger reports violations — fix them now. Common Phase 0 issues: missing `index.ts` on a populated slice, or an `import` reaching across layers.

- [ ] **Step 3: Commit**

```bash
cd ..
git add frontend/steiger.config.ts
git commit -m "chore(frontend): add Steiger config to enforce FSD boundaries"
```

---

## Task 20: Add package.json scripts and verify the full local pipeline

**Files:**
- Modify: `frontend/package.json` (scripts block)

- [ ] **Step 1: Update `frontend/package.json` scripts to the final shape**

Open `frontend/package.json` and replace the `"scripts"` block with:

```json
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc -b --noEmit",
    "lint": "biome check . && steiger src",
    "format": "biome format --write .",
    "codegen:api": "openapi-typescript ../backend/openapi.json -o src/shared/api/generated/types.ts"
  }
```

- [ ] **Step 2: Run the full local verification pipeline**

```bash
cd frontend
bun run typecheck
bun run lint
bun run test
bun run build
```

Expected: every command exits 0.

- [ ] **Step 3: Commit**

```bash
cd ..
git add frontend/package.json
git commit -m "chore(frontend): consolidate package.json scripts for dev, test, lint, build"
```

---

## Task 21: Extend the root Makefile with frontend targets

**Files:**
- Modify: `Makefile`

- [ ] **Step 1: Open `Makefile` and update targets**

Replace the `install`, `dev`, `build`, `test`, `lint`, `fmt`, `codegen` sections with the versions below. Keep all `migrate-*`, `seed*`, `clean` targets unchanged.

```makefile
# ---------- install / tooling ----------
.PHONY: install
install: install-backend install-frontend ## Install all dependencies

.PHONY: install-backend
install-backend: ## Download Go modules
	cd backend && go mod download

.PHONY: install-frontend
install-frontend: ## Install frontend dependencies with Bun
	cd frontend && bun install

# ---------- dev ----------
.PHONY: dev
dev: ## Run dev servers in parallel
	$(MAKE) -j 2 dev-backend dev-frontend

.PHONY: dev-backend
dev-backend: ## Run the Go API locally
	cd backend && go run ./cmd/api

.PHONY: dev-frontend
dev-frontend: ## Run the Vite dev server
	cd frontend && bun run dev

# ---------- build ----------
.PHONY: build
build: build-backend build-frontend ## Build production binaries and bundles

.PHONY: build-backend
build-backend: ## Build the Go API binary to backend/bin/api
	cd backend && go build -o bin/api ./cmd/api

.PHONY: build-frontend
build-frontend: ## Build the production frontend bundle
	cd frontend && bun run build

# ---------- test ----------
.PHONY: test
test: test-backend test-frontend ## Run all tests

.PHONY: test-backend
test-backend: ## Run Go tests with race detector
	cd backend && go test ./... -race -count=1

.PHONY: test-frontend
test-frontend: ## Run Vitest
	cd frontend && bun run test

# ---------- lint / fmt ----------
.PHONY: lint
lint: lint-backend lint-frontend ## Run all linters

.PHONY: lint-backend
lint-backend: ## Run golangci-lint
	cd backend && golangci-lint run ./...

.PHONY: lint-frontend
lint-frontend: ## Run Biome and Steiger
	cd frontend && bun run lint

.PHONY: typecheck-frontend
typecheck-frontend: ## Run tsc --noEmit on the frontend
	cd frontend && bun run typecheck

.PHONY: fmt
fmt: fmt-backend fmt-frontend ## Format all code

.PHONY: fmt-backend
fmt-backend: ## gofmt + goimports on backend
	cd backend && gofmt -w . && go run golang.org/x/tools/cmd/goimports@latest -w .

.PHONY: fmt-frontend
fmt-frontend: ## Biome format on frontend
	cd frontend && bun run format

# ---------- codegen ----------
.PHONY: codegen
codegen: sqlc-generate openapi-dump codegen-ts ## Regenerate sqlc, OpenAPI, and FE types

.PHONY: sqlc-generate
sqlc-generate: ## Regenerate sqlc Go code from queries.sql
	cd backend && sqlc generate

.PHONY: openapi-dump
openapi-dump: ## Dump Huma's OpenAPI spec to backend/openapi.json
	cd backend && go run ./cmd/openapi > openapi.json

.PHONY: codegen-ts
codegen-ts: ## Regenerate frontend types from backend/openapi.json
	cd frontend && bun run codegen:api
```

Then update the `clean` target to also purge `frontend/dist` and Vite's cache:

```makefile
.PHONY: clean
clean: ## Remove build artifacts
	rm -rf backend/bin frontend/dist frontend/node_modules/.vite
```

- [ ] **Step 2: Verify the new targets**

```bash
cd /home/z3tz3r0/Projects/ecommerce-space-craft
make help
make codegen
git diff --exit-code backend/openapi.json frontend/src/shared/api/generated/types.ts
```

Expected: `make help` lists the new targets; `make codegen` round-trips with zero git diff.

- [ ] **Step 3: Commit**

```bash
git add Makefile
git commit -m "chore(repo): add frontend targets to Makefile"
```

---

## Task 22: Extend Lefthook with Biome and Steiger pre-commit hooks

**Files:**
- Modify: `lefthook.yml`

- [ ] **Step 1: Replace `lefthook.yml` content**

Full file:

```yaml
pre-commit:
  parallel: true
  commands:
    go-fmt:
      glob: "backend/**/*.go"
      run: cd backend && gofmt -l {staged_files} | (! grep .)
    go-lint:
      glob: "backend/**/*.go"
      run: cd backend && golangci-lint run --new-from-rev=HEAD~ ./...
    biome:
      glob: "frontend/**/*.{ts,tsx,js,jsx,json}"
      run: cd frontend && bunx biome check --write --no-errors-on-unmatched {staged_files}
      stage_fixed: true
    steiger:
      glob: "frontend/src/**/*.{ts,tsx}"
      run: cd frontend && bunx steiger src
```

Notes:
- `stage_fixed: true` re-stages files Biome auto-fixed.
- `--no-errors-on-unmatched` prevents Biome from erroring when the staged list contains files it doesn't manage (unlikely here, but defensive).
- Steiger always lints the whole `src/` tree — it needs the full layer context to reason about boundaries.

- [ ] **Step 2: Reinstall Lefthook hooks so they pick up the new config**

```bash
lefthook install
```

Expected: `.git/hooks/pre-commit` updated.

- [ ] **Step 3: Commit (this commit will itself exercise the new hooks)**

```bash
git add lefthook.yml
git commit -m "chore(repo): add Biome and Steiger pre-commit hooks for frontend"
```

Expected: the commit succeeds (nothing to fix in the committed file).

---

## Task 23: Add Vercel SPA rewrite, env example, and frontend .gitignore

**Files:**
- Create: `frontend/vercel.json`
- Create: `frontend/.env.example`
- Modify: `frontend/.gitignore` (confirm entries)

- [ ] **Step 1: Create `frontend/vercel.json`**

Full file:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/" }]
}
```

This fixes the "direct navigation to `/products` 404s" issue the old project had.

- [ ] **Step 2: Create `frontend/.env.example`**

Full file:

```
# Base URL of the backend API (no trailing slash)
# Local dev: http://localhost:8080
# Production: https://spacecraft-api.onrender.com
VITE_API_URL=http://localhost:8080
```

- [ ] **Step 3: Verify `frontend/.gitignore` contents**

The Vite scaffolder creates a sensible default. Confirm the following entries exist (append any missing):

```
node_modules
dist
dist-ssr
*.local
.env
.env.local
```

- [ ] **Step 4: Create a local `frontend/.env` for dev work (NOT committed)**

```bash
cd frontend
echo 'VITE_API_URL=http://localhost:8080' > .env
```

- [ ] **Step 5: Commit**

```bash
cd ..
git add frontend/vercel.json frontend/.env.example frontend/.gitignore
git commit -m "chore(frontend): add Vercel SPA rewrite, env example, and gitignore"
```

---

## Task 24: Add the frontend GitHub Actions workflow

**Files:**
- Create: `.github/workflows/frontend.yml`

- [ ] **Step 1: Create `.github/workflows/frontend.yml`**

Full file:

```yaml
name: Frontend CI

on:
  push:
    branches: [main]
    paths:
      - "frontend/**"
      - "Makefile"
      - ".github/workflows/frontend.yml"
  pull_request:
    paths:
      - "frontend/**"
      - "Makefile"
      - ".github/workflows/frontend.yml"

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest
      - run: cd frontend && bun install --frozen-lockfile
      - run: cd frontend && bun run lint

  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest
      - run: cd frontend && bun install --frozen-lockfile
      - run: cd frontend && bun run typecheck

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest
      - run: cd frontend && bun install --frozen-lockfile
      - run: cd frontend && bun run test

  codegen-drift:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest
      - run: cd frontend && bun install --frozen-lockfile
      - run: cd frontend && bun run codegen:api
      - run: git diff --exit-code frontend/src/shared/api/generated/types.ts

  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest
      - run: cd frontend && bun install --frozen-lockfile
      - run: cd frontend && bun run build
```

Note: each job runs `bun install` independently (cheap with GH Actions cache) for parallelism.

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/frontend.yml
git commit -m "ci(frontend): add GitHub Actions workflow for lint/typecheck/test/codegen-drift/build"
```

---

## Task 25: Local smoke test — dev server hits live backend and renders "Loaded N products"

**Files:** none (this task only runs commands).

- [ ] **Step 1: Point local dev at the live Render backend**

Update `frontend/.env`:

```bash
cd frontend
cat > .env <<'EOF'
VITE_API_URL=https://spacecraft-api.onrender.com
EOF
```

Note: using the live backend keeps this smoke test independent of whether the Go API is also running locally.

- [ ] **Step 2: Start the dev server**

```bash
bun run dev
```

Expected: Vite prints `Local: http://localhost:5173/`.

- [ ] **Step 3: Open the app in a browser and confirm the HomePage renders**

Visit `http://localhost:5173/`. Expected (within a few seconds):

- A `<Card>` with the header "Spacecraft Store — Phase 0 Demo".
- Body text `Loaded 15 products` (matching the seeded count).

Open DevTools → Network → filter `products`. Expected:

- Request to `https://spacecraft-api.onrender.com/api/products`.
- Status `200`, response is a JSON array of 15 products.

Open DevTools → Console. Expected: no errors. (A single React devtools notice is fine.)

- [ ] **Step 4: Stop the dev server**

Ctrl+C.

- [ ] **Step 5: Restore `.env` to localhost for later dev**

```bash
cat > .env <<'EOF'
VITE_API_URL=http://localhost:8080
EOF
```

This task has **no commit**.

---

## Task 26: Update the top-level README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Read the current README**

```bash
cd /home/z3tz3r0/Projects/ecommerce-space-craft
cat README.md
```

- [ ] **Step 2: Update the README to reflect Phase 0b state**

Sections to update:
- **Live URLs:** add the Vercel URL placeholder (fill in after Task 28) alongside the Render backend URL.
- **Tech stack:** add the frontend row (Bun + Vite + React 19 + TS + Tailwind v4 + shadcn/ui + TanStack Query + React Router v7).
- **Local setup:** add `make install-frontend` / `make dev-frontend` and the `frontend/.env` env var.
- **Phase status:** mark Phase 0b complete; Phase 1 up next.
- **Architecture pointer:** note FSD 6-layer layout; link to `docs/superpowers/specs/2026-04-17-phase-0-foundation-design.md`.

Use the same style as the current README — keep it short, tables for structured content.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: update README for Phase 0b frontend foundation"
```

---

## Task 27: Push the branch and open the pull request

**Files:** none (git + gh operations).

- [ ] **Step 1: Push the feature branch**

```bash
cd /home/z3tz3r0/Projects/ecommerce-space-craft
git push -u origin phase-0b/frontend-foundation
```

- [ ] **Step 2: Review what changed on the branch**

```bash
git log --oneline main..HEAD
git diff --stat main...HEAD
```

Expected: ~27 commits; changes under `frontend/`, `.github/workflows/frontend.yml`, `Makefile`, `lefthook.yml`, `README.md`.

- [ ] **Step 3: Open the PR with `gh`**

```bash
gh pr create --base main --head phase-0b/frontend-foundation \
  --title "Phase 0b: Frontend foundation (Bun + Vite + React 19 FSD scaffold)" \
  --body "$(cat <<'EOF'
## Summary

- Scaffolds the React 19 + TypeScript frontend per the Phase 0 spec (see `docs/superpowers/specs/2026-04-17-phase-0-foundation-design.md`).
- FSD 6-layer layout with Steiger boundary enforcement; Public API per slice, no `export *`.
- Tailwind v4 wired (layout-only — color/typography/motion deferred to Phase 4).
- shadcn/ui primitives: Button + Card in folder-per-component layout.
- TanStack Query + React Router v7; providers composed top-down.
- Typed API client: `openapi-typescript` emits paths, `openapi-fetch` runtime. Codegen drift is a CI failure.
- `HomePage` demo fetches from the live Render backend and renders "Loaded N products".
- Biome (lint + format), Vitest + React Testing Library.
- `make install|dev|build|test|lint|codegen` work end-to-end across both sides.
- Pre-commit hooks extended (Biome + Steiger).
- GitHub Actions: lint, typecheck, test, codegen-drift, build.

## Test plan

- [ ] CI turns green (5 jobs).
- [ ] `make test` locally — backend + frontend both pass.
- [ ] `make lint` locally — no Biome or Steiger violations.
- [ ] `make codegen && git diff --exit-code` — no drift.
- [ ] Local dev: `bun run dev` in `frontend/`, visit `/`, see "Loaded 15 products" sourced from the live Render backend.
- [ ] After Vercel deploy, visit the preview URL and confirm the same screen renders (Task 28 follow-up).
EOF
)"
```

- [ ] **Step 4: Wait for CI to go green**

```bash
gh pr checks --watch
```

Expected: all 5 frontend jobs pass. If a job fails, fix locally, push, and rerun this step.

- [ ] **Step 5: Merge the PR**

```bash
gh pr merge --merge --delete-branch
```

Expected: PR merged; feature branch deleted both locally and remotely.

- [ ] **Step 6: Sync local main**

```bash
git checkout main
git pull
```

This task has **no additional commit** (the merge commit is auto-generated).

---

## Task 28: Production deploy — Vercel setup and smoke test

**Files:** none (Vercel dashboard + smoke-test commands).

Vercel setup is a one-time manual step because it involves a browser login and a project-link dance. The Blueprint equivalent (`vercel.json` at root with a project link) can be added later; Phase 0b keeps it dashboard-only to stay honest about what ships.

- [ ] **Step 1: Create a new Vercel project**

In the Vercel dashboard:

1. New Project → import the `ecommerce-space-craft` GitHub repo.
2. Framework preset: **Vite**.
3. Root directory: **`frontend`**.
4. Build command: `bun run build` (Vercel auto-detects; confirm).
5. Install command: `bun install` (Vercel auto-detects; confirm).
6. Output directory: `dist` (Vercel auto-detects; confirm).
7. Environment variables:
   - `VITE_API_URL` = `https://spacecraft-api.onrender.com`
8. Deploy.

- [ ] **Step 2: Wait for the first production deploy to complete**

Watch the build logs in the Vercel dashboard. Expected outcome: green, deploy URL assigned (e.g. `https://ecommerce-space-craft.vercel.app`).

- [ ] **Step 3: Production smoke test**

Visit the Vercel production URL. Expected:

- The `<Card>` renders with "Spacecraft Store — Phase 0 Demo".
- Body text `Loaded 15 products`.
- DevTools Network shows a `200` response from `https://spacecraft-api.onrender.com/api/products`.
- Direct navigation to `<URL>/nonexistent-route` still serves the SPA (the `vercel.json` rewrite fires).

- [ ] **Step 4: Update the backend CORS whitelist to include the Vercel URL**

On Render → `spacecraft-api` service → Environment, update `CORS_ORIGINS`:

```
https://<your-vercel-url>.vercel.app,http://localhost:5173
```

Trigger a manual redeploy on Render so the new env var is picked up.

Re-run Step 3 — the production site should now work without any CORS warnings in DevTools console.

- [ ] **Step 5: Update the README with the real Vercel URL**

```bash
# Back on main with the merged branch synced:
cd /home/z3tz3r0/Projects/ecommerce-space-craft
# Edit README.md — replace the placeholder Vercel URL with the real one.
git add README.md
git commit -m "docs: add production Vercel URL to README"
git push
```

This task has one small commit at the end.

---

## Acceptance checklist — when Plan 0b is "done"

Run through every box before declaring Phase 0 complete.

- [ ] `make install && make migrate-up && make seed && make dev` brings up both sides on a fresh clone with no manual steps beyond setting `frontend/.env` and `backend/.env`.
- [ ] Frontend `HomePage` at `/` calls `useProducts()` via the codegen client and renders "Loaded 15 products" against both local and Render backends.
- [ ] `make codegen && git diff --exit-code` passes (no drift).
- [ ] `make test` passes (backend + frontend).
- [ ] `make lint` passes (`golangci-lint` + `biome check` + `steiger`).
- [ ] `make typecheck-frontend` passes.
- [ ] Lefthook pre-commit blocks unformatted or FSD-violating frontend code.
- [ ] Frontend CI green on `main` (5 jobs).
- [ ] Vercel production URL serves the HomePage end-to-end against the Render backend with no CORS errors.
- [ ] `frontend/vercel.json` SPA rewrite verified by direct navigation to a non-root URL in production.
- [ ] `README.md` lists both production URLs and Phase 0 as complete.

## Explicitly out of scope for Plan 0b

| Out of scope | Where it lives |
|---|---|
| Product list / filter / sort UI | Phase 1 |
| Product detail page | Phase 1 |
| Auth UI and session handling | Phase 2 |
| Cart UI | Phase 2 |
| Checkout flow, Stripe integration | Phase 3 |
| Admin UI | Phase 6 |
| Design tokens, typography, color palette, motion | Phase 4 styling pass |
| Playwright E2E | Phase 3 |
| Storybook / component gallery | Not planned — shadcn's own docs cover the primitives |
| MSW-based integration tests for more entities | Grows with each feature phase |
