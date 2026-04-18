# Phase 1b — Catalog Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the public catalog UI: a `/products` page with category filter, sort, and search; a `/products/:id` detail page; a featured section on `/`; and a stock-status badge. All client-side filtering/sorting/searching over the existing `useProducts` cache. URL is the source of truth for filter/sort/search state.

**Architecture:** Pure FSD layering. New entities/product hooks (`useProduct`, `useFeaturedProducts`) extend the Phase 0 list hook. Three feature slices (`catalog-filter`, `catalog-sort`, `catalog-search`) each own a tiny URL-state hook plus its UI. Three new widgets (`product-card`, `product-grid`, `filter-sidebar`, `featured-section`) compose entities + features. Three new pages (`catalog`, `product-detail`, updated `home`) wire it together. Patterns ported from `basia-borkowska/terracota-store` (URL-state + ProductCard) and `itsproutorgua/olx-killer-monorepo` (hook idioms). Layout-only Tailwind throughout — shadcn primitive defaults only.

**Tech Stack:** React 19, TypeScript 6, Vite 8, TanStack Query 5, react-router 7, openapi-fetch 0.17, Tailwind v4, shadcn/ui, Vitest 4, React Testing Library 16, Biome 2.4, Steiger.

**Spec reference:** [`docs/superpowers/specs/2026-04-18-phase-1-catalog-design.md`](../specs/2026-04-18-phase-1-catalog-design.md) Sections 2 & 3.

**Prerequisite:** Plan 1a (`phase-1a/catalog-backend`) MUST be merged to `main` before this plan starts. The frontend's regenerated `types.ts` and `useFeaturedProducts` hook depend on the new `?featured=true` query parameter and the `is_featured` field on `Product`.

---

## Task 1: Branch + regenerate frontend types from new OpenAPI

**Files:**
- Regenerate: `frontend/src/shared/api/generated/types.ts`

- [ ] **Step 1: Branch off the freshly merged main**

```bash
cd /home/z3tz3r0/Projects/ecommerce-space-craft
git checkout main && git pull
git checkout -b phase-1b/catalog-frontend
```

Confirm `backend/openapi.json` includes the new fields:

```bash
grep -c '"isFeatured"' backend/openapi.json   # expected: ≥ 2
grep -c '"name":"featured"' backend/openapi.json   # expected: 1
```

- [ ] **Step 2: Regenerate the frontend's typed API client**

Run: `make codegen-ts`

(Equivalent to `cd frontend && bun run codegen:api`.)

- [ ] **Step 3: Verify regenerated types include the new shape**

```bash
grep -c 'isFeatured' frontend/src/shared/api/generated/types.ts   # expected: ≥ 1
grep -A2 'listProducts' frontend/src/shared/api/generated/types.ts | head -20
```

The `listProducts` operation should now have a `parameters.query` block with `featured?: boolean` and `limit?: number` fields.

- [ ] **Step 4: Run existing tests + lint to confirm nothing regressed**

```bash
cd frontend && bun run test && bun run lint && bun run typecheck
```

Expected: all green. The Phase 0 `HomePage.test.tsx` and `env.test.ts` still pass.

- [ ] **Step 5: Commit**

```bash
cd /home/z3tz3r0/Projects/ecommerce-space-craft
git add frontend/src/shared/api/generated/types.ts
git commit -m "chore(codegen): regenerate frontend types for is_featured + ?featured"
```

---

## Task 2: Shared helpers — `use-query-params` + `format-price`

Two small `shared/lib` utilities that downstream tasks depend on.

**Files:**
- Create: `frontend/src/shared/lib/use-query-params.ts`
- Create: `frontend/src/shared/lib/use-query-params.test.tsx`
- Create: `frontend/src/shared/lib/format-price.ts`
- Create: `frontend/src/shared/lib/format-price.test.ts`

- [ ] **Step 1: Write failing test for `formatPrice`**

Create `frontend/src/shared/lib/format-price.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { formatPrice } from "./format-price"

describe("formatPrice", () => {
  it("formats 0 cents as $0.00", () => {
    expect(formatPrice(0)).toBe("$0.00")
  })

  it("formats whole dollars", () => {
    expect(formatPrice(100)).toBe("$1.00")
    expect(formatPrice(99900)).toBe("$999.00")
  })

  it("formats with cents precision", () => {
    expect(formatPrice(123)).toBe("$1.23")
    expect(formatPrice(99999)).toBe("$999.99")
  })

  it("formats large amounts with thousands separators", () => {
    expect(formatPrice(1234567)).toBe("$12,345.67")
    expect(formatPrice(1000000000)).toBe("$10,000,000.00")
  })

  it("handles negative cents (refund display)", () => {
    expect(formatPrice(-500)).toBe("-$5.00")
  })
})
```

- [ ] **Step 2: Run failing test**

Run: `cd frontend && bun run test format-price`
Expected: FAIL — `Cannot find module './format-price'`.

- [ ] **Step 3: Implement `formatPrice`**

Create `frontend/src/shared/lib/format-price.ts`:

```ts
const formatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatPrice(cents: number): string {
  return formatter.format(cents / 100)
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `cd frontend && bun run test format-price`
Expected: 5 PASS.

- [ ] **Step 5: Write failing test for `useQueryParam`**

Create `frontend/src/shared/lib/use-query-params.test.tsx`:

```tsx
import { act, renderHook } from "@testing-library/react"
import type { ReactNode } from "react"
import { MemoryRouter } from "react-router"
import { describe, expect, it } from "vitest"
import { useQueryParam, useQueryParamList } from "./use-query-params"

function makeWrapper(initialEntries: string[]) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
  }
}

describe("useQueryParam (single value)", () => {
  it("reads the current value from the URL", () => {
    const { result } = renderHook(() => useQueryParam("q"), {
      wrapper: makeWrapper(["/products?q=tie"]),
    })
    expect(result.current[0]).toBe("tie")
  })

  it("returns null when the key is absent", () => {
    const { result } = renderHook(() => useQueryParam("q"), {
      wrapper: makeWrapper(["/products"]),
    })
    expect(result.current[0]).toBeNull()
  })

  it("setter writes the value to the URL", () => {
    const { result } = renderHook(() => useQueryParam("q"), {
      wrapper: makeWrapper(["/products"]),
    })
    act(() => result.current[1]("hello"))
    expect(result.current[0]).toBe("hello")
  })

  it("setter clears the key when given null", () => {
    const { result } = renderHook(() => useQueryParam("q"), {
      wrapper: makeWrapper(["/products?q=tie"]),
    })
    act(() => result.current[1](null))
    expect(result.current[0]).toBeNull()
  })

  it("setter clears the key when given empty string", () => {
    const { result } = renderHook(() => useQueryParam("q"), {
      wrapper: makeWrapper(["/products?q=tie"]),
    })
    act(() => result.current[1](""))
    expect(result.current[0]).toBeNull()
  })
})

describe("useQueryParamList (multi value)", () => {
  it("reads all values for a repeated key", () => {
    const { result } = renderHook(() => useQueryParamList("category"), {
      wrapper: makeWrapper(["/products?category=Fighter&category=Cruiser"]),
    })
    expect(result.current[0]).toEqual(["Fighter", "Cruiser"])
  })

  it("returns empty array when key is absent", () => {
    const { result } = renderHook(() => useQueryParamList("category"), {
      wrapper: makeWrapper(["/products"]),
    })
    expect(result.current[0]).toEqual([])
  })

  it("setter replaces the full list", () => {
    const { result } = renderHook(() => useQueryParamList("category"), {
      wrapper: makeWrapper(["/products?category=Fighter"]),
    })
    act(() => result.current[1](["Cruiser", "Shuttle"]))
    expect(result.current[0]).toEqual(["Cruiser", "Shuttle"])
  })

  it("setter with empty array clears the key entirely", () => {
    const { result } = renderHook(() => useQueryParamList("category"), {
      wrapper: makeWrapper(["/products?category=Fighter&category=Cruiser"]),
    })
    act(() => result.current[1]([]))
    expect(result.current[0]).toEqual([])
  })
})
```

- [ ] **Step 6: Run failing test**

Run: `cd frontend && bun run test use-query-params`
Expected: FAIL — `Cannot find module './use-query-params'`.

- [ ] **Step 7: Implement `useQueryParam` and `useQueryParamList`**

Create `frontend/src/shared/lib/use-query-params.ts`:

```ts
import { useCallback } from "react"
import { useSearchParams } from "react-router"

export function useQueryParam(key: string) {
  const [params, setParams] = useSearchParams()
  const value = params.get(key)

  const setValue = useCallback(
    (next: string | null) => {
      const nextParams = new URLSearchParams(params)
      if (next === null || next === "") {
        nextParams.delete(key)
      } else {
        nextParams.set(key, next)
      }
      setParams(nextParams, { replace: true })
    },
    [key, params, setParams],
  )

  return [value, setValue] as const
}

export function useQueryParamList(key: string) {
  const [params, setParams] = useSearchParams()
  const values = params.getAll(key)

  const setValues = useCallback(
    (next: string[]) => {
      const nextParams = new URLSearchParams(params)
      nextParams.delete(key)
      for (const v of next) {
        nextParams.append(key, v)
      }
      setParams(nextParams, { replace: true })
    },
    [key, params, setParams],
  )

  return [values, setValues] as const
}
```

- [ ] **Step 8: Run tests to verify pass**

Run: `cd frontend && bun run test use-query-params`
Expected: 9 PASS (5 single-value + 4 multi-value).

- [ ] **Step 9: Lint + typecheck**

```bash
cd frontend && bun run lint && bun run typecheck
```

Expected: green.

- [ ] **Step 10: Commit**

```bash
cd /home/z3tz3r0/Projects/ecommerce-space-craft
git add frontend/src/shared/lib/use-query-params.ts \
        frontend/src/shared/lib/use-query-params.test.tsx \
        frontend/src/shared/lib/format-price.ts \
        frontend/src/shared/lib/format-price.test.ts
git commit -m "feat(shared/lib): add useQueryParam(List) and formatPrice helpers"
```

---

## Task 3: `entities/product` model — stock + Category constant

**Files:**
- Create: `frontend/src/entities/product/model/stock.ts`
- Create: `frontend/src/entities/product/model/stock.test.ts`
- Create: `frontend/src/entities/product/model/categories.ts`
- Modify: `frontend/src/entities/product/model/types.ts`
- Modify: `frontend/src/entities/product/index.ts` (extend Public API)

- [ ] **Step 1: Write failing test for `stockStatus`**

Create `frontend/src/entities/product/model/stock.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { stockStatus, stockLabel } from "./stock"

describe("stockStatus", () => {
  it("returns 'out' for zero", () => {
    expect(stockStatus(0)).toBe("out")
  })

  it("returns 'out' for negative (defensive)", () => {
    expect(stockStatus(-3)).toBe("out")
  })

  it("returns 'low' for 1 through 5 inclusive", () => {
    expect(stockStatus(1)).toBe("low")
    expect(stockStatus(3)).toBe("low")
    expect(stockStatus(5)).toBe("low")
  })

  it("returns 'in' for 6 and above", () => {
    expect(stockStatus(6)).toBe("in")
    expect(stockStatus(50)).toBe("in")
    expect(stockStatus(9999)).toBe("in")
  })
})

describe("stockLabel", () => {
  it("returns 'Out of stock' for out", () => {
    expect(stockLabel(0)).toBe("Out of stock")
  })

  it("returns 'Low stock — N left' for low", () => {
    expect(stockLabel(3)).toBe("Low stock — 3 left")
    expect(stockLabel(1)).toBe("Low stock — 1 left")
  })

  it("returns 'In stock' for in", () => {
    expect(stockLabel(6)).toBe("In stock")
    expect(stockLabel(100)).toBe("In stock")
  })
})
```

- [ ] **Step 2: Run failing test**

Run: `cd frontend && bun run test stock`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `stockStatus` + `stockLabel`**

Create `frontend/src/entities/product/model/stock.ts`:

```ts
export type StockStatus = "in" | "low" | "out"

export function stockStatus(quantity: number): StockStatus {
  if (quantity <= 0) return "out"
  if (quantity <= 5) return "low"
  return "in"
}

export function stockLabel(quantity: number): string {
  const status = stockStatus(quantity)
  if (status === "out") return "Out of stock"
  if (status === "low") return `Low stock — ${quantity} left`
  return "In stock"
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `cd frontend && bun run test stock`
Expected: 7 PASS.

- [ ] **Step 5: Add the Category constant**

Create `frontend/src/entities/product/model/categories.ts`:

```ts
import type { Product } from "./types"

export const CATEGORIES = [
  "Fighter",
  "Freighter",
  "Shuttle",
  "Speeder",
  "Cruiser",
  "Capital Ship",
] as const satisfies readonly Product["category"][]

export type Category = (typeof CATEGORIES)[number]
```

- [ ] **Step 6: Extend the entity Public API**

Replace `frontend/src/entities/product/index.ts`:

```ts
export { useProducts } from "./api/getProducts"
export { CATEGORIES } from "./model/categories"
export type { Category } from "./model/categories"
export { stockLabel, stockStatus } from "./model/stock"
export type { StockStatus } from "./model/stock"
export type { Product } from "./model/types"
```

- [ ] **Step 7: Lint + typecheck + tests**

```bash
cd frontend && bun run test && bun run lint && bun run typecheck
```

Expected: all green.

- [ ] **Step 8: Commit**

```bash
cd /home/z3tz3r0/Projects/ecommerce-space-craft
git add frontend/src/entities/product/model/stock.ts \
        frontend/src/entities/product/model/stock.test.ts \
        frontend/src/entities/product/model/categories.ts \
        frontend/src/entities/product/index.ts
git commit -m "feat(entities/product): add stockStatus, stockLabel, CATEGORIES"
```

---

## Task 4: `entities/product/api` — query keys + `useProduct` + `useFeaturedProducts`

**Files:**
- Create: `frontend/src/entities/product/api/product-keys.ts`
- Create: `frontend/src/entities/product/api/getProduct.ts`
- Create: `frontend/src/entities/product/api/getProduct.test.ts`
- Create: `frontend/src/entities/product/api/getFeaturedProducts.ts`
- Create: `frontend/src/entities/product/api/getFeaturedProducts.test.ts`
- Modify: `frontend/src/entities/product/api/getProducts.ts` (use new key factory)
- Modify: `frontend/src/entities/product/index.ts` (extend Public API)

- [ ] **Step 1: Write the query key factory**

Create `frontend/src/entities/product/api/product-keys.ts`:

```ts
export const productKeys = {
  all: ["products"] as const,
  list: () => [...productKeys.all, "list"] as const,
  detail: (id: string) => [...productKeys.all, "detail", id] as const,
  featured: (limit: number) => [...productKeys.all, "featured", limit] as const,
}
```

- [ ] **Step 2: Update existing `useProducts` to use the key factory**

Replace `frontend/src/entities/product/api/getProducts.ts`:

```ts
import { useQuery } from "@tanstack/react-query"
import { api } from "@/shared/api"
import type { Product } from "../model/types"
import { productKeys } from "./product-keys"

export function useProducts() {
  return useQuery<Product[]>({
    queryKey: productKeys.list(),
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

- [ ] **Step 3: Write failing test for `useProduct`**

Create `frontend/src/entities/product/api/getProduct.test.ts`:

```ts
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useProduct } from "./getProduct"

const mockGet = vi.fn()
vi.mock("@/shared/api", () => ({
  api: {
    GET: (...args: unknown[]) => mockGet(...args),
  },
}))

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

beforeEach(() => mockGet.mockReset())
afterEach(() => mockGet.mockReset())

describe("useProduct", () => {
  it("calls GET /api/products/:id with the path param", async () => {
    mockGet.mockResolvedValue({ data: { id: "abc", name: "X-Wing" }, error: undefined })

    const { result } = renderHook(() => useProduct("abc"), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockGet).toHaveBeenCalledWith("/api/products/{id}", {
      params: { path: { id: "abc" } },
    })
    expect(result.current.data).toEqual({ id: "abc", name: "X-Wing" })
  })

  it("throws when the API returns an error envelope", async () => {
    mockGet.mockResolvedValue({ data: undefined, error: { title: "Not Found", status: 404 } })

    const { result } = renderHook(() => useProduct("missing"), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toMatch(/not found/i)
  })

  it("is disabled when id is empty", () => {
    const { result } = renderHook(() => useProduct(""), { wrapper: makeWrapper() })
    expect(result.current.fetchStatus).toBe("idle")
    expect(mockGet).not.toHaveBeenCalled()
  })
})
```

(The `getProduct.test.ts` file uses TSX syntax via the `Wrapper` JSX. Vitest handles `.tsx` automatically; the `.ts` extension still works because there's no JSX inside the wrapper function body — the JSX is only inside the function it returns. If Vitest complains about JSX in a `.ts` file, rename to `.test.tsx`.)

- [ ] **Step 4: Run failing test**

Run: `cd frontend && bun run test getProduct`
Expected: FAIL — module not found.

- [ ] **Step 5: Implement `useProduct`**

Create `frontend/src/entities/product/api/getProduct.ts`:

```ts
import { useQuery } from "@tanstack/react-query"
import { api } from "@/shared/api"
import type { Product } from "../model/types"
import { productKeys } from "./product-keys"

export function useProduct(id: string) {
  return useQuery<Product>({
    queryKey: productKeys.detail(id),
    enabled: id !== "",
    queryFn: async () => {
      const { data, error } = await api.GET("/api/products/{id}", {
        params: { path: { id } },
      })
      if (error) {
        throw new Error(
          `Failed to load product: ${error.detail ?? error.title ?? "unknown error"}`,
        )
      }
      if (!data) {
        throw new Error("Failed to load product: empty response")
      }
      return data
    },
  })
}
```

- [ ] **Step 6: Run tests to verify pass**

Run: `cd frontend && bun run test getProduct`
Expected: 3 PASS. If JSX-in-`.ts` complaint, rename test file to `getProduct.test.tsx`.

- [ ] **Step 7: Write failing test for `useFeaturedProducts`**

Create `frontend/src/entities/product/api/getFeaturedProducts.test.ts`:

```ts
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useFeaturedProducts } from "./getFeaturedProducts"

const mockGet = vi.fn()
vi.mock("@/shared/api", () => ({
  api: {
    GET: (...args: unknown[]) => mockGet(...args),
  },
}))

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

beforeEach(() => mockGet.mockReset())
afterEach(() => mockGet.mockReset())

describe("useFeaturedProducts", () => {
  it("calls GET /api/products with featured=true and the requested limit", async () => {
    mockGet.mockResolvedValue({ data: [{ id: "1" }, { id: "2" }], error: undefined })

    const { result } = renderHook(() => useFeaturedProducts(4), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockGet).toHaveBeenCalledWith("/api/products", {
      params: { query: { featured: true, limit: 4 } },
    })
    expect(result.current.data).toHaveLength(2)
  })

  it("uses limit=4 when no argument is passed", async () => {
    mockGet.mockResolvedValue({ data: [], error: undefined })

    renderHook(() => useFeaturedProducts(), { wrapper: makeWrapper() })

    await waitFor(() => expect(mockGet).toHaveBeenCalled())
    expect(mockGet).toHaveBeenCalledWith("/api/products", {
      params: { query: { featured: true, limit: 4 } },
    })
  })

  it("throws when the API returns an error envelope", async () => {
    mockGet.mockResolvedValue({ data: undefined, error: { title: "Server Error" } })

    const { result } = renderHook(() => useFeaturedProducts(4), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})
```

- [ ] **Step 8: Run failing test**

Run: `cd frontend && bun run test getFeaturedProducts`
Expected: FAIL — module not found.

- [ ] **Step 9: Implement `useFeaturedProducts`**

Create `frontend/src/entities/product/api/getFeaturedProducts.ts`:

```ts
import { useQuery } from "@tanstack/react-query"
import { api } from "@/shared/api"
import type { Product } from "../model/types"
import { productKeys } from "./product-keys"

const DEFAULT_LIMIT = 4

export function useFeaturedProducts(limit: number = DEFAULT_LIMIT) {
  return useQuery<Product[]>({
    queryKey: productKeys.featured(limit),
    queryFn: async () => {
      const { data, error } = await api.GET("/api/products", {
        params: { query: { featured: true, limit } },
      })
      if (error) {
        throw new Error(
          `Failed to load featured products: ${error.detail ?? error.title ?? "unknown error"}`,
        )
      }
      return data ?? []
    },
  })
}
```

- [ ] **Step 10: Run tests to verify pass**

Run: `cd frontend && bun run test getFeaturedProducts`
Expected: 3 PASS.

- [ ] **Step 11: Extend the entity Public API**

Replace `frontend/src/entities/product/index.ts`:

```ts
export { useFeaturedProducts } from "./api/getFeaturedProducts"
export { useProduct } from "./api/getProduct"
export { useProducts } from "./api/getProducts"
export { productKeys } from "./api/product-keys"
export { CATEGORIES } from "./model/categories"
export type { Category } from "./model/categories"
export { stockLabel, stockStatus } from "./model/stock"
export type { StockStatus } from "./model/stock"
export type { Product } from "./model/types"
```

- [ ] **Step 12: Lint + typecheck + tests**

```bash
cd frontend && bun run test && bun run lint && bun run typecheck
```

Expected: all green.

- [ ] **Step 13: Commit**

```bash
cd /home/z3tz3r0/Projects/ecommerce-space-craft
git add frontend/src/entities/product/api/ frontend/src/entities/product/index.ts
git commit -m "feat(entities/product): add useProduct, useFeaturedProducts, query keys"
```

---

## Task 5: shadcn primitives + `entities/product/ui/stock-badge`

We need 4 new shadcn primitives to compose the rest of the work: `Badge`, `Skeleton`, `Checkbox`, `Input`, `Select`. Add them all here so subsequent tasks just consume them.

**Files:**
- Create: `frontend/src/shared/ui/badge/Badge.tsx` + `index.ts`
- Create: `frontend/src/shared/ui/skeleton/Skeleton.tsx` + `index.ts`
- Create: `frontend/src/shared/ui/checkbox/Checkbox.tsx` + `index.ts`
- Create: `frontend/src/shared/ui/input/Input.tsx` + `index.ts`
- Create: `frontend/src/shared/ui/select/Select.tsx` + `index.ts`
- Create: `frontend/src/entities/product/ui/stock-badge/StockBadge.tsx` + `index.ts`
- Create: `frontend/src/entities/product/ui/stock-badge/StockBadge.test.tsx`
- Modify: `frontend/src/entities/product/index.ts`

- [ ] **Step 1: Add the shadcn primitives via the CLI**

Run from the repo root:

```bash
cd frontend
bunx shadcn@latest add badge skeleton checkbox input select
```

When prompted, accept the install of any new radix-ui sub-deps (the umbrella `radix-ui` package already covers most). The CLI writes flat `.tsx` files into `src/shared/ui/`.

- [ ] **Step 2: Reorganize each primitive into folder-per-component layout**

Per `frontend_build_quirks.md` note 5, shadcn emits flat files; we want folder-per-component with an `index.ts`. For each newly-added file:

```bash
cd frontend/src/shared/ui

# Badge
mkdir -p badge && mv badge.tsx badge/Badge.tsx
cat > badge/index.ts <<'EOF'
export { Badge, badgeVariants } from "./Badge"
EOF

# Skeleton
mkdir -p skeleton && mv skeleton.tsx skeleton/Skeleton.tsx
cat > skeleton/index.ts <<'EOF'
export { Skeleton } from "./Skeleton"
EOF

# Checkbox
mkdir -p checkbox && mv checkbox.tsx checkbox/Checkbox.tsx
cat > checkbox/index.ts <<'EOF'
export { Checkbox } from "./Checkbox"
EOF

# Input
mkdir -p input && mv input.tsx input/Input.tsx
cat > input/index.ts <<'EOF'
export { Input } from "./Input"
EOF

# Select
mkdir -p select && mv select.tsx select/Select.tsx
cat > select/index.ts <<'EOF'
export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "./Select"
EOF
```

If the shadcn CLI for `Select` exports a different set of named pieces, adjust the `select/index.ts` re-exports to match what's actually in the file. Open `select/Select.tsx` and copy the exact `export` lines.

- [ ] **Step 3: Update internal imports inside the moved files**

Each moved file may contain a relative import like `import { cn } from "../../lib/utils"` — verify the relative path still resolves from the new folder location. The `cn` helper lives at `frontend/src/shared/lib/utils.ts`, so from `src/shared/ui/<comp>/Comp.tsx` the correct relative import is `../../lib/utils`. If the CLI used `@/lib/utils` instead, leave it alone if your alias supports it; otherwise change to the relative form above.

For each moved file, run:

```bash
cd frontend && bun run typecheck
```

If errors appear, fix the import paths and rerun until clean.

- [ ] **Step 4: Run lint + format on the new files**

```bash
cd frontend && bun run format && bun run lint
```

Expected: no errors. Biome may reformat the shadcn-generated code — that's fine, commit the reformatted version.

- [ ] **Step 5: Write failing test for `StockBadge`**

Create `frontend/src/entities/product/ui/stock-badge/StockBadge.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { StockBadge } from "./StockBadge"

describe("StockBadge", () => {
  it("renders 'In stock' when quantity is high", () => {
    render(<StockBadge quantity={10} />)
    expect(screen.getByText("In stock")).toBeInTheDocument()
  })

  it("renders 'Low stock — N left' when quantity is 1-5", () => {
    render(<StockBadge quantity={3} />)
    expect(screen.getByText("Low stock — 3 left")).toBeInTheDocument()
  })

  it("renders 'Out of stock' when quantity is zero", () => {
    render(<StockBadge quantity={0} />)
    expect(screen.getByText("Out of stock")).toBeInTheDocument()
  })

  it("renders 'Out of stock' when quantity is negative (defensive)", () => {
    render(<StockBadge quantity={-1} />)
    expect(screen.getByText("Out of stock")).toBeInTheDocument()
  })
})
```

- [ ] **Step 6: Run failing test**

Run: `cd frontend && bun run test StockBadge`
Expected: FAIL — module not found.

- [ ] **Step 7: Implement `StockBadge`**

Create `frontend/src/entities/product/ui/stock-badge/StockBadge.tsx`:

```tsx
import { Badge } from "@/shared/ui/badge"
import { stockLabel, stockStatus } from "../../model/stock"

interface StockBadgeProps {
  quantity: number
}

export function StockBadge({ quantity }: StockBadgeProps) {
  const status = stockStatus(quantity)
  const variant = status === "in" ? "default" : status === "low" ? "secondary" : "outline"
  return <Badge variant={variant}>{stockLabel(quantity)}</Badge>
}
```

Note: deliberately uses `outline` (not `destructive`) for out-of-stock so the layout-only-Tailwind discipline holds — see spec Section 2.6.

Create `frontend/src/entities/product/ui/stock-badge/index.ts`:

```ts
export { StockBadge } from "./StockBadge"
```

- [ ] **Step 8: Run tests to verify pass**

Run: `cd frontend && bun run test StockBadge`
Expected: 4 PASS.

- [ ] **Step 9: Extend the entity Public API to export StockBadge**

Add this line to `frontend/src/entities/product/index.ts` (in the alphabetical position):

```ts
export { StockBadge } from "./ui/stock-badge"
```

Final entity index should be:

```ts
export { useFeaturedProducts } from "./api/getFeaturedProducts"
export { useProduct } from "./api/getProduct"
export { useProducts } from "./api/getProducts"
export { productKeys } from "./api/product-keys"
export { CATEGORIES } from "./model/categories"
export type { Category } from "./model/categories"
export { stockLabel, stockStatus } from "./model/stock"
export type { StockStatus } from "./model/stock"
export type { Product } from "./model/types"
export { StockBadge } from "./ui/stock-badge"
```

- [ ] **Step 10: Final lint + typecheck + tests + steiger**

```bash
cd frontend && bun run test && bun run lint && bun run typecheck
```

Expected: all green. Steiger should be satisfied — no `fsd/insignificant-slice` violations because we now have real content in `entities/product/ui/`.

- [ ] **Step 11: Commit**

```bash
cd /home/z3tz3r0/Projects/ecommerce-space-craft
git add frontend/src/shared/ui/ \
        frontend/src/entities/product/ui/ \
        frontend/src/entities/product/index.ts
git commit -m "feat(ui): add shadcn Badge/Skeleton/Checkbox/Input/Select + StockBadge"
```

---

## Task 6: Three feature slices — `catalog-filter`, `catalog-sort`, `catalog-search`

All three follow the same URL-state idiom. Bundling them into one task because they share helpers and test patterns.

**Files:**
- Create: `frontend/src/features/catalog-filter/model/use-category-filter.ts`
- Create: `frontend/src/features/catalog-filter/model/use-category-filter.test.tsx`
- Create: `frontend/src/features/catalog-filter/index.ts`
- Create: `frontend/src/features/catalog-sort/model/sort.ts`
- Create: `frontend/src/features/catalog-sort/model/sort.test.ts`
- Create: `frontend/src/features/catalog-sort/model/use-sort-order.ts`
- Create: `frontend/src/features/catalog-sort/ui/SortDropdown.tsx`
- Create: `frontend/src/features/catalog-sort/index.ts`
- Create: `frontend/src/features/catalog-search/model/use-search-query.ts`
- Create: `frontend/src/features/catalog-search/model/use-search-query.test.tsx`
- Create: `frontend/src/features/catalog-search/ui/SearchInput.tsx`
- Create: `frontend/src/features/catalog-search/index.ts`

- [ ] **Step 1: Write failing test for `useCategoryFilter` (multi-select)**

Create `frontend/src/features/catalog-filter/model/use-category-filter.test.tsx`:

```tsx
import { act, renderHook } from "@testing-library/react"
import type { ReactNode } from "react"
import { MemoryRouter } from "react-router"
import { describe, expect, it } from "vitest"
import { useCategoryFilter } from "./use-category-filter"

function makeWrapper(initialEntries: string[]) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
  }
}

describe("useCategoryFilter", () => {
  it("reads selected categories from URL", () => {
    const { result } = renderHook(() => useCategoryFilter(), {
      wrapper: makeWrapper(["/products?category=Fighter&category=Cruiser"]),
    })
    expect(result.current.selected).toEqual(["Fighter", "Cruiser"])
  })

  it("ignores invalid category values in URL", () => {
    const { result } = renderHook(() => useCategoryFilter(), {
      wrapper: makeWrapper(["/products?category=Fighter&category=Bogus"]),
    })
    expect(result.current.selected).toEqual(["Fighter"])
  })

  it("toggle adds a category when not selected", () => {
    const { result } = renderHook(() => useCategoryFilter(), {
      wrapper: makeWrapper(["/products"]),
    })
    act(() => result.current.toggle("Fighter"))
    expect(result.current.selected).toEqual(["Fighter"])
  })

  it("toggle removes a category when already selected", () => {
    const { result } = renderHook(() => useCategoryFilter(), {
      wrapper: makeWrapper(["/products?category=Fighter&category=Cruiser"]),
    })
    act(() => result.current.toggle("Fighter"))
    expect(result.current.selected).toEqual(["Cruiser"])
  })

  it("isSelected reflects current state", () => {
    const { result } = renderHook(() => useCategoryFilter(), {
      wrapper: makeWrapper(["/products?category=Fighter"]),
    })
    expect(result.current.isSelected("Fighter")).toBe(true)
    expect(result.current.isSelected("Cruiser")).toBe(false)
  })

  it("clear empties selection and removes URL key", () => {
    const { result } = renderHook(() => useCategoryFilter(), {
      wrapper: makeWrapper(["/products?category=Fighter&category=Cruiser"]),
    })
    act(() => result.current.clear())
    expect(result.current.selected).toEqual([])
  })
})
```

- [ ] **Step 2: Run failing test**

Run: `cd frontend && bun run test use-category-filter`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `useCategoryFilter`**

Create `frontend/src/features/catalog-filter/model/use-category-filter.ts`:

```ts
import { useCallback, useMemo } from "react"
import { CATEGORIES, type Category } from "@/entities/product"
import { useQueryParamList } from "@/shared/lib/use-query-params"

const ALLOWED = new Set<string>(CATEGORIES)

export function useCategoryFilter() {
  const [raw, setRaw] = useQueryParamList("category")

  const selected = useMemo(
    () => raw.filter((v): v is Category => ALLOWED.has(v)),
    [raw],
  )

  const toggle = useCallback(
    (cat: Category) => {
      const set = new Set(selected)
      if (set.has(cat)) set.delete(cat)
      else set.add(cat)
      setRaw(Array.from(set))
    },
    [selected, setRaw],
  )

  const clear = useCallback(() => setRaw([]), [setRaw])

  const isSelected = useCallback((cat: Category) => selected.includes(cat), [selected])

  return { selected, toggle, clear, isSelected }
}
```

- [ ] **Step 4: Run tests and create the feature Public API**

Run: `cd frontend && bun run test use-category-filter`
Expected: 6 PASS.

Create `frontend/src/features/catalog-filter/index.ts`:

```ts
export { useCategoryFilter } from "./model/use-category-filter"
```

- [ ] **Step 5: Write failing test for the sort helper**

Create `frontend/src/features/catalog-sort/model/sort.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { type SortOrder, sortProducts } from "./sort"

const products = [
  { id: "a", name: "B Ship", priceCents: 200, createdAt: "2026-04-10T00:00:00Z" },
  { id: "b", name: "A Ship", priceCents: 300, createdAt: "2026-04-12T00:00:00Z" },
  { id: "c", name: "C Ship", priceCents: 100, createdAt: "2026-04-11T00:00:00Z" },
] as const

describe("sortProducts", () => {
  it("sorts by newest (createdAt DESC) by default", () => {
    expect(sortProducts(products as unknown[], "newest").map((p: any) => p.id)).toEqual([
      "b",
      "c",
      "a",
    ])
  })

  it("sorts by price ascending", () => {
    expect(sortProducts(products as unknown[], "price-asc").map((p: any) => p.id)).toEqual([
      "c",
      "a",
      "b",
    ])
  })

  it("sorts by price descending", () => {
    expect(sortProducts(products as unknown[], "price-desc").map((p: any) => p.id)).toEqual([
      "b",
      "a",
      "c",
    ])
  })

  it("does not mutate the input array", () => {
    const input = [...products] as unknown[]
    const orig = input.map((p: any) => p.id)
    sortProducts(input, "price-asc")
    expect(input.map((p: any) => p.id)).toEqual(orig)
  })

  it("handles empty array", () => {
    expect(sortProducts([], "newest")).toEqual([])
  })

  const allOrders: SortOrder[] = ["newest", "price-asc", "price-desc"]
  for (const order of allOrders) {
    it(`returns same length for sort=${order}`, () => {
      expect(sortProducts(products as unknown[], order)).toHaveLength(3)
    })
  }
})
```

- [ ] **Step 6: Run failing test**

Run: `cd frontend && bun run test 'catalog-sort/model/sort'`
Expected: FAIL — module not found.

- [ ] **Step 7: Implement the sort helper**

Create `frontend/src/features/catalog-sort/model/sort.ts`:

```ts
import type { Product } from "@/entities/product"

export const SORT_ORDERS = ["newest", "price-asc", "price-desc"] as const
export type SortOrder = (typeof SORT_ORDERS)[number]
export const DEFAULT_SORT: SortOrder = "newest"

export function isSortOrder(v: string | null): v is SortOrder {
  return v !== null && (SORT_ORDERS as readonly string[]).includes(v)
}

export function sortProducts<T extends Pick<Product, "priceCents" | "createdAt">>(
  products: T[],
  order: SortOrder,
): T[] {
  const copy = products.slice()
  switch (order) {
    case "price-asc":
      return copy.sort((a, b) => a.priceCents - b.priceCents)
    case "price-desc":
      return copy.sort((a, b) => b.priceCents - a.priceCents)
    case "newest":
    default:
      return copy.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }
}

export const SORT_LABELS: Record<SortOrder, string> = {
  newest: "Newest first",
  "price-asc": "Price: low to high",
  "price-desc": "Price: high to low",
}
```

- [ ] **Step 8: Run sort tests to verify pass**

Run: `cd frontend && bun run test 'catalog-sort/model/sort'`
Expected: 8 PASS (5 ordering + 3 length).

- [ ] **Step 9: Implement `useSortOrder` (URL state)**

Create `frontend/src/features/catalog-sort/model/use-sort-order.ts`:

```ts
import { useCallback } from "react"
import { useQueryParam } from "@/shared/lib/use-query-params"
import { DEFAULT_SORT, type SortOrder, isSortOrder } from "./sort"

export function useSortOrder() {
  const [raw, setRaw] = useQueryParam("sort")
  const value: SortOrder = isSortOrder(raw) ? raw : DEFAULT_SORT

  const setValue = useCallback(
    (next: SortOrder) => {
      if (next === DEFAULT_SORT) {
        setRaw(null)
      } else {
        setRaw(next)
      }
    },
    [setRaw],
  )

  return [value, setValue] as const
}
```

- [ ] **Step 10: Implement `SortDropdown` UI**

Create `frontend/src/features/catalog-sort/ui/SortDropdown.tsx`:

```tsx
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select"
import { SORT_LABELS, SORT_ORDERS, type SortOrder } from "../model/sort"
import { useSortOrder } from "../model/use-sort-order"

export function SortDropdown() {
  const [value, setValue] = useSortOrder()
  return (
    <Select value={value} onValueChange={(v) => setValue(v as SortOrder)}>
      <SelectTrigger className="w-48">
        <SelectValue placeholder="Sort by" />
      </SelectTrigger>
      <SelectContent>
        {SORT_ORDERS.map((order) => (
          <SelectItem key={order} value={order}>
            {SORT_LABELS[order]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
```

Create `frontend/src/features/catalog-sort/index.ts`:

```ts
export { DEFAULT_SORT, sortProducts, type SortOrder } from "./model/sort"
export { useSortOrder } from "./model/use-sort-order"
export { SortDropdown } from "./ui/SortDropdown"
```

- [ ] **Step 11: Write failing test for `useSearchQuery`**

Create `frontend/src/features/catalog-search/model/use-search-query.test.tsx`:

```tsx
import { act, renderHook } from "@testing-library/react"
import type { ReactNode } from "react"
import { MemoryRouter } from "react-router"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useSearchQuery } from "./use-search-query"

function makeWrapper(initialEntries: string[]) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
  }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe("useSearchQuery", () => {
  it("reads initial query from URL", () => {
    const { result } = renderHook(() => useSearchQuery(), {
      wrapper: makeWrapper(["/products?q=tie"]),
    })
    expect(result.current.value).toBe("tie")
    expect(result.current.committed).toBe("tie")
  })

  it("returns empty string when q is absent", () => {
    const { result } = renderHook(() => useSearchQuery(), {
      wrapper: makeWrapper(["/products"]),
    })
    expect(result.current.value).toBe("")
    expect(result.current.committed).toBe("")
  })

  it("setValue updates the visible value immediately and the URL after debounce", () => {
    const { result } = renderHook(() => useSearchQuery(), {
      wrapper: makeWrapper(["/products"]),
    })

    act(() => result.current.setValue("hello"))
    // visible immediately
    expect(result.current.value).toBe("hello")
    // not yet committed to URL
    expect(result.current.committed).toBe("")

    // advance the debounce
    act(() => vi.advanceTimersByTime(300))
    expect(result.current.committed).toBe("hello")
  })

  it("debounces rapid changes — only the last value commits", () => {
    const { result } = renderHook(() => useSearchQuery(), {
      wrapper: makeWrapper(["/products"]),
    })

    act(() => result.current.setValue("h"))
    act(() => vi.advanceTimersByTime(100))
    act(() => result.current.setValue("he"))
    act(() => vi.advanceTimersByTime(100))
    act(() => result.current.setValue("hel"))
    act(() => vi.advanceTimersByTime(300))

    expect(result.current.committed).toBe("hel")
  })

  it("clearing pushes empty and removes URL key", () => {
    const { result } = renderHook(() => useSearchQuery(), {
      wrapper: makeWrapper(["/products?q=tie"]),
    })
    act(() => result.current.setValue(""))
    act(() => vi.advanceTimersByTime(300))
    expect(result.current.committed).toBe("")
  })
})
```

- [ ] **Step 12: Run failing test**

Run: `cd frontend && bun run test use-search-query`
Expected: FAIL — module not found.

- [ ] **Step 13: Implement `useSearchQuery` (debounced)**

Create `frontend/src/features/catalog-search/model/use-search-query.ts`:

```ts
import { useCallback, useEffect, useRef, useState } from "react"
import { useQueryParam } from "@/shared/lib/use-query-params"

const DEBOUNCE_MS = 300

export function useSearchQuery() {
  const [committedRaw, setCommittedRaw] = useQueryParam("q")
  const committed = committedRaw ?? ""
  const [value, setLocalValue] = useState(committed)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Keep local in sync if URL changes externally (e.g., back button).
  useEffect(() => {
    setLocalValue(committed)
  }, [committed])

  const setValue = useCallback(
    (next: string) => {
      setLocalValue(next)
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        setCommittedRaw(next === "" ? null : next)
      }, DEBOUNCE_MS)
    },
    [setCommittedRaw],
  )

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return { value, committed, setValue }
}
```

- [ ] **Step 14: Implement `SearchInput` UI**

Create `frontend/src/features/catalog-search/ui/SearchInput.tsx`:

```tsx
import { Input } from "@/shared/ui/input"
import { useSearchQuery } from "../model/use-search-query"

export function SearchInput() {
  const { value, setValue } = useSearchQuery()
  return (
    <Input
      type="search"
      placeholder="Search ships…"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      className="w-64"
      aria-label="Search products"
    />
  )
}
```

Create `frontend/src/features/catalog-search/index.ts`:

```ts
export { useSearchQuery } from "./model/use-search-query"
export { SearchInput } from "./ui/SearchInput"
```

- [ ] **Step 15: Run all new tests + lint + typecheck**

```bash
cd frontend && bun run test && bun run lint && bun run typecheck
```

Expected: all green. Steiger should pass — every feature slice now has real content.

- [ ] **Step 16: Commit**

```bash
cd /home/z3tz3r0/Projects/ecommerce-space-craft
git add frontend/src/features/catalog-filter/ \
        frontend/src/features/catalog-sort/ \
        frontend/src/features/catalog-search/
git commit -m "feat(features): add catalog-filter, catalog-sort, catalog-search slices"
```

---

## Task 7: `widgets/product-card` and `widgets/product-grid`

Port the card layout shape from `terracota-store/src/widgets/ProductCard.tsx`, but rebuilt against shadcn `Card` with layout-only Tailwind, our `Product` shape, and no wishlist/discount logic. The grid handles loading/empty/error states.

**Files:**
- Create: `frontend/src/widgets/product-card/ProductCard.tsx`
- Create: `frontend/src/widgets/product-card/ProductCard.test.tsx`
- Create: `frontend/src/widgets/product-card/index.ts`
- Create: `frontend/src/widgets/product-grid/ProductGrid.tsx`
- Create: `frontend/src/widgets/product-grid/ProductGridSkeleton.tsx`
- Create: `frontend/src/widgets/product-grid/ProductGrid.test.tsx`
- Create: `frontend/src/widgets/product-grid/index.ts`

- [ ] **Step 1: Write failing test for `ProductCard`**

Create `frontend/src/widgets/product-card/ProductCard.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router"
import { describe, expect, it } from "vitest"
import type { Product } from "@/entities/product"
import { ProductCard } from "./ProductCard"

const baseProduct: Product = {
  id: "abc-123",
  name: "X-Wing T-65",
  description: "A versatile starfighter.",
  priceCents: 12500000,
  imageUrl: "https://example.com/x-wing.jpg",
  category: "Fighter",
  stockQuantity: 8,
  isActive: true,
  isFeatured: false,
  createdAt: "2026-04-10T00:00:00Z",
  updatedAt: "2026-04-10T00:00:00Z",
}

function renderCard(p: Product) {
  return render(
    <MemoryRouter>
      <ProductCard product={p} />
    </MemoryRouter>,
  )
}

describe("ProductCard", () => {
  it("renders product name, formatted price, and stock badge", () => {
    renderCard(baseProduct)
    expect(screen.getByText("X-Wing T-65")).toBeInTheDocument()
    expect(screen.getByText("$125,000.00")).toBeInTheDocument()
    expect(screen.getByText("In stock")).toBeInTheDocument()
  })

  it("links to the product detail page", () => {
    renderCard(baseProduct)
    const link = screen.getByRole("link", { name: /X-Wing T-65/i })
    expect(link).toHaveAttribute("href", "/products/abc-123")
  })

  it("renders the image with name as alt text", () => {
    renderCard(baseProduct)
    const img = screen.getByAltText("X-Wing T-65")
    expect(img).toHaveAttribute("src", "https://example.com/x-wing.jpg")
  })

  it("renders fallback (empty alt) when imageUrl is missing", () => {
    renderCard({ ...baseProduct, imageUrl: undefined })
    // No img tag should appear
    expect(screen.queryByRole("img")).not.toBeInTheDocument()
  })

  it("shows 'Out of stock' badge for zero stock", () => {
    renderCard({ ...baseProduct, stockQuantity: 0 })
    expect(screen.getByText("Out of stock")).toBeInTheDocument()
  })

  it("shows 'Low stock — N left' for low stock", () => {
    renderCard({ ...baseProduct, stockQuantity: 3 })
    expect(screen.getByText("Low stock — 3 left")).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run failing test**

Run: `cd frontend && bun run test ProductCard`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `ProductCard`**

Create `frontend/src/widgets/product-card/ProductCard.tsx`:

```tsx
import { Link } from "react-router"
import { type Product, StockBadge } from "@/entities/product"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card"
import { formatPrice } from "@/shared/lib/format-price"

interface ProductCardProps {
  product: Product
}

export function ProductCard({ product }: ProductCardProps) {
  return (
    <Link
      to={`/products/${product.id}`}
      className="block"
      aria-label={product.name}
    >
      <Card className="h-full overflow-hidden">
        {product.imageUrl ? (
          <div className="aspect-square w-full overflow-hidden">
            <img
              src={product.imageUrl}
              alt={product.name}
              className="h-full w-full object-cover"
            />
          </div>
        ) : (
          <div className="aspect-square w-full" />
        )}
        <CardHeader>
          <CardTitle>{product.name}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <p>{formatPrice(product.priceCents)}</p>
          <StockBadge quantity={product.stockQuantity} />
        </CardContent>
      </Card>
    </Link>
  )
}
```

Create `frontend/src/widgets/product-card/index.ts`:

```ts
export { ProductCard } from "./ProductCard"
```

- [ ] **Step 4: Run ProductCard tests to verify pass**

Run: `cd frontend && bun run test ProductCard`
Expected: 6 PASS.

- [ ] **Step 5: Implement `ProductGridSkeleton`**

Create `frontend/src/widgets/product-grid/ProductGridSkeleton.tsx`:

```tsx
import { Skeleton } from "@/shared/ui/skeleton"

const PLACEHOLDER_COUNT = 8

export function ProductGridSkeleton() {
  return (
    <div
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
      data-testid="product-grid-skeleton"
    >
      {Array.from({ length: PLACEHOLDER_COUNT }).map((_, i) => (
        <div key={i} className="flex flex-col gap-3">
          <Skeleton className="aspect-square w-full" />
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/3" />
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 6: Write failing test for `ProductGrid`**

Create `frontend/src/widgets/product-grid/ProductGrid.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import { describe, expect, it, vi } from "vitest"
import type { Product } from "@/entities/product"
import { ProductGrid } from "./ProductGrid"

const sample: Product[] = [
  {
    id: "1",
    name: "X-Wing",
    description: "",
    priceCents: 100,
    category: "Fighter",
    stockQuantity: 5,
    isActive: true,
    isFeatured: false,
    createdAt: "2026-04-10T00:00:00Z",
    updatedAt: "2026-04-10T00:00:00Z",
  },
  {
    id: "2",
    name: "Falcon",
    description: "",
    priceCents: 200,
    category: "Freighter",
    stockQuantity: 1,
    isActive: true,
    isFeatured: true,
    createdAt: "2026-04-11T00:00:00Z",
    updatedAt: "2026-04-11T00:00:00Z",
  },
]

function renderGrid(props: Parameters<typeof ProductGrid>[0]) {
  return render(
    <MemoryRouter>
      <ProductGrid {...props} />
    </MemoryRouter>,
  )
}

describe("ProductGrid", () => {
  it("renders skeleton when isLoading", () => {
    renderGrid({ products: [], isLoading: true, isError: false, onRetry: vi.fn() })
    expect(screen.getByTestId("product-grid-skeleton")).toBeInTheDocument()
  })

  it("renders error message and retry button when isError", async () => {
    const onRetry = vi.fn()
    renderGrid({ products: [], isLoading: false, isError: true, onRetry })
    expect(screen.getByText(/failed to load/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: /try again/i }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it("renders empty state when products is empty (and not loading/error)", () => {
    const onClearFilters = vi.fn()
    renderGrid({
      products: [],
      isLoading: false,
      isError: false,
      onRetry: vi.fn(),
      onClearFilters,
    })
    expect(screen.getByText(/no spacecraft match/i)).toBeInTheDocument()
  })

  it("renders product cards when products are present", () => {
    renderGrid({ products: sample, isLoading: false, isError: false, onRetry: vi.fn() })
    expect(screen.getByText("X-Wing")).toBeInTheDocument()
    expect(screen.getByText("Falcon")).toBeInTheDocument()
  })

  it("clear-filters button is shown only when handler provided", async () => {
    const onClearFilters = vi.fn()
    renderGrid({
      products: [],
      isLoading: false,
      isError: false,
      onRetry: vi.fn(),
      onClearFilters,
    })
    await userEvent.click(screen.getByRole("button", { name: /clear filters/i }))
    expect(onClearFilters).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 7: Run failing test**

Run: `cd frontend && bun run test ProductGrid`
Expected: FAIL — module not found.

- [ ] **Step 8: Implement `ProductGrid`**

Create `frontend/src/widgets/product-grid/ProductGrid.tsx`:

```tsx
import type { Product } from "@/entities/product"
import { ProductCard } from "@/widgets/product-card"
import { ProductGridSkeleton } from "./ProductGridSkeleton"

interface ProductGridProps {
  products: Product[]
  isLoading: boolean
  isError: boolean
  onRetry: () => void
  onClearFilters?: () => void
}

export function ProductGrid({
  products,
  isLoading,
  isError,
  onRetry,
  onClearFilters,
}: ProductGridProps) {
  if (isLoading) {
    return <ProductGridSkeleton />
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-4 p-8">
        <p>Failed to load products.</p>
        <button type="button" onClick={onRetry} className="underline">
          Try again
        </button>
      </div>
    )
  }

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 p-8">
        <p>No spacecraft match your filters.</p>
        {onClearFilters && (
          <button type="button" onClick={onClearFilters} className="underline">
            Clear filters
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  )
}
```

Create `frontend/src/widgets/product-grid/index.ts`:

```ts
export { ProductGrid } from "./ProductGrid"
export { ProductGridSkeleton } from "./ProductGridSkeleton"
```

- [ ] **Step 9: Run all widget tests + lint + typecheck**

```bash
cd frontend && bun run test && bun run lint && bun run typecheck
```

Expected: all green.

- [ ] **Step 10: Commit**

```bash
cd /home/z3tz3r0/Projects/ecommerce-space-craft
git add frontend/src/widgets/product-card/ frontend/src/widgets/product-grid/
git commit -m "feat(widgets): add ProductCard and ProductGrid (port from terracota)"
```

---

## Task 8: `widgets/filter-sidebar` + `widgets/featured-section`

**Files:**
- Create: `frontend/src/widgets/filter-sidebar/FilterSidebar.tsx`
- Create: `frontend/src/widgets/filter-sidebar/FilterSidebar.test.tsx`
- Create: `frontend/src/widgets/filter-sidebar/index.ts`
- Create: `frontend/src/widgets/featured-section/FeaturedSection.tsx`
- Create: `frontend/src/widgets/featured-section/FeaturedSection.test.tsx`
- Create: `frontend/src/widgets/featured-section/index.ts`

- [ ] **Step 1: Write failing test for `FilterSidebar`**

Create `frontend/src/widgets/filter-sidebar/FilterSidebar.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes, useSearchParams } from "react-router"
import { describe, expect, it } from "vitest"
import { FilterSidebar } from "./FilterSidebar"

function URLProbe() {
  const [params] = useSearchParams()
  return <div data-testid="probe">{params.toString()}</div>
}

function renderSidebar(initialEntries: string[]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <FilterSidebar />
      <Routes>
        <Route path="*" element={<URLProbe />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe("FilterSidebar", () => {
  it("renders all 6 categories as checkboxes", () => {
    renderSidebar(["/products"])
    for (const cat of ["Fighter", "Freighter", "Shuttle", "Speeder", "Cruiser", "Capital Ship"]) {
      expect(screen.getByLabelText(cat)).toBeInTheDocument()
    }
  })

  it("clicking a category checkbox pushes it to the URL", async () => {
    renderSidebar(["/products"])
    await userEvent.click(screen.getByLabelText("Fighter"))
    expect(screen.getByTestId("probe").textContent).toContain("category=Fighter")
  })

  it("clicking an already-selected category removes it", async () => {
    renderSidebar(["/products?category=Fighter"])
    await userEvent.click(screen.getByLabelText("Fighter"))
    expect(screen.getByTestId("probe").textContent).not.toContain("category=Fighter")
  })

  it("reflects pre-selected categories from URL", () => {
    renderSidebar(["/products?category=Fighter&category=Cruiser"])
    expect(screen.getByLabelText("Fighter")).toBeChecked()
    expect(screen.getByLabelText("Cruiser")).toBeChecked()
    expect(screen.getByLabelText("Shuttle")).not.toBeChecked()
  })
})
```

- [ ] **Step 2: Run failing test**

Run: `cd frontend && bun run test FilterSidebar`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `FilterSidebar`**

Create `frontend/src/widgets/filter-sidebar/FilterSidebar.tsx`:

```tsx
import { CATEGORIES } from "@/entities/product"
import { useCategoryFilter } from "@/features/catalog-filter"
import { Checkbox } from "@/shared/ui/checkbox"

export function FilterSidebar() {
  const { isSelected, toggle } = useCategoryFilter()

  return (
    <aside className="flex w-full flex-col gap-4 lg:w-60">
      <h2>Categories</h2>
      <ul className="flex flex-col gap-3">
        {CATEGORIES.map((cat) => {
          const id = `cat-${cat.replace(/\s+/g, "-").toLowerCase()}`
          return (
            <li key={cat} className="flex items-center gap-2">
              <Checkbox
                id={id}
                checked={isSelected(cat)}
                onCheckedChange={() => toggle(cat)}
              />
              <label htmlFor={id}>{cat}</label>
            </li>
          )
        })}
      </ul>
    </aside>
  )
}
```

Create `frontend/src/widgets/filter-sidebar/index.ts`:

```ts
export { FilterSidebar } from "./FilterSidebar"
```

- [ ] **Step 4: Run filter-sidebar tests**

Run: `cd frontend && bun run test FilterSidebar`
Expected: 4 PASS.

- [ ] **Step 5: Write failing test for `FeaturedSection`**

Create `frontend/src/widgets/featured-section/FeaturedSection.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { MemoryRouter } from "react-router"
import { describe, expect, it, vi } from "vitest"
import { FeaturedSection } from "./FeaturedSection"

vi.mock("@/entities/product", async () => {
  const actual = await vi.importActual<typeof import("@/entities/product")>("@/entities/product")
  return {
    ...actual,
    useFeaturedProducts: () => ({
      data: [
        {
          id: "1",
          name: "X-Wing",
          description: "",
          priceCents: 100,
          category: "Fighter",
          stockQuantity: 5,
          isActive: true,
          isFeatured: true,
          createdAt: "2026-04-10T00:00:00Z",
          updatedAt: "2026-04-10T00:00:00Z",
        },
        {
          id: "2",
          name: "Falcon",
          description: "",
          priceCents: 200,
          category: "Freighter",
          stockQuantity: 1,
          isActive: true,
          isFeatured: true,
          createdAt: "2026-04-11T00:00:00Z",
          updatedAt: "2026-04-11T00:00:00Z",
        },
      ],
      isLoading: false,
      isError: false,
    }),
  }
})

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>
    )
  }
}

describe("FeaturedSection", () => {
  it("renders a card per featured product", () => {
    render(<FeaturedSection />, { wrapper: makeWrapper() })
    expect(screen.getByText("X-Wing")).toBeInTheDocument()
    expect(screen.getByText("Falcon")).toBeInTheDocument()
  })

  it("renders the section heading", () => {
    render(<FeaturedSection />, { wrapper: makeWrapper() })
    expect(screen.getByRole("heading", { name: /featured/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 6: Run failing test**

Run: `cd frontend && bun run test FeaturedSection`
Expected: FAIL — module not found.

- [ ] **Step 7: Implement `FeaturedSection`**

Create `frontend/src/widgets/featured-section/FeaturedSection.tsx`:

```tsx
import { useFeaturedProducts } from "@/entities/product"
import { ProductCard } from "@/widgets/product-card"
import { ProductGridSkeleton } from "@/widgets/product-grid"

export function FeaturedSection() {
  const { data, isLoading, isError } = useFeaturedProducts(4)

  return (
    <section className="flex flex-col gap-6">
      <h2>Featured ships</h2>
      {isLoading ? (
        <ProductGridSkeleton />
      ) : isError ? (
        <p>Failed to load featured ships.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(data ?? []).map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </section>
  )
}
```

Create `frontend/src/widgets/featured-section/index.ts`:

```ts
export { FeaturedSection } from "./FeaturedSection"
```

- [ ] **Step 8: Run all tests + lint + typecheck**

```bash
cd frontend && bun run test && bun run lint && bun run typecheck
```

Expected: all green.

- [ ] **Step 9: Commit**

```bash
cd /home/z3tz3r0/Projects/ecommerce-space-craft
git add frontend/src/widgets/filter-sidebar/ frontend/src/widgets/featured-section/
git commit -m "feat(widgets): add FilterSidebar and FeaturedSection"
```

---

## Task 9: Pages — `catalog`, `product-detail`, updated `home` + routes

**Files:**
- Create: `frontend/src/pages/catalog/ui/CatalogPage.tsx`
- Create: `frontend/src/pages/catalog/ui/CatalogPage.test.tsx`
- Create: `frontend/src/pages/catalog/index.ts`
- Create: `frontend/src/pages/product-detail/ui/ProductDetailPage.tsx`
- Create: `frontend/src/pages/product-detail/ui/ProductDetailPage.test.tsx`
- Create: `frontend/src/pages/product-detail/index.ts`
- Modify: `frontend/src/pages/home/ui/HomePage.tsx`
- Modify: `frontend/src/pages/home/ui/HomePage.test.tsx`
- Modify: `frontend/src/app/providers/router/routes.tsx`

- [ ] **Step 1: Update HomePage to render the FeaturedSection**

Replace `frontend/src/pages/home/ui/HomePage.tsx`:

```tsx
import { FeaturedSection } from "@/widgets/featured-section"

export function HomePage() {
  return (
    <main className="flex flex-col gap-12 p-8">
      <section className="flex flex-col gap-4">
        <h1>Spacecraft Store</h1>
        <p>Browse our catalog of starfighters, freighters, and more.</p>
      </section>
      <FeaturedSection />
    </main>
  )
}
```

- [ ] **Step 2: Update the HomePage test to match**

Replace `frontend/src/pages/home/ui/HomePage.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { MemoryRouter } from "react-router"
import { describe, expect, it, vi } from "vitest"
import { HomePage } from "./HomePage"

vi.mock("@/entities/product", async () => {
  const actual = await vi.importActual<typeof import("@/entities/product")>("@/entities/product")
  return {
    ...actual,
    useFeaturedProducts: () => ({ data: [], isLoading: false, isError: false }),
  }
})

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>
    )
  }
}

describe("HomePage", () => {
  it("renders the store hero heading", () => {
    render(<HomePage />, { wrapper: makeWrapper() })
    expect(screen.getByRole("heading", { name: /spacecraft store/i })).toBeInTheDocument()
  })

  it("renders the featured section heading", () => {
    render(<HomePage />, { wrapper: makeWrapper() })
    expect(screen.getByRole("heading", { name: /featured/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run HomePage tests**

Run: `cd frontend && bun run test HomePage`
Expected: 2 PASS.

- [ ] **Step 4: Write failing test for `CatalogPage`**

Create `frontend/src/pages/catalog/ui/CatalogPage.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { MemoryRouter } from "react-router"
import { describe, expect, it, vi } from "vitest"
import type { Product } from "@/entities/product"
import { CatalogPage } from "./CatalogPage"

const sample: Product[] = [
  {
    id: "a",
    name: "X-Wing",
    description: "Rebel fighter",
    priceCents: 100,
    category: "Fighter",
    stockQuantity: 5,
    isActive: true,
    isFeatured: false,
    createdAt: "2026-04-10T00:00:00Z",
    updatedAt: "2026-04-10T00:00:00Z",
  },
  {
    id: "b",
    name: "Falcon",
    description: "Smuggler ship",
    priceCents: 50,
    category: "Freighter",
    stockQuantity: 2,
    isActive: true,
    isFeatured: false,
    createdAt: "2026-04-11T00:00:00Z",
    updatedAt: "2026-04-11T00:00:00Z",
  },
  {
    id: "c",
    name: "TIE Fighter",
    description: "Imperial fighter",
    priceCents: 200,
    category: "Fighter",
    stockQuantity: 0,
    isActive: true,
    isFeatured: false,
    createdAt: "2026-04-12T00:00:00Z",
    updatedAt: "2026-04-12T00:00:00Z",
  },
]

vi.mock("@/entities/product", async () => {
  const actual = await vi.importActual<typeof import("@/entities/product")>("@/entities/product")
  return {
    ...actual,
    useProducts: () => ({ data: sample, isLoading: false, isError: false, refetch: vi.fn() }),
  }
})

function makeWrapper(initialEntries: string[]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
      </QueryClientProvider>
    )
  }
}

describe("CatalogPage", () => {
  it("renders all products by default", () => {
    render(<CatalogPage />, { wrapper: makeWrapper(["/products"]) })
    expect(screen.getByText("X-Wing")).toBeInTheDocument()
    expect(screen.getByText("Falcon")).toBeInTheDocument()
    expect(screen.getByText("TIE Fighter")).toBeInTheDocument()
  })

  it("filters by category from URL", () => {
    render(<CatalogPage />, { wrapper: makeWrapper(["/products?category=Fighter"]) })
    expect(screen.getByText("X-Wing")).toBeInTheDocument()
    expect(screen.getByText("TIE Fighter")).toBeInTheDocument()
    expect(screen.queryByText("Falcon")).not.toBeInTheDocument()
  })

  it("filters by search query from URL", () => {
    render(<CatalogPage />, { wrapper: makeWrapper(["/products?q=falcon"]) })
    expect(screen.getByText("Falcon")).toBeInTheDocument()
    expect(screen.queryByText("X-Wing")).not.toBeInTheDocument()
  })

  it("matches q against description as well as name", () => {
    render(<CatalogPage />, { wrapper: makeWrapper(["/products?q=imperial"]) })
    expect(screen.getByText("TIE Fighter")).toBeInTheDocument()
    expect(screen.queryByText("X-Wing")).not.toBeInTheDocument()
  })

  it("sorts by price ascending from URL", () => {
    render(<CatalogPage />, { wrapper: makeWrapper(["/products?sort=price-asc"]) })
    const links = screen.getAllByRole("link")
    const productLinks = links.filter((l) => l.getAttribute("href")?.startsWith("/products/"))
    const names = productLinks.map((l) => within(l).getByRole("heading").textContent)
    // Falcon ($50) < X-Wing ($100) < TIE Fighter ($200)
    expect(names).toEqual(["Falcon", "X-Wing", "TIE Fighter"])
  })

  it("renders empty state with clear-filters when filters yield no results", async () => {
    render(<CatalogPage />, { wrapper: makeWrapper(["/products?q=nothing"]) })
    expect(screen.getByText(/no spacecraft match/i)).toBeInTheDocument()
    const clearBtn = screen.getByRole("button", { name: /clear filters/i })
    await userEvent.click(clearBtn)
    // After clearing, all products visible again
    expect(screen.getByText("X-Wing")).toBeInTheDocument()
  })
})
```

- [ ] **Step 5: Run failing test**

Run: `cd frontend && bun run test CatalogPage`
Expected: FAIL — module not found.

- [ ] **Step 6: Implement `CatalogPage`**

Create `frontend/src/pages/catalog/ui/CatalogPage.tsx`:

```tsx
import { useMemo } from "react"
import { useNavigate } from "react-router"
import { useProducts } from "@/entities/product"
import { useCategoryFilter } from "@/features/catalog-filter"
import { SearchInput, useSearchQuery } from "@/features/catalog-search"
import { SortDropdown, sortProducts, useSortOrder } from "@/features/catalog-sort"
import { FilterSidebar } from "@/widgets/filter-sidebar"
import { ProductGrid } from "@/widgets/product-grid"

export function CatalogPage() {
  const navigate = useNavigate()
  const { data, isLoading, isError, refetch } = useProducts()
  const { selected, clear: clearCategories } = useCategoryFilter()
  const [sort] = useSortOrder()
  const { committed: q } = useSearchQuery()

  const visible = useMemo(() => {
    if (!data) return []
    let result = data
    if (selected.length > 0) {
      const set = new Set(selected)
      result = result.filter((p) => set.has(p.category))
    }
    if (q.trim() !== "") {
      const needle = q.toLowerCase()
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(needle) ||
          p.description.toLowerCase().includes(needle),
      )
    }
    return sortProducts(result, sort)
  }, [data, selected, q, sort])

  const filtersActive = selected.length > 0 || q.trim() !== ""

  const onClearFilters = () => {
    clearCategories()
    navigate("/products", { replace: true })
  }

  return (
    <main className="flex flex-col gap-8 p-8">
      <h1>Catalog</h1>
      <div className="flex flex-col gap-8 lg:flex-row">
        <FilterSidebar />
        <div className="flex flex-1 flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <SearchInput />
            <SortDropdown />
          </div>
          <ProductGrid
            products={visible}
            isLoading={isLoading}
            isError={isError}
            onRetry={() => refetch()}
            onClearFilters={filtersActive ? onClearFilters : undefined}
          />
        </div>
      </div>
    </main>
  )
}
```

Create `frontend/src/pages/catalog/index.ts`:

```ts
export { CatalogPage } from "./ui/CatalogPage"
```

- [ ] **Step 7: Run CatalogPage tests**

Run: `cd frontend && bun run test CatalogPage`
Expected: 6 PASS.

- [ ] **Step 8: Write failing test for `ProductDetailPage`**

Create `frontend/src/pages/product-detail/ui/ProductDetailPage.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { MemoryRouter, Route, Routes } from "react-router"
import { describe, expect, it, vi } from "vitest"
import type { Product } from "@/entities/product"
import { ProductDetailPage } from "./ProductDetailPage"

const sample: Product = {
  id: "abc",
  name: "X-Wing T-65",
  description: "A versatile starfighter from the Rebel Alliance.",
  priceCents: 12500000,
  imageUrl: "https://example.com/x-wing.jpg",
  manufacturer: "Incom Corporation",
  crewAmount: 1,
  maxSpeed: "1050 km/h",
  category: "Fighter",
  stockQuantity: 8,
  isActive: true,
  isFeatured: false,
  createdAt: "2026-04-10T00:00:00Z",
  updatedAt: "2026-04-10T00:00:00Z",
}

let mockState: { data?: Product; isLoading: boolean; isError: boolean } = {
  data: sample,
  isLoading: false,
  isError: false,
}

vi.mock("@/entities/product", async () => {
  const actual = await vi.importActual<typeof import("@/entities/product")>("@/entities/product")
  return {
    ...actual,
    useProduct: () => mockState,
  }
})

function makeWrapper(path = "/products/abc") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function Wrapper({ children: _children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/products/:id" element={<ProductDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    )
  }
}

describe("ProductDetailPage", () => {
  it("renders all product fields", () => {
    mockState = { data: sample, isLoading: false, isError: false }
    render(<></>, { wrapper: makeWrapper() })
    expect(screen.getByText("X-Wing T-65")).toBeInTheDocument()
    expect(screen.getByText(/Rebel Alliance/)).toBeInTheDocument()
    expect(screen.getByText("$125,000.00")).toBeInTheDocument()
    expect(screen.getByText("Incom Corporation")).toBeInTheDocument()
    expect(screen.getByText("1050 km/h")).toBeInTheDocument()
    expect(screen.getByText("Fighter")).toBeInTheDocument()
    expect(screen.getByText("In stock")).toBeInTheDocument()
  })

  it("renders skeleton while loading", () => {
    mockState = { data: undefined, isLoading: true, isError: false }
    render(<></>, { wrapper: makeWrapper() })
    expect(screen.getByTestId("product-detail-skeleton")).toBeInTheDocument()
  })

  it("renders not-found state on error", () => {
    mockState = { data: undefined, isLoading: false, isError: true }
    render(<></>, { wrapper: makeWrapper() })
    expect(screen.getByText(/not found/i)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /back to catalog/i })).toHaveAttribute(
      "href",
      "/products",
    )
  })
})
```

- [ ] **Step 9: Run failing test**

Run: `cd frontend && bun run test ProductDetailPage`
Expected: FAIL — module not found.

- [ ] **Step 10: Implement `ProductDetailPage`**

Create `frontend/src/pages/product-detail/ui/ProductDetailPage.tsx`:

```tsx
import { Link, useParams } from "react-router"
import { StockBadge, useProduct } from "@/entities/product"
import { formatPrice } from "@/shared/lib/format-price"
import { Skeleton } from "@/shared/ui/skeleton"

export function ProductDetailPage() {
  const { id = "" } = useParams()
  const { data, isLoading, isError } = useProduct(id)

  if (isLoading) {
    return (
      <main className="flex flex-col gap-6 p-8" data-testid="product-detail-skeleton">
        <Skeleton className="h-10 w-1/2" />
        <div className="flex flex-col gap-6 lg:flex-row">
          <Skeleton className="aspect-square w-full lg:w-1/2" />
          <div className="flex flex-1 flex-col gap-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      </main>
    )
  }

  if (isError || !data) {
    return (
      <main className="flex flex-col items-center gap-4 p-8">
        <h1>Spacecraft not found</h1>
        <Link to="/products" className="underline">
          Back to catalog
        </Link>
      </main>
    )
  }

  return (
    <main className="flex flex-col gap-6 p-8">
      <Link to="/products" className="underline">
        ← Back to catalog
      </Link>
      <div className="flex flex-col gap-8 lg:flex-row">
        {data.imageUrl && (
          <div className="aspect-square w-full overflow-hidden lg:w-1/2">
            <img
              src={data.imageUrl}
              alt={data.name}
              className="h-full w-full object-cover"
            />
          </div>
        )}
        <div className="flex flex-1 flex-col gap-4">
          <h1>{data.name}</h1>
          <p>{formatPrice(data.priceCents)}</p>
          <StockBadge quantity={data.stockQuantity} />
          <p>{data.description}</p>
          <dl className="grid grid-cols-2 gap-4">
            <div>
              <dt>Category</dt>
              <dd>{data.category}</dd>
            </div>
            {data.manufacturer && (
              <div>
                <dt>Manufacturer</dt>
                <dd>{data.manufacturer}</dd>
              </div>
            )}
            {typeof data.crewAmount === "number" && (
              <div>
                <dt>Crew</dt>
                <dd>{data.crewAmount}</dd>
              </div>
            )}
            {data.maxSpeed && (
              <div>
                <dt>Max speed</dt>
                <dd>{data.maxSpeed}</dd>
              </div>
            )}
          </dl>
        </div>
      </div>
    </main>
  )
}
```

Create `frontend/src/pages/product-detail/index.ts`:

```ts
export { ProductDetailPage } from "./ui/ProductDetailPage"
```

- [ ] **Step 11: Run ProductDetailPage tests**

Run: `cd frontend && bun run test ProductDetailPage`
Expected: 3 PASS.

- [ ] **Step 12: Wire the new pages into the router**

Replace `frontend/src/app/providers/router/routes.tsx`:

```tsx
import type { RouteObject } from "react-router"
import { App } from "@/app/App"
import { CatalogPage } from "@/pages/catalog"
import { HomePage } from "@/pages/home"
import { ProductDetailPage } from "@/pages/product-detail"

export const routes: RouteObject[] = [
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "products", element: <CatalogPage /> },
      { path: "products/:id", element: <ProductDetailPage /> },
    ],
  },
]
```

- [ ] **Step 13: Verify the home page index export still works**

Make sure `frontend/src/pages/home/index.ts` exists and exports `HomePage`. If not, create it:

```ts
export { HomePage } from "./ui/HomePage"
```

- [ ] **Step 14: Run full test + lint + typecheck + build**

```bash
cd frontend && bun run test && bun run lint && bun run typecheck && bun run build
```

Expected: all green. Vite build produces `dist/`.

- [ ] **Step 15: Manual local smoke test**

```bash
cd /home/z3tz3r0/Projects/ecommerce-space-craft
make dev-frontend
```

Open `http://localhost:5173/`. Verify:
- Home page shows hero + featured section with cards.
- Click a card → navigates to detail page.
- Click "Back to catalog" → goes to `/products`.
- Catalog page shows all products in a grid with sidebar + sort + search.
- Tick a category checkbox → URL updates and grid filters.
- Type in search → URL updates after 300ms and grid filters.
- Change sort → URL updates and grid reorders.
- Type a query that matches nothing → empty state with "Clear filters" button.
- Click "Clear filters" → URL resets and all products return.

Stop the dev server (`Ctrl-C`).

- [ ] **Step 16: Commit**

```bash
cd /home/z3tz3r0/Projects/ecommerce-space-craft
git add frontend/src/pages/ frontend/src/app/providers/router/routes.tsx
git commit -m "feat(pages): add CatalogPage, ProductDetailPage; wire featured into Home"
```

---

## Task 10: Steiger config cleanup + push + PR + CI + merge + Vercel verify

**Files:**
- Modify: `frontend/steiger.config.ts` (remove the Phase 0b placeholder suppression)

- [ ] **Step 1: Remove the obsolete Steiger suppression for empty placeholder layers**

Replace `frontend/steiger.config.ts`:

```ts
import fsd from "@feature-sliced/steiger-plugin"
import { defineConfig } from "steiger"

export default defineConfig([
  ...fsd.configs.recommended,
  {
    files: ["src/shared/api/generated/**"],
    rules: { "fsd/public-api": "off" },
  },
])
```

The `fsd/insignificant-slice` suppressions for `widgets/`, `features/`, `entities/` are no longer needed — Phase 1b populates every layer.

- [ ] **Step 2: Run Steiger to confirm clean**

```bash
cd frontend && bun run lint
```

Expected: green. If Steiger flags any slice as `insignificant-slice`, that slice has no UI — review whether the slice is justified or should be merged elsewhere.

- [ ] **Step 3: Run the full test suite + coverage check**

```bash
cd frontend && bun run test
```

Expected: every test green. Eyeball the count — should be in the 50-60 range across all the new test files.

If coverage tooling is desired (Vitest's built-in `--coverage` flag), run:

```bash
cd frontend && bunx vitest run --coverage
```

Expected coverage on Phase 1 files (entities/product, features/catalog-*, widgets/*, pages/catalog, pages/product-detail) ≥ 80%. If below, add tests until threshold met.

- [ ] **Step 4: Final lint + typecheck + build**

```bash
cd /home/z3tz3r0/Projects/ecommerce-space-craft
make lint-frontend
make typecheck-frontend
make build-frontend
```

Expected: all exit 0.

- [ ] **Step 5: Commit Steiger config cleanup**

```bash
git add frontend/steiger.config.ts
git commit -m "chore(steiger): drop placeholder-layer suppressions now that slices are populated"
```

- [ ] **Step 6: Push the branch**

```bash
git push --set-upstream origin phase-1b/catalog-frontend
```

- [ ] **Step 7: Open the PR**

```bash
gh pr create --title "phase 1b — catalog frontend: list, detail, featured" --body "$(cat <<'EOF'
## Summary
- New `/products` catalog page with filter sidebar (multi-select category checkboxes), sort dropdown (newest/price-asc/price-desc), debounced search input, and responsive product grid.
- New `/products/:id` product detail page with full product info and stock badge.
- Home page (`/`) now shows hero + featured section (4 cards) instead of the Phase 0 demo.
- Stock display: `In stock` / `Low stock — N left` / `Out of stock` (shadcn Badge with neutral variants only — `outline` for out, not `destructive`).
- Filter / sort / search state is in the URL — shareable links.
- Client-side filter+sort+search via `useMemo` over the cached product list (per spec Section "Locked decisions"; server-side migration parked for Phase 4).
- New shared helpers: `useQueryParam(List)` (port from terracota), `formatPrice`.
- shadcn primitives added: Badge, Skeleton, Checkbox, Input, Select.
- All Tailwind utilities are layout-only — shadcn primitive defaults only (per Phase 0–3 discipline).
- Steiger config cleaned up — placeholder-layer suppressions removed now that all FSD layers have real content.

## Donor patterns ported
- `basia-borkowska/terracota-store`: `widgets/ProductCard`, `shared/hooks/useQueryParams`, `features/catalog-filters/useCategoryFilter` shape.
- `itsproutorgua/olx-killer-monorepo`: hook idioms (`use-latest-products`, `use-filters-from-params`).
- User's own `Project-Daily-Vogue`: filter sidebar checkbox layout, BestSeller grid composition.

Spec: `docs/superpowers/specs/2026-04-18-phase-1-catalog-design.md` Sections 2 & 3.
Plan: `docs/superpowers/plans/2026-04-18-phase-1b-catalog-frontend.md`.

## Test plan
- [x] All new vitest + RTL tests green locally (~50 tests).
- [x] `bun run lint`, `bun run typecheck`, `bun run build` green locally.
- [x] Manual local smoke test in browser (filter/sort/search/detail/featured).
- [ ] CI green.
- [ ] Vercel preview deploy succeeds; same flows verified on preview URL.
- [ ] After merge: production at `https://ecommerce-space-craft.vercel.app/` shows real products from Render backend.
- [ ] Featured section on home page shows the 4 seeded featured ships across 4 categories.
- [ ] Direct nav to `/products?category=Fighter&sort=price-asc` reproduces the filtered view (URL-as-state round-trip).
EOF
)"
```

- [ ] **Step 8: Watch CI**

```bash
gh pr checks --watch
```

Expected: all checks green. If a check fails:

```bash
gh run view --log-failed
```

Common failure modes:
- Codegen drift: re-run `make codegen-ts`, commit, push.
- Lint failure (Biome formatting): run `bun run format`, commit, push.
- Steiger violation: read the message — usually a missing `index.ts` Public API.

Push fixes as additional commits on the same branch.

- [ ] **Step 9: Manually verify the Vercel preview URL**

Once the Vercel preview deploy is ready (linked from the PR via the Vercel bot comment), open it in a browser. Walk through the smoke-test list from Task 9 Step 15 against the preview URL. Pay attention to:
- First request after a long idle takes 30-60s (Render cold start) — wait it out.
- The featured section should show 4 distinct products.
- All shadcn primitives render in their neutral defaults — no unexpected colors.

- [ ] **Step 10: Merge to main**

Once CI is green, the preview deploy works, and you've smoke-tested it:

```bash
gh pr merge --squash --delete-branch
git checkout main && git pull
```

- [ ] **Step 11: Verify the Vercel production deploy**

Vercel auto-deploys `main` to `https://ecommerce-space-craft.vercel.app/`. Within a minute or two of merge, the production URL should reflect the new build.

Open `https://ecommerce-space-craft.vercel.app/` and walk through the smoke-test list one more time on production:
- Home: hero + featured section with 4 cards from real Render backend.
- `/products`: 15 cards, sidebar, sort, search.
- `/products/<some-id>`: detail page renders.
- `/products?category=Fighter&sort=price-asc`: shareable URL renders the filtered, sorted view.
- Refresh `/products/<some-id>` directly — does NOT 404 (Vercel SPA rewrite from Phase 0).

- [ ] **Step 12: Phase 1 is shipped**

Update `phase_status.md` in memory: Phase 1 complete + browser-verified on production. Phase 2 (identity & cart) is next.

If anything in production diverges from local — particularly CORS, cold-start, or codegen drift — capture the gotcha in the appropriate memory file (`render_backend_quirks.md`, `frontend_build_quirks.md`) before moving on.

---

## Self-review (planner-side, performed before saving)

- All 10 tasks have concrete code blocks for every code-change step. No "TBD", "TODO", or generic "implement appropriately" lines.
- Type consistency: `Product`, `Category`, `SortOrder`, `StockStatus`, `useProducts`, `useProduct`, `useFeaturedProducts`, `productKeys`, `formatPrice`, `useQueryParam`, `useQueryParamList`, `useCategoryFilter`, `useSortOrder`, `useSearchQuery`, `sortProducts`, `stockStatus`, `stockLabel`, `StockBadge`, `ProductCard`, `ProductGrid`, `ProductGridSkeleton`, `FilterSidebar`, `FeaturedSection`, `CatalogPage`, `ProductDetailPage` are all referenced consistently across tasks.
- Spec coverage:
  - Section 2.1 routing → Task 9 (router wire-up + 3 page files).
  - Section 2.2 FSD layout → Tasks 3, 4, 5, 6, 7, 8, 9 collectively populate every directory listed.
  - Section 2.3 URL state → Tasks 2 (helpers) + 6 (3 feature hooks) + tested with `MemoryRouter`.
  - Section 2.4 query keys → Task 4.
  - Section 2.5 page composition → Task 9 (CatalogPage with `useMemo` over `useProducts`).
  - Section 2.6 stock display → Tasks 3 (helper) + 5 (StockBadge with `outline` variant for out-of-stock per the layout-only-Tailwind override).
  - Section 2.7 out-of-stock cards → Task 7 (ProductCard renders StockBadge with `outline` for out).
  - Section 2.8 loading + error UX → Tasks 7 (ProductGrid skeleton/empty/error) + 9 (ProductDetailPage skeleton/404).
  - Section 2.9 codegen → Task 1.
  - Section 3 tests → every implementation step has a paired test step in TDD order.
- Plan ends with explicit push → PR → CI watch → merge → deploy verify steps (Task 10).
- Donor attribution is preserved in code comments (within tasks where ports happen) and in the PR body.
- The `outline` vs `destructive` Badge variant decision is documented in both Task 5 Step 7 and the spec Section 2.6.
