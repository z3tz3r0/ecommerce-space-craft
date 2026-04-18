# Phase 2b — Identity & Cart Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Phase 2 frontend: email+password auth forms, `useAuth()` over the merged backend endpoints, a `useCart()` facade that routes to a zustand+localStorage guest store when logged out and to TanStack Query against the server cart when logged in, four new pages (`/login`, `/signup`, `/account`, `/cart`), an "Add to cart" button on the product detail page, a site-wide header widget with a cart-count badge, and additive guest→server merge-on-login.

**Architecture:** Strict FSD layering (Steiger-enforced). Two new entity slices (`entities/user`, `entities/cart`), four feature slices (`features/auth-login`, `auth-signup`, `auth-logout`, `cart-actions`), two widget slices (`widgets/site-header`, `widgets/cart-line`), four page slices (`pages/login`, `signup`, `account`, `cart`). The `entities/cart/lib/cart-facade.ts` is the single routing point between guest and server — all downstream UI talks to `useCart()` and doesn't care about the underlying source. Merge-on-login is triggered from the login and signup mutations' `onSuccess` callbacks, which POST the guest items to `/api/cart/merge`, clear the zustand store, and invalidate the server-cart + user queries.

**Tech Stack:**
- React 19 + TypeScript 6, Vite 8, Vitest 4, Biome 2.4, Steiger
- `@tanstack/react-query` v5 for server state
- `zustand` + `persist` middleware for guest cart
- `react-hook-form` + `@hookform/resolvers` + `zod` for form validation
- `sonner` for toast notifications
- shadcn-style primitives (folder-per-component) for `Input`, `Label`, `Form`, `Badge`, `Separator`, `DropdownMenu`, `Sonner`
- `openapi-typescript` + `openapi-fetch` (existing) pick up regenerated types
- `react-router` v7 (no `-dom` suffix)

---

## File structure (end state)

```
frontend/
├── package.json                                          MODIFY — add runtime deps
├── src/
│   ├── app/
│   │   ├── App.tsx                                       MODIFY — wrap in <SiteHeader/> + <Toaster/>
│   │   └── providers/
│   │       ├── index.tsx                                 (unchanged)
│   │       ├── query/index.tsx                           (unchanged)
│   │       └── router/routes.tsx                         MODIFY — add 4 new routes
│   ├── shared/
│   │   ├── api/generated/types.ts                        MODIFY — regenerated from Plan 2a's OpenAPI
│   │   ├── ui/
│   │   │   ├── label/{Label.tsx,index.ts}                NEW
│   │   │   ├── form/{Form.tsx,index.ts}                  NEW
│   │   │   ├── separator/{Separator.tsx,index.ts}        NEW
│   │   │   ├── dropdown-menu/{DropdownMenu.tsx,index.ts} NEW
│   │   │   └── sonner/{Sonner.tsx,index.ts}              NEW
│   │   └── lib/
│   │       └── require-auth.tsx                          NEW — navigate-on-401 helper
│   ├── entities/
│   │   ├── product/                                      (unchanged)
│   │   ├── user/                                         NEW SLICE
│   │   │   ├── api/
│   │   │   │   ├── user-keys.ts
│   │   │   │   ├── use-auth.ts
│   │   │   │   ├── use-auth.test.tsx
│   │   │   │   ├── use-login-mutation.ts
│   │   │   │   ├── use-signup-mutation.ts
│   │   │   │   ├── use-logout-mutation.ts
│   │   │   │   └── index.ts
│   │   │   ├── model/types.ts
│   │   │   └── index.ts
│   │   └── cart/                                         NEW SLICE
│   │       ├── api/
│   │       │   ├── cart-keys.ts
│   │       │   ├── use-server-cart.ts
│   │       │   ├── use-cart-mutations.ts
│   │       │   ├── use-merge-cart-mutation.ts
│   │       │   ├── use-server-cart.test.tsx
│   │       │   └── index.ts
│   │       ├── lib/
│   │       │   ├── cart-facade.ts
│   │       │   ├── cart-facade.test.tsx
│   │       │   └── index.ts
│   │       ├── model/
│   │       │   ├── types.ts
│   │       │   ├── guest-store.ts
│   │       │   ├── guest-store.test.ts
│   │       │   ├── subtotal.ts
│   │       │   └── subtotal.test.ts
│   │       └── index.ts
│   ├── features/
│   │   ├── auth-login/
│   │   │   ├── ui/{LoginForm.tsx,LoginForm.test.tsx}
│   │   │   ├── model/schema.ts
│   │   │   └── index.ts
│   │   ├── auth-signup/
│   │   │   ├── ui/{SignupForm.tsx,SignupForm.test.tsx}
│   │   │   ├── model/schema.ts
│   │   │   └── index.ts
│   │   ├── auth-logout/
│   │   │   ├── ui/{LogoutButton.tsx,LogoutButton.test.tsx}
│   │   │   └── index.ts
│   │   └── cart-actions/
│   │       ├── ui/
│   │       │   ├── AddToCartButton.tsx
│   │       │   ├── AddToCartButton.test.tsx
│   │       │   ├── QuantityStepper.tsx
│   │       │   └── QuantityStepper.test.tsx
│   │       └── index.ts
│   ├── widgets/
│   │   ├── site-header/
│   │   │   ├── SiteHeader.tsx
│   │   │   ├── SiteHeader.test.tsx
│   │   │   └── index.ts
│   │   └── cart-line/
│   │       ├── CartLine.tsx
│   │       ├── CartLine.test.tsx
│   │       └── index.ts
│   └── pages/
│       ├── login/
│       │   ├── ui/{LoginPage.tsx,LoginPage.test.tsx}
│       │   └── index.ts
│       ├── signup/
│       │   ├── ui/{SignupPage.tsx,SignupPage.test.tsx}
│       │   └── index.ts
│       ├── account/
│       │   ├── ui/{AccountPage.tsx,AccountPage.test.tsx}
│       │   └── index.ts
│       ├── cart/
│       │   ├── ui/{CartPage.tsx,CartPage.test.tsx}
│       │   └── index.ts
│       └── product-detail/ui/ProductDetailPage.tsx       MODIFY — mount AddToCartButton
└── steiger.config.ts                                     MODIFY — add any narrow new suppressions
```

**Branch:** `phase-2b/identity-cart-frontend` (created in Task 1, off `main` after Plan 2a merges).

---

## Task 1 — Branch, deps, shadcn primitives, codegen

**Files:**
- Modify: `frontend/package.json`, `frontend/bun.lock`
- Modify: `frontend/src/shared/api/generated/types.ts` (regenerated)
- Create: `frontend/src/shared/ui/label/{Label.tsx,index.ts}`
- Create: `frontend/src/shared/ui/form/{Form.tsx,index.ts}`
- Create: `frontend/src/shared/ui/separator/{Separator.tsx,index.ts}`
- Create: `frontend/src/shared/ui/dropdown-menu/{DropdownMenu.tsx,index.ts}`
- Create: `frontend/src/shared/ui/sonner/{Sonner.tsx,index.ts}`

---

- [ ] **Step 1: Update local main and branch**

```bash
cd /home/z3tz3r0/Projects/ecommerce-space-craft
git checkout main
git pull --ff-only origin main
git checkout -b phase-2b/identity-cart-frontend
```

Confirm the merged Plan 2a backend changes are present:

```bash
git log --oneline main -5
jq '.paths | keys' backend/openapi.json | head
```

Expected: `/api/auth/signup`, `/api/auth/login`, `/api/auth/me`, `/api/auth/logout`, `/api/cart`, `/api/cart/items`, `/api/cart/items/{productId}`, `/api/cart/merge` appear.

- [ ] **Step 2: Install new runtime dependencies**

```bash
cd frontend
bun add zustand@^5 react-hook-form@^7 @hookform/resolvers@^3 zod@^3 sonner@^1
bun add @radix-ui/react-label @radix-ui/react-separator @radix-ui/react-dropdown-menu
```

Radix UI primitives power the shadcn Label/Separator/DropdownMenu. The existing `radix-ui` meta-package already provides `Slot` (used by the existing Button), but Label/Separator/DropdownMenu need individual packages because the shadcn reference source imports each directly (`@radix-ui/react-label`, etc.). These are runtime deps — they ship in the bundle. Verify with:

```bash
bun run typecheck
```

Expected: no errors (deps are typed but unused).

- [ ] **Step 3: Regenerate the typed API client**

```bash
cd frontend
bun run codegen:api
bun run typecheck
```

Expected: `src/shared/api/generated/types.ts` grows to include `User`, `Cart`, `Item`, `AddCartItemInput`, etc., and typecheck passes.

- [ ] **Step 4: Add the shadcn Label primitive**

Create `frontend/src/shared/ui/label/Label.tsx`:

```tsx
import * as LabelPrimitive from "@radix-ui/react-label"
import type * as React from "react"

import { cn } from "@/shared/lib/utils"

function Label({
  className,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        "flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className,
      )}
      {...props}
    />
  )
}

export { Label }
```

Create `frontend/src/shared/ui/label/index.ts`:

```ts
export { Label } from "./Label"
```

- [ ] **Step 5: Add the shadcn Form primitive**

Create `frontend/src/shared/ui/form/Form.tsx`:

```tsx
import * as LabelPrimitive from "@radix-ui/react-label"
import { Slot } from "radix-ui"
import * as React from "react"
import {
  Controller,
  type ControllerProps,
  type FieldPath,
  type FieldValues,
  FormProvider,
  useFormContext,
  useFormState,
} from "react-hook-form"

import { cn } from "@/shared/lib/utils"
import { Label } from "@/shared/ui/label"

const Form = FormProvider

type FormFieldContextValue<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> = {
  name: TName
}

const FormFieldContext = React.createContext<FormFieldContextValue>({} as FormFieldContextValue)

function FormField<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({ ...props }: ControllerProps<TFieldValues, TName>) {
  return (
    <FormFieldContext.Provider value={{ name: props.name }}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  )
}

function useFormField() {
  const fieldContext = React.useContext(FormFieldContext)
  const itemContext = React.useContext(FormItemContext)
  const { getFieldState } = useFormContext()
  const formState = useFormState({ name: fieldContext.name })
  const fieldState = getFieldState(fieldContext.name, formState)

  if (!fieldContext) {
    throw new Error("useFormField should be used within <FormField>")
  }

  const { id } = itemContext

  return {
    id,
    name: fieldContext.name,
    formItemId: `${id}-form-item`,
    formDescriptionId: `${id}-form-item-description`,
    formMessageId: `${id}-form-item-message`,
    ...fieldState,
  }
}

type FormItemContextValue = { id: string }

const FormItemContext = React.createContext<FormItemContextValue>({} as FormItemContextValue)

function FormItem({ className, ...props }: React.ComponentProps<"div">) {
  const id = React.useId()
  return (
    <FormItemContext.Provider value={{ id }}>
      <div data-slot="form-item" className={cn("grid gap-2", className)} {...props} />
    </FormItemContext.Provider>
  )
}

function FormLabel({
  className,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root>) {
  const { error, formItemId } = useFormField()
  return (
    <Label
      data-slot="form-label"
      data-error={!!error}
      className={cn("data-[error=true]:text-destructive", className)}
      htmlFor={formItemId}
      {...props}
    />
  )
}

function FormControl({ ...props }: React.ComponentProps<typeof Slot.Root>) {
  const { error, formItemId, formDescriptionId, formMessageId } = useFormField()
  return (
    <Slot.Root
      data-slot="form-control"
      id={formItemId}
      aria-describedby={
        !error ? `${formDescriptionId}` : `${formDescriptionId} ${formMessageId}`
      }
      aria-invalid={!!error}
      {...props}
    />
  )
}

function FormDescription({ className, ...props }: React.ComponentProps<"p">) {
  const { formDescriptionId } = useFormField()
  return (
    <p
      data-slot="form-description"
      id={formDescriptionId}
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  )
}

function FormMessage({ className, ...props }: React.ComponentProps<"p">) {
  const { error, formMessageId } = useFormField()
  const body = error ? String(error?.message ?? "") : props.children
  if (!body) return null
  return (
    <p
      data-slot="form-message"
      id={formMessageId}
      className={cn("text-destructive text-sm", className)}
      {...props}
    >
      {body}
    </p>
  )
}

export { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage, useFormField }
```

Create `frontend/src/shared/ui/form/index.ts`:

```ts
export {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  useFormField,
} from "./Form"
```

- [ ] **Step 6: Add the shadcn Separator primitive**

Create `frontend/src/shared/ui/separator/Separator.tsx`:

```tsx
import * as SeparatorPrimitive from "@radix-ui/react-separator"
import type * as React from "react"

import { cn } from "@/shared/lib/utils"

function Separator({
  className,
  orientation = "horizontal",
  decorative = true,
  ...props
}: React.ComponentProps<typeof SeparatorPrimitive.Root>) {
  return (
    <SeparatorPrimitive.Root
      data-slot="separator"
      decorative={decorative}
      orientation={orientation}
      className={cn(
        "bg-border shrink-0 data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px",
        className,
      )}
      {...props}
    />
  )
}

export { Separator }
```

Create `frontend/src/shared/ui/separator/index.ts`:

```ts
export { Separator } from "./Separator"
```

- [ ] **Step 7: Add the shadcn DropdownMenu primitive**

Create `frontend/src/shared/ui/dropdown-menu/DropdownMenu.tsx`:

```tsx
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu"
import type * as React from "react"

import { cn } from "@/shared/lib/utils"

function DropdownMenu(props: React.ComponentProps<typeof DropdownMenuPrimitive.Root>) {
  return <DropdownMenuPrimitive.Root data-slot="dropdown-menu" {...props} />
}

function DropdownMenuTrigger(
  props: React.ComponentProps<typeof DropdownMenuPrimitive.Trigger>,
) {
  return <DropdownMenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />
}

function DropdownMenuContent({
  className,
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        data-slot="dropdown-menu-content"
        sideOffset={sideOffset}
        className={cn(
          "bg-popover text-popover-foreground z-50 max-h-(--radix-dropdown-menu-content-available-height) min-w-[8rem] overflow-x-hidden overflow-y-auto rounded-md border p-1 shadow-md",
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          className,
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  )
}

function DropdownMenuItem({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item>) {
  return (
    <DropdownMenuPrimitive.Item
      data-slot="dropdown-menu-item"
      className={cn(
        "focus:bg-accent focus:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className,
      )}
      {...props}
    />
  )
}

function DropdownMenuLabel({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Label>) {
  return (
    <DropdownMenuPrimitive.Label
      data-slot="dropdown-menu-label"
      className={cn("px-2 py-1.5 text-sm font-medium", className)}
      {...props}
    />
  )
}

function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return (
    <DropdownMenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={cn("bg-border -mx-1 my-1 h-px", className)}
      {...props}
    />
  )
}

export {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
}
```

Create `frontend/src/shared/ui/dropdown-menu/index.ts`:

```ts
export {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./DropdownMenu"
```

- [ ] **Step 8: Add the sonner Toaster wrapper**

Create `frontend/src/shared/ui/sonner/Sonner.tsx`:

```tsx
import { Toaster as SonnerToaster, type ToasterProps } from "sonner"

function Toaster(props: ToasterProps) {
  return <SonnerToaster position="top-right" richColors {...props} />
}

export { Toaster }
```

Create `frontend/src/shared/ui/sonner/index.ts`:

```ts
export { Toaster } from "./Sonner"
```

- [ ] **Step 9: Typecheck + lint**

```bash
cd frontend
bun run typecheck
bun run lint
```

Expected: no errors. Steiger may flag the new `ui/` dirs as lacking segments — shadcn-style primitives deliberately keep the file adjacent to `index.ts`, so this matches the existing pattern.

- [ ] **Step 10: Commit**

```bash
cd /home/z3tz3r0/Projects/ecommerce-space-craft
git add frontend/package.json frontend/bun.lock frontend/src/shared/api/generated/types.ts frontend/src/shared/ui/label frontend/src/shared/ui/form frontend/src/shared/ui/separator frontend/src/shared/ui/dropdown-menu frontend/src/shared/ui/sonner
git commit -m "chore(frontend): add auth/cart deps + shadcn label/form/separator/dropdown/sonner + regen API types"
```

---

## Task 2 — `entities/user` slice

**Files:**
- Create: `frontend/src/entities/user/model/types.ts`
- Create: `frontend/src/entities/user/api/user-keys.ts`
- Create: `frontend/src/entities/user/api/use-auth.ts`
- Create: `frontend/src/entities/user/api/use-auth.test.tsx`
- Create: `frontend/src/entities/user/api/use-login-mutation.ts`
- Create: `frontend/src/entities/user/api/use-signup-mutation.ts`
- Create: `frontend/src/entities/user/api/use-logout-mutation.ts`
- Create: `frontend/src/entities/user/api/index.ts`
- Create: `frontend/src/entities/user/index.ts`

---

- [ ] **Step 1: Write the model type**

Create `frontend/src/entities/user/model/types.ts`:

```ts
import type { components } from "@/shared/api"

export type User = components["schemas"]["User"]
```

- [ ] **Step 2: Write the query key factory**

Create `frontend/src/entities/user/api/user-keys.ts`:

```ts
export const userKeys = {
  all: ["user"] as const,
  me: () => [...userKeys.all, "me"] as const,
}
```

- [ ] **Step 3: Write the useAuth hook**

Create `frontend/src/entities/user/api/use-auth.ts`:

```ts
import { useQuery } from "@tanstack/react-query"
import { api } from "@/shared/api"
import type { User } from "../model/types"
import { userKeys } from "./user-keys"

// useAuth returns the currently authenticated user. A 401 from the backend
// surfaces as isError=true and data=undefined; callers use isError as the
// "logged out" signal rather than a sentinel error value.
export function useAuth() {
  return useQuery<User>({
    queryKey: userKeys.me(),
    retry: false,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await api.GET("/api/auth/me")
      if (error) {
        throw error
      }
      if (!data) {
        throw new Error("auth: empty response from /api/auth/me")
      }
      return data
    },
  })
}
```

- [ ] **Step 4: Write the login mutation**

Create `frontend/src/entities/user/api/use-login-mutation.ts`:

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/shared/api"
import type { User } from "../model/types"
import { userKeys } from "./user-keys"

export function useLoginMutation() {
  const qc = useQueryClient()
  return useMutation<User, Error, { email: string; password: string }>({
    mutationFn: async ({ email, password }) => {
      const { data, error } = await api.POST("/api/auth/login", {
        body: { email, password },
      })
      if (error) {
        throw new Error(error.detail ?? error.title ?? "Login failed")
      }
      if (!data) {
        throw new Error("auth: empty response from /api/auth/login")
      }
      return data
    },
    onSuccess: (user) => {
      qc.setQueryData(userKeys.me(), user)
    },
  })
}
```

- [ ] **Step 5: Write the signup mutation**

Create `frontend/src/entities/user/api/use-signup-mutation.ts`:

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/shared/api"
import type { User } from "../model/types"
import { userKeys } from "./user-keys"

export function useSignupMutation() {
  const qc = useQueryClient()
  return useMutation<User, Error, { email: string; password: string }>({
    mutationFn: async ({ email, password }) => {
      const { data, error } = await api.POST("/api/auth/signup", {
        body: { email, password },
      })
      if (error) {
        throw new Error(error.detail ?? error.title ?? "Signup failed")
      }
      if (!data) {
        throw new Error("auth: empty response from /api/auth/signup")
      }
      return data
    },
    onSuccess: (user) => {
      qc.setQueryData(userKeys.me(), user)
    },
  })
}
```

- [ ] **Step 6: Write the logout mutation**

Create `frontend/src/entities/user/api/use-logout-mutation.ts`:

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/shared/api"
import { userKeys } from "./user-keys"

export function useLogoutMutation() {
  const qc = useQueryClient()
  return useMutation<void, Error>({
    mutationFn: async () => {
      const { error } = await api.POST("/api/auth/logout")
      if (error) {
        throw new Error(error.detail ?? error.title ?? "Logout failed")
      }
    },
    onSuccess: () => {
      qc.removeQueries({ queryKey: userKeys.me() })
      // Cart queries are invalidated by the cart slice's own wiring.
    },
  })
}
```

- [ ] **Step 7: Write the useAuth test**

Create `frontend/src/entities/user/api/use-auth.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useAuth } from "./use-auth"

const mockGet = vi.hoisted(() => vi.fn())

vi.mock("@/shared/api", () => ({
  api: { GET: mockGet },
}))

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe("useAuth", () => {
  beforeEach(() => {
    mockGet.mockReset()
  })
  afterEach(() => {
    mockGet.mockReset()
  })

  it("returns the user on 200", async () => {
    const user = {
      id: "u1",
      email: "a@b.com",
      createdAt: "2026-04-18T00:00:00Z",
      updatedAt: "2026-04-18T00:00:00Z",
    }
    mockGet.mockResolvedValue({ data: user, error: undefined })

    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(user)
  })

  it("surfaces 401 as isError", async () => {
    mockGet.mockResolvedValue({
      data: undefined,
      error: { title: "Unauthorized", status: 401, detail: "not authenticated" },
    })

    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.data).toBeUndefined()
  })
})
```

- [ ] **Step 8: Write the API barrel and slice barrel**

Create `frontend/src/entities/user/api/index.ts`:

```ts
export { useAuth } from "./use-auth"
export { useLoginMutation } from "./use-login-mutation"
export { useLogoutMutation } from "./use-logout-mutation"
export { useSignupMutation } from "./use-signup-mutation"
export { userKeys } from "./user-keys"
```

Create `frontend/src/entities/user/index.ts`:

```ts
export {
  useAuth,
  useLoginMutation,
  useLogoutMutation,
  useSignupMutation,
  userKeys,
} from "./api"
export type { User } from "./model/types"
```

- [ ] **Step 9: Run the test**

```bash
cd frontend
bun run test src/entities/user
```

Expected: 2/2 tests pass.

- [ ] **Step 10: Commit**

```bash
cd /home/z3tz3r0/Projects/ecommerce-space-craft
git add frontend/src/entities/user/
git commit -m "feat(frontend): add entities/user slice with useAuth + login/signup/logout mutations"
```

---

## Task 3 — `entities/cart` model: types, guest store, subtotal

**Files:**
- Create: `frontend/src/entities/cart/model/types.ts`
- Create: `frontend/src/entities/cart/model/guest-store.ts`
- Create: `frontend/src/entities/cart/model/guest-store.test.ts`
- Create: `frontend/src/entities/cart/model/subtotal.ts`
- Create: `frontend/src/entities/cart/model/subtotal.test.ts`

---

- [ ] **Step 1: Write the shared cart types**

Create `frontend/src/entities/cart/model/types.ts`:

```ts
import type { components } from "@/shared/api"

// Server-side cart item shape, defined by the backend OpenAPI.
export type ServerCartItem = components["schemas"]["Item"]

// Guest cart item — shape captured at add-time into localStorage. The
// StockQuantity is a snapshot; the server refreshes it on the next fetch.
export interface GuestCartItem {
  productId: string
  name: string
  priceCents: number
  imageUrl?: string | null
  quantity: number
  stockQuantity: number
}

// Unified cart item shape consumed by UI. Both guest and server items
// coerce to this.
export interface CartItem {
  productId: string
  name: string
  priceCents: number
  imageUrl?: string | null
  quantity: number
  stockQuantity: number
}
```

- [ ] **Step 2: Write the guest store tests**

Create `frontend/src/entities/cart/model/guest-store.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { useGuestCartStore } from "./guest-store"

function resetStore() {
  useGuestCartStore.setState({ items: [] })
  localStorage.clear()
}

describe("useGuestCartStore", () => {
  beforeEach(resetStore)
  afterEach(resetStore)

  it("adds a new item", () => {
    useGuestCartStore.getState().add({
      productId: "p1",
      name: "X-Wing",
      priceCents: 100,
      stockQuantity: 5,
    })
    expect(useGuestCartStore.getState().items).toEqual([
      {
        productId: "p1",
        name: "X-Wing",
        priceCents: 100,
        quantity: 1,
        stockQuantity: 5,
      },
    ])
  })

  it("increments an existing item", () => {
    useGuestCartStore.getState().add({
      productId: "p1",
      name: "X-Wing",
      priceCents: 100,
      stockQuantity: 5,
    })
    useGuestCartStore.getState().add({
      productId: "p1",
      name: "X-Wing",
      priceCents: 100,
      stockQuantity: 5,
      quantity: 2,
    })
    expect(useGuestCartStore.getState().items[0].quantity).toBe(3)
  })

  it("clamps add to stockQuantity", () => {
    useGuestCartStore.getState().add({
      productId: "p1",
      name: "X-Wing",
      priceCents: 100,
      stockQuantity: 2,
      quantity: 5,
    })
    expect(useGuestCartStore.getState().items[0].quantity).toBe(2)
  })

  it("set replaces quantity, clamped to stock", () => {
    useGuestCartStore.getState().add({
      productId: "p1",
      name: "X-Wing",
      priceCents: 100,
      stockQuantity: 3,
    })
    useGuestCartStore.getState().set("p1", 5)
    expect(useGuestCartStore.getState().items[0].quantity).toBe(3)
  })

  it("set with 0 removes the item", () => {
    useGuestCartStore.getState().add({
      productId: "p1",
      name: "X-Wing",
      priceCents: 100,
      stockQuantity: 3,
    })
    useGuestCartStore.getState().set("p1", 0)
    expect(useGuestCartStore.getState().items).toHaveLength(0)
  })

  it("remove drops an item", () => {
    useGuestCartStore.getState().add({
      productId: "p1",
      name: "X-Wing",
      priceCents: 100,
      stockQuantity: 3,
    })
    useGuestCartStore.getState().remove("p1")
    expect(useGuestCartStore.getState().items).toHaveLength(0)
  })

  it("clear empties the store", () => {
    useGuestCartStore.getState().add({
      productId: "p1",
      name: "X-Wing",
      priceCents: 100,
      stockQuantity: 3,
    })
    useGuestCartStore.getState().clear()
    expect(useGuestCartStore.getState().items).toHaveLength(0)
  })
})
```

- [ ] **Step 3: Write the zustand store**

Create `frontend/src/entities/cart/model/guest-store.ts`:

```ts
import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { GuestCartItem } from "./types"

interface GuestCartState {
  items: GuestCartItem[]
  add: (item: Omit<GuestCartItem, "quantity"> & { quantity?: number }) => void
  set: (productId: string, quantity: number) => void
  remove: (productId: string) => void
  clear: () => void
}

export const useGuestCartStore = create<GuestCartState>()(
  persist(
    (setState) => ({
      items: [],
      add: (input) => {
        const incoming = input.quantity ?? 1
        setState((state) => {
          const idx = state.items.findIndex((i) => i.productId === input.productId)
          if (idx === -1) {
            const clamped = Math.min(incoming, input.stockQuantity)
            if (clamped < 1) return state
            return {
              items: [
                ...state.items,
                {
                  productId: input.productId,
                  name: input.name,
                  priceCents: input.priceCents,
                  imageUrl: input.imageUrl ?? undefined,
                  stockQuantity: input.stockQuantity,
                  quantity: clamped,
                },
              ],
            }
          }
          const next = [...state.items]
          const existing = next[idx]
          const nextQty = Math.min(existing.quantity + incoming, input.stockQuantity)
          next[idx] = { ...existing, stockQuantity: input.stockQuantity, quantity: nextQty }
          return { items: next }
        })
      },
      set: (productId, quantity) => {
        setState((state) => {
          const idx = state.items.findIndex((i) => i.productId === productId)
          if (idx === -1) return state
          if (quantity < 1) {
            return { items: state.items.filter((i) => i.productId !== productId) }
          }
          const next = [...state.items]
          const existing = next[idx]
          next[idx] = { ...existing, quantity: Math.min(quantity, existing.stockQuantity) }
          return { items: next }
        })
      },
      remove: (productId) => {
        setState((state) => ({ items: state.items.filter((i) => i.productId !== productId) }))
      },
      clear: () => setState({ items: [] }),
    }),
    { name: "guest-cart" },
  ),
)
```

- [ ] **Step 4: Run guest-store tests**

```bash
cd frontend
bun run test src/entities/cart/model/guest-store
```

Expected: 7/7 pass.

- [ ] **Step 5: Write the subtotal helper tests**

Create `frontend/src/entities/cart/model/subtotal.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { subtotalCents } from "./subtotal"

describe("subtotalCents", () => {
  it("empty cart → 0", () => {
    expect(subtotalCents([])).toBe(0)
  })

  it("single line", () => {
    expect(subtotalCents([{ priceCents: 1250, quantity: 2 }])).toBe(2500)
  })

  it("multi line", () => {
    expect(
      subtotalCents([
        { priceCents: 100, quantity: 3 },
        { priceCents: 250, quantity: 2 },
      ]),
    ).toBe(800)
  })

  it("handles large values without overflow", () => {
    expect(subtotalCents([{ priceCents: 999_999_999, quantity: 1 }])).toBe(999_999_999)
  })
})
```

- [ ] **Step 6: Write the subtotal helper**

Create `frontend/src/entities/cart/model/subtotal.ts`:

```ts
interface PricedLine {
  priceCents: number
  quantity: number
}

// subtotalCents sums the (priceCents * quantity) of every line. It accepts
// any cart-shaped line — both guest and server items satisfy it.
export function subtotalCents(items: readonly PricedLine[]): number {
  return items.reduce((acc, line) => acc + line.priceCents * line.quantity, 0)
}
```

- [ ] **Step 7: Run subtotal tests**

```bash
cd frontend
bun run test src/entities/cart/model/subtotal
```

Expected: 4/4 pass.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/entities/cart/model/
git commit -m "feat(frontend): add cart model — types, zustand guest store (localStorage), subtotal"
```

---

## Task 4 — `entities/cart` api: server cart query + mutations + merge

**Files:**
- Create: `frontend/src/entities/cart/api/cart-keys.ts`
- Create: `frontend/src/entities/cart/api/use-server-cart.ts`
- Create: `frontend/src/entities/cart/api/use-server-cart.test.tsx`
- Create: `frontend/src/entities/cart/api/use-cart-mutations.ts`
- Create: `frontend/src/entities/cart/api/use-merge-cart-mutation.ts`
- Create: `frontend/src/entities/cart/api/index.ts`

---

- [ ] **Step 1: Write the query key factory**

Create `frontend/src/entities/cart/api/cart-keys.ts`:

```ts
export const cartKeys = {
  all: ["cart"] as const,
  server: () => [...cartKeys.all, "server"] as const,
}
```

- [ ] **Step 2: Write the server-cart query hook**

Create `frontend/src/entities/cart/api/use-server-cart.ts`:

```ts
import { useQuery } from "@tanstack/react-query"
import { api, type components } from "@/shared/api"
import { cartKeys } from "./cart-keys"

type ServerCart = components["schemas"]["Cart"]

// useServerCart fetches the authenticated user's cart from the backend.
// The caller MUST gate the call with `enabled` — typically bound to
// `useAuth().isSuccess` via the cart facade.
export function useServerCart(options: { enabled: boolean }) {
  return useQuery<ServerCart>({
    queryKey: cartKeys.server(),
    enabled: options.enabled,
    retry: false,
    queryFn: async () => {
      const { data, error } = await api.GET("/api/cart")
      if (error) throw new Error(error.detail ?? error.title ?? "Failed to load cart")
      if (!data) throw new Error("cart: empty response from /api/cart")
      return data
    },
  })
}
```

- [ ] **Step 3: Write the server-cart query test**

Create `frontend/src/entities/cart/api/use-server-cart.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useServerCart } from "./use-server-cart"

const mockGet = vi.hoisted(() => vi.fn())

vi.mock("@/shared/api", () => ({
  api: { GET: mockGet },
}))

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe("useServerCart", () => {
  beforeEach(() => mockGet.mockReset())

  it("returns items when enabled and authenticated", async () => {
    mockGet.mockResolvedValue({ data: { items: [] }, error: undefined })
    const { result } = renderHook(() => useServerCart({ enabled: true }), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual({ items: [] })
  })

  it("does not fetch when disabled", async () => {
    const { result } = renderHook(() => useServerCart({ enabled: false }), { wrapper })
    expect(result.current.fetchStatus).toBe("idle")
    expect(mockGet).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 4: Write the cart mutations hook**

Create `frontend/src/entities/cart/api/use-cart-mutations.ts`:

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { api, type components } from "@/shared/api"
import { cartKeys } from "./cart-keys"

type ServerCart = components["schemas"]["Cart"]

export function useAddCartItemMutation() {
  const qc = useQueryClient()
  return useMutation<void, Error, { productId: string; quantity: number }>({
    mutationFn: async ({ productId, quantity }) => {
      const { error } = await api.POST("/api/cart/items", {
        body: { productId, quantity },
      })
      if (error) throw new Error(error.detail ?? error.title ?? "Failed to add to cart")
    },
    onMutate: async ({ productId, quantity }) => {
      await qc.cancelQueries({ queryKey: cartKeys.server() })
      const prev = qc.getQueryData<ServerCart>(cartKeys.server())
      if (prev) {
        const idx = prev.items.findIndex((i) => i.productId === productId)
        const nextItems =
          idx === -1
            ? [
                ...prev.items,
                {
                  productId,
                  name: "…",
                  priceCents: 0,
                  imageUrl: null,
                  quantity,
                  stockQuantity: quantity,
                },
              ]
            : prev.items.map((i, j) =>
                j === idx ? { ...i, quantity: Math.min(i.stockQuantity, i.quantity + quantity) } : i,
              )
        qc.setQueryData<ServerCart>(cartKeys.server(), { items: nextItems })
      }
      return { prev }
    },
    onError: (_err, _vars, context) => {
      const ctx = context as { prev?: ServerCart } | undefined
      if (ctx?.prev) qc.setQueryData(cartKeys.server(), ctx.prev)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: cartKeys.server() })
    },
  })
}

export function useSetCartItemMutation() {
  const qc = useQueryClient()
  return useMutation<void, Error, { productId: string; quantity: number }>({
    mutationFn: async ({ productId, quantity }) => {
      const { error } = await api.PATCH("/api/cart/items/{productId}", {
        params: { path: { productId } },
        body: { quantity },
      })
      if (error) throw new Error(error.detail ?? error.title ?? "Failed to update quantity")
    },
    onMutate: async ({ productId, quantity }) => {
      await qc.cancelQueries({ queryKey: cartKeys.server() })
      const prev = qc.getQueryData<ServerCart>(cartKeys.server())
      if (prev) {
        const nextItems = prev.items.map((i) =>
          i.productId === productId ? { ...i, quantity: Math.min(i.stockQuantity, quantity) } : i,
        )
        qc.setQueryData<ServerCart>(cartKeys.server(), { items: nextItems })
      }
      return { prev }
    },
    onError: (_err, _vars, context) => {
      const ctx = context as { prev?: ServerCart } | undefined
      if (ctx?.prev) qc.setQueryData(cartKeys.server(), ctx.prev)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: cartKeys.server() })
    },
  })
}

export function useRemoveCartItemMutation() {
  const qc = useQueryClient()
  return useMutation<void, Error, { productId: string }>({
    mutationFn: async ({ productId }) => {
      const { error } = await api.DELETE("/api/cart/items/{productId}", {
        params: { path: { productId } },
      })
      if (error) throw new Error(error.detail ?? error.title ?? "Failed to remove item")
    },
    onMutate: async ({ productId }) => {
      await qc.cancelQueries({ queryKey: cartKeys.server() })
      const prev = qc.getQueryData<ServerCart>(cartKeys.server())
      if (prev) {
        qc.setQueryData<ServerCart>(cartKeys.server(), {
          items: prev.items.filter((i) => i.productId !== productId),
        })
      }
      return { prev }
    },
    onError: (_err, _vars, context) => {
      const ctx = context as { prev?: ServerCart } | undefined
      if (ctx?.prev) qc.setQueryData(cartKeys.server(), ctx.prev)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: cartKeys.server() })
    },
  })
}
```

- [ ] **Step 5: Write the merge mutation**

Create `frontend/src/entities/cart/api/use-merge-cart-mutation.ts`:

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/shared/api"
import { cartKeys } from "./cart-keys"

interface MergeItemInput {
  productId: string
  quantity: number
}

export function useMergeCartMutation() {
  const qc = useQueryClient()
  return useMutation<void, Error, MergeItemInput[]>({
    mutationFn: async (items) => {
      if (items.length === 0) return
      const { error } = await api.POST("/api/cart/merge", {
        body: { items },
      })
      if (error) throw new Error(error.detail ?? error.title ?? "Cart merge failed")
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: cartKeys.server() })
    },
  })
}
```

- [ ] **Step 6: Write the api barrel**

Create `frontend/src/entities/cart/api/index.ts`:

```ts
export { cartKeys } from "./cart-keys"
export {
  useAddCartItemMutation,
  useRemoveCartItemMutation,
  useSetCartItemMutation,
} from "./use-cart-mutations"
export { useMergeCartMutation } from "./use-merge-cart-mutation"
export { useServerCart } from "./use-server-cart"
```

- [ ] **Step 7: Run the test**

```bash
cd frontend
bun run test src/entities/cart/api
```

Expected: 2/2 pass.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/entities/cart/api/
git commit -m "feat(frontend): add cart api — useServerCart + add/set/remove/merge mutations"
```

---

## Task 5 — `entities/cart` facade + slice barrel

**Files:**
- Create: `frontend/src/entities/cart/lib/cart-facade.ts`
- Create: `frontend/src/entities/cart/lib/cart-facade.test.tsx`
- Create: `frontend/src/entities/cart/lib/index.ts`
- Create: `frontend/src/entities/cart/index.ts`

---

- [ ] **Step 1: Write the facade test**

Create `frontend/src/entities/cart/lib/cart-facade.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useGuestCartStore } from "../model/guest-store"
import { useCart } from "./cart-facade"

const mockUseAuth = vi.hoisted(() => vi.fn())
const mockGet = vi.hoisted(() => vi.fn())

vi.mock("@/entities/user", () => ({
  useAuth: mockUseAuth,
}))
vi.mock("@/shared/api", () => ({
  api: { GET: mockGet },
}))

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

function resetStore() {
  useGuestCartStore.setState({ items: [] })
  localStorage.clear()
}

describe("useCart facade", () => {
  beforeEach(() => {
    resetStore()
    mockUseAuth.mockReset()
    mockGet.mockReset()
  })
  afterEach(resetStore)

  it("uses the guest store when unauthenticated", async () => {
    mockUseAuth.mockReturnValue({ isSuccess: false, isError: true, isLoading: false, data: undefined })
    useGuestCartStore.getState().add({
      productId: "p1",
      name: "X-Wing",
      priceCents: 100,
      stockQuantity: 5,
    })
    const { result } = renderHook(() => useCart(), { wrapper })
    expect(result.current.items).toHaveLength(1)
    expect(result.current.subtotalCents).toBe(100)
  })

  it("uses the server cart when authenticated", async () => {
    mockUseAuth.mockReturnValue({
      isSuccess: true,
      isError: false,
      isLoading: false,
      data: { id: "u1", email: "a@b.com", createdAt: "2026-04-18T00:00:00Z", updatedAt: "2026-04-18T00:00:00Z" },
    })
    mockGet.mockResolvedValue({
      data: {
        items: [
          {
            productId: "p2",
            name: "Y-Wing",
            priceCents: 200,
            imageUrl: null,
            quantity: 3,
            stockQuantity: 5,
          },
        ],
      },
      error: undefined,
    })
    const { result } = renderHook(() => useCart(), { wrapper })
    await waitFor(() => expect(result.current.items).toHaveLength(1))
    expect(result.current.subtotalCents).toBe(600)
  })
})
```

- [ ] **Step 2: Write the facade**

Create `frontend/src/entities/cart/lib/cart-facade.ts`:

```ts
import { useCallback } from "react"
import { useAuth } from "@/entities/user"
import {
  useAddCartItemMutation,
  useRemoveCartItemMutation,
  useServerCart,
  useSetCartItemMutation,
} from "../api"
import { useGuestCartStore } from "../model/guest-store"
import { subtotalCents } from "../model/subtotal"
import type { CartItem } from "../model/types"

interface UseCartResult {
  items: CartItem[]
  isLoading: boolean
  add: (input: AddInput) => Promise<void>
  set: (productId: string, quantity: number) => Promise<void>
  remove: (productId: string) => Promise<void>
  subtotalCents: number
}

interface AddInput {
  productId: string
  name: string
  priceCents: number
  imageUrl?: string | null
  stockQuantity: number
  quantity?: number
}

// useCart is the single hook downstream UI consumes. Internally it routes
// to the zustand guest store when the user is unauthenticated (or auth is
// still loading on first mount) and to the server cart + mutations when
// authenticated.
export function useCart(): UseCartResult {
  const auth = useAuth()
  const authed = auth.isSuccess
  const guest = useGuestCartStore()
  const serverQuery = useServerCart({ enabled: authed })
  const addMut = useAddCartItemMutation()
  const setMut = useSetCartItemMutation()
  const removeMut = useRemoveCartItemMutation()

  const items: CartItem[] = authed
    ? (serverQuery.data?.items ?? []).map((i) => ({
        productId: i.productId,
        name: i.name,
        priceCents: i.priceCents,
        imageUrl: i.imageUrl,
        quantity: i.quantity,
        stockQuantity: i.stockQuantity,
      }))
    : guest.items.map((i) => ({ ...i }))

  const isLoading = authed ? serverQuery.isLoading : false

  const add = useCallback(
    async (input: AddInput) => {
      if (authed) {
        await addMut.mutateAsync({
          productId: input.productId,
          quantity: input.quantity ?? 1,
        })
        return
      }
      guest.add({
        productId: input.productId,
        name: input.name,
        priceCents: input.priceCents,
        imageUrl: input.imageUrl ?? undefined,
        stockQuantity: input.stockQuantity,
        quantity: input.quantity,
      })
    },
    [addMut, authed, guest],
  )

  const set = useCallback(
    async (productId: string, quantity: number) => {
      if (authed) {
        if (quantity < 1) {
          await removeMut.mutateAsync({ productId })
        } else {
          await setMut.mutateAsync({ productId, quantity })
        }
        return
      }
      guest.set(productId, quantity)
    },
    [authed, guest, removeMut, setMut],
  )

  const remove = useCallback(
    async (productId: string) => {
      if (authed) {
        await removeMut.mutateAsync({ productId })
        return
      }
      guest.remove(productId)
    },
    [authed, guest, removeMut],
  )

  return {
    items,
    isLoading,
    add,
    set,
    remove,
    subtotalCents: subtotalCents(items),
  }
}
```

- [ ] **Step 3: Write the lib and slice barrels**

Create `frontend/src/entities/cart/lib/index.ts`:

```ts
export { useCart } from "./cart-facade"
```

Create `frontend/src/entities/cart/index.ts`:

```ts
export {
  cartKeys,
  useAddCartItemMutation,
  useMergeCartMutation,
  useRemoveCartItemMutation,
  useServerCart,
  useSetCartItemMutation,
} from "./api"
export { useCart } from "./lib"
export { useGuestCartStore } from "./model/guest-store"
export { subtotalCents } from "./model/subtotal"
export type { CartItem, GuestCartItem, ServerCartItem } from "./model/types"
```

- [ ] **Step 4: Run the facade tests**

```bash
cd frontend
bun run test src/entities/cart/lib
```

Expected: 2/2 pass.

- [ ] **Step 5: Run the whole cart slice test suite**

```bash
cd frontend
bun run test src/entities/cart
```

Expected: 13/13 pass (7 guest-store + 4 subtotal + 2 server-cart + 2 facade… note the facade tests use the cart hooks so the count is 13).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/entities/cart/lib frontend/src/entities/cart/index.ts
git commit -m "feat(frontend): add cart facade routing between guest store and server cart"
```

---

## Task 6 — `features/auth-login` slice

**Files:**
- Create: `frontend/src/features/auth-login/model/schema.ts`
- Create: `frontend/src/features/auth-login/ui/LoginForm.tsx`
- Create: `frontend/src/features/auth-login/ui/LoginForm.test.tsx`
- Create: `frontend/src/features/auth-login/index.ts`

---

- [ ] **Step 1: Write the zod schema**

Create `frontend/src/features/auth-login/model/schema.ts`:

```ts
import { z } from "zod"

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
})

export type LoginValues = z.infer<typeof loginSchema>
```

- [ ] **Step 2: Write the failing LoginForm tests**

Create `frontend/src/features/auth-login/ui/LoginForm.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { MemoryRouter } from "react-router"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { LoginForm } from "./LoginForm"

const mutateAsync = vi.hoisted(() => vi.fn())
vi.mock("@/entities/user", () => ({
  useLoginMutation: () => ({ mutateAsync, isPending: false }),
}))
vi.mock("@/entities/cart", () => ({
  useGuestCartStore: { getState: () => ({ items: [], clear: () => {} }) },
  useMergeCartMutation: () => ({ mutateAsync: vi.fn() }),
}))

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

describe("LoginForm", () => {
  beforeEach(() => mutateAsync.mockReset())

  it("shows email format error for invalid email", async () => {
    render(<LoginForm />, { wrapper })
    await userEvent.type(screen.getByLabelText(/email/i), "not-an-email")
    await userEvent.type(screen.getByLabelText(/password/i), "anything")
    await userEvent.click(screen.getByRole("button", { name: /log in/i }))
    expect(await screen.findByText(/valid email/i)).toBeInTheDocument()
    expect(mutateAsync).not.toHaveBeenCalled()
  })

  it("submits valid credentials", async () => {
    mutateAsync.mockResolvedValue({
      id: "u1",
      email: "a@b.com",
      createdAt: "2026-04-18T00:00:00Z",
      updatedAt: "2026-04-18T00:00:00Z",
    })
    render(<LoginForm />, { wrapper })
    await userEvent.type(screen.getByLabelText(/email/i), "a@b.com")
    await userEvent.type(screen.getByLabelText(/password/i), "hunter2!!")
    await userEvent.click(screen.getByRole("button", { name: /log in/i }))
    expect(mutateAsync).toHaveBeenCalledWith({ email: "a@b.com", password: "hunter2!!" })
  })

  it("shows server error when mutation rejects", async () => {
    mutateAsync.mockRejectedValue(new Error("invalid email or password"))
    render(<LoginForm />, { wrapper })
    await userEvent.type(screen.getByLabelText(/email/i), "a@b.com")
    await userEvent.type(screen.getByLabelText(/password/i), "hunter2!!")
    await userEvent.click(screen.getByRole("button", { name: /log in/i }))
    expect(await screen.findByText(/invalid email or password/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Write the LoginForm component**

Create `frontend/src/features/auth-login/ui/LoginForm.tsx`:

```tsx
import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { Link, useNavigate } from "react-router"
import { useGuestCartStore, useMergeCartMutation } from "@/entities/cart"
import { useLoginMutation } from "@/entities/user"
import { Button } from "@/shared/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/ui/form"
import { Input } from "@/shared/ui/input"
import { loginSchema, type LoginValues } from "../model/schema"

export function LoginForm() {
  const navigate = useNavigate()
  const login = useLoginMutation()
  const merge = useMergeCartMutation()
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  })

  async function onSubmit(values: LoginValues) {
    setServerError(null)
    try {
      await login.mutateAsync(values)
      const guest = useGuestCartStore.getState()
      if (guest.items.length > 0) {
        await merge.mutateAsync(
          guest.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        )
        guest.clear()
      }
      navigate("/")
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Login failed")
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" autoComplete="email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="current-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {serverError && (
          <p role="alert" className="text-sm text-destructive">
            {serverError}
          </p>
        )}
        <Button type="submit" disabled={login.isPending}>
          {login.isPending ? "Logging in…" : "Log in"}
        </Button>
        <p className="text-sm">
          Need an account? <Link to="/signup" className="underline">Sign up</Link>
        </p>
      </form>
    </Form>
  )
}
```

- [ ] **Step 4: Write the barrel**

Create `frontend/src/features/auth-login/index.ts`:

```ts
export { LoginForm } from "./ui/LoginForm"
```

- [ ] **Step 5: Run tests**

```bash
cd frontend
bun run test src/features/auth-login
```

Expected: 3/3 pass.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/auth-login/
git commit -m "feat(frontend): add auth-login feature with react-hook-form+zod + merge-on-success"
```

---

## Task 7 — `features/auth-signup` slice

**Files:**
- Create: `frontend/src/features/auth-signup/model/schema.ts`
- Create: `frontend/src/features/auth-signup/ui/SignupForm.tsx`
- Create: `frontend/src/features/auth-signup/ui/SignupForm.test.tsx`
- Create: `frontend/src/features/auth-signup/index.ts`

---

- [ ] **Step 1: Write the zod schema**

Create `frontend/src/features/auth-signup/model/schema.ts`:

```ts
import { z } from "zod"

export const signupSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
})

export type SignupValues = z.infer<typeof signupSchema>
```

- [ ] **Step 2: Write the failing SignupForm tests**

Create `frontend/src/features/auth-signup/ui/SignupForm.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { MemoryRouter } from "react-router"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { SignupForm } from "./SignupForm"

const mutateAsync = vi.hoisted(() => vi.fn())
vi.mock("@/entities/user", () => ({
  useSignupMutation: () => ({ mutateAsync, isPending: false }),
}))
vi.mock("@/entities/cart", () => ({
  useGuestCartStore: { getState: () => ({ items: [], clear: () => {} }) },
  useMergeCartMutation: () => ({ mutateAsync: vi.fn() }),
}))

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

describe("SignupForm", () => {
  beforeEach(() => mutateAsync.mockReset())

  it("rejects weak password client-side", async () => {
    render(<SignupForm />, { wrapper })
    await userEvent.type(screen.getByLabelText(/email/i), "a@b.com")
    await userEvent.type(screen.getByLabelText(/password/i), "short")
    await userEvent.click(screen.getByRole("button", { name: /sign up/i }))
    expect(await screen.findByText(/at least 8 characters/i)).toBeInTheDocument()
    expect(mutateAsync).not.toHaveBeenCalled()
  })

  it("submits valid values", async () => {
    mutateAsync.mockResolvedValue({
      id: "u1",
      email: "a@b.com",
      createdAt: "2026-04-18T00:00:00Z",
      updatedAt: "2026-04-18T00:00:00Z",
    })
    render(<SignupForm />, { wrapper })
    await userEvent.type(screen.getByLabelText(/email/i), "a@b.com")
    await userEvent.type(screen.getByLabelText(/password/i), "hunter2!!")
    await userEvent.click(screen.getByRole("button", { name: /sign up/i }))
    expect(mutateAsync).toHaveBeenCalledWith({ email: "a@b.com", password: "hunter2!!" })
  })

  it("surfaces server conflict error", async () => {
    mutateAsync.mockRejectedValue(new Error("email already registered"))
    render(<SignupForm />, { wrapper })
    await userEvent.type(screen.getByLabelText(/email/i), "a@b.com")
    await userEvent.type(screen.getByLabelText(/password/i), "hunter2!!")
    await userEvent.click(screen.getByRole("button", { name: /sign up/i }))
    expect(await screen.findByText(/already registered/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Write the SignupForm component**

Create `frontend/src/features/auth-signup/ui/SignupForm.tsx`:

```tsx
import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { Link, useNavigate } from "react-router"
import { useGuestCartStore, useMergeCartMutation } from "@/entities/cart"
import { useSignupMutation } from "@/entities/user"
import { Button } from "@/shared/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/ui/form"
import { Input } from "@/shared/ui/input"
import { signupSchema, type SignupValues } from "../model/schema"

export function SignupForm() {
  const navigate = useNavigate()
  const signup = useSignupMutation()
  const merge = useMergeCartMutation()
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { email: "", password: "" },
  })

  async function onSubmit(values: SignupValues) {
    setServerError(null)
    try {
      await signup.mutateAsync(values)
      const guest = useGuestCartStore.getState()
      if (guest.items.length > 0) {
        await merge.mutateAsync(
          guest.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        )
        guest.clear()
      }
      navigate("/")
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Signup failed")
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" autoComplete="email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="new-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {serverError && (
          <p role="alert" className="text-sm text-destructive">
            {serverError}
          </p>
        )}
        <Button type="submit" disabled={signup.isPending}>
          {signup.isPending ? "Creating account…" : "Sign up"}
        </Button>
        <p className="text-sm">
          Already have an account? <Link to="/login" className="underline">Log in</Link>
        </p>
      </form>
    </Form>
  )
}
```

- [ ] **Step 4: Write the barrel**

Create `frontend/src/features/auth-signup/index.ts`:

```ts
export { SignupForm } from "./ui/SignupForm"
```

- [ ] **Step 5: Run tests**

```bash
cd frontend
bun run test src/features/auth-signup
```

Expected: 3/3 pass.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/auth-signup/
git commit -m "feat(frontend): add auth-signup feature with zod client-side validation"
```

---

## Task 8 — `features/auth-logout` slice

**Files:**
- Create: `frontend/src/features/auth-logout/ui/LogoutButton.tsx`
- Create: `frontend/src/features/auth-logout/ui/LogoutButton.test.tsx`
- Create: `frontend/src/features/auth-logout/index.ts`

---

- [ ] **Step 1: Write the LogoutButton tests**

Create `frontend/src/features/auth-logout/ui/LogoutButton.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { MemoryRouter } from "react-router"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { LogoutButton } from "./LogoutButton"

const mutateAsync = vi.hoisted(() => vi.fn())
vi.mock("@/entities/user", () => ({
  useLogoutMutation: () => ({ mutateAsync, isPending: false }),
}))

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

describe("LogoutButton", () => {
  beforeEach(() => mutateAsync.mockReset())

  it("calls logout mutation on click", async () => {
    mutateAsync.mockResolvedValue(undefined)
    render(<LogoutButton />, { wrapper })
    await userEvent.click(screen.getByRole("button", { name: /log out/i }))
    expect(mutateAsync).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Write the LogoutButton component**

Create `frontend/src/features/auth-logout/ui/LogoutButton.tsx`:

```tsx
import { useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "react-router"
import { cartKeys, useGuestCartStore } from "@/entities/cart"
import { useLogoutMutation } from "@/entities/user"
import { Button } from "@/shared/ui/button"

export function LogoutButton() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const logout = useLogoutMutation()

  async function handleClick() {
    try {
      await logout.mutateAsync()
    } finally {
      // Even if the server call errored we still want the client to
      // reflect a logged-out state.
      qc.removeQueries({ queryKey: cartKeys.server() })
      useGuestCartStore.getState().clear()
      navigate("/")
    }
  }

  return (
    <Button variant="outline" onClick={handleClick} disabled={logout.isPending}>
      {logout.isPending ? "Logging out…" : "Log out"}
    </Button>
  )
}
```

- [ ] **Step 3: Write the barrel**

Create `frontend/src/features/auth-logout/index.ts`:

```ts
export { LogoutButton } from "./ui/LogoutButton"
```

- [ ] **Step 4: Run tests + typecheck + lint**

```bash
cd frontend
bun run test src/features/auth-logout
bun run typecheck
```

Expected: 1/1 pass, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/auth-logout/
git commit -m "feat(frontend): add auth-logout feature"
```

---

## Task 9 — `features/cart-actions` slice (AddToCartButton + QuantityStepper)

**Files:**
- Create: `frontend/src/features/cart-actions/ui/AddToCartButton.tsx`
- Create: `frontend/src/features/cart-actions/ui/AddToCartButton.test.tsx`
- Create: `frontend/src/features/cart-actions/ui/QuantityStepper.tsx`
- Create: `frontend/src/features/cart-actions/ui/QuantityStepper.test.tsx`
- Create: `frontend/src/features/cart-actions/index.ts`

---

- [ ] **Step 1: Write the AddToCartButton tests**

Create `frontend/src/features/cart-actions/ui/AddToCartButton.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { MemoryRouter } from "react-router"
import { describe, expect, it, vi } from "vitest"
import { AddToCartButton } from "./AddToCartButton"

const addFn = vi.hoisted(() => vi.fn())
const toastSuccess = vi.hoisted(() => vi.fn())

vi.mock("@/entities/cart", () => ({
  useCart: () => ({ add: addFn }),
}))
vi.mock("sonner", () => ({
  toast: { success: toastSuccess },
}))

function wrapper({ children }: { children: ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>
}

describe("AddToCartButton", () => {
  it("is disabled when out of stock", () => {
    render(
      <AddToCartButton
        product={{
          id: "p1",
          name: "X-Wing",
          priceCents: 100,
          stockQuantity: 0,
        }}
      />,
      { wrapper },
    )
    const btn = screen.getByRole("button")
    expect(btn).toBeDisabled()
    expect(btn).toHaveTextContent(/out of stock/i)
  })

  it("calls cart.add + fires toast on click", async () => {
    addFn.mockResolvedValue(undefined)
    render(
      <AddToCartButton
        product={{
          id: "p1",
          name: "X-Wing",
          priceCents: 100,
          stockQuantity: 5,
        }}
      />,
      { wrapper },
    )
    await userEvent.click(screen.getByRole("button", { name: /add to cart/i }))
    expect(addFn).toHaveBeenCalledWith({
      productId: "p1",
      name: "X-Wing",
      priceCents: 100,
      imageUrl: undefined,
      stockQuantity: 5,
      quantity: 1,
    })
    expect(toastSuccess).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Write the AddToCartButton component**

Create `frontend/src/features/cart-actions/ui/AddToCartButton.tsx`:

```tsx
import { useNavigate } from "react-router"
import { toast } from "sonner"
import { useCart } from "@/entities/cart"
import { Button } from "@/shared/ui/button"

interface AddToCartButtonProps {
  product: {
    id: string
    name: string
    priceCents: number
    imageUrl?: string | null
    stockQuantity: number
  }
}

export function AddToCartButton({ product }: AddToCartButtonProps) {
  const cart = useCart()
  const navigate = useNavigate()
  const outOfStock = product.stockQuantity <= 0

  async function handleClick() {
    await cart.add({
      productId: product.id,
      name: product.name,
      priceCents: product.priceCents,
      imageUrl: product.imageUrl ?? undefined,
      stockQuantity: product.stockQuantity,
      quantity: 1,
    })
    toast.success(`${product.name} added to cart`, {
      action: {
        label: "View cart",
        onClick: () => navigate("/cart"),
      },
    })
  }

  return (
    <Button onClick={handleClick} disabled={outOfStock}>
      {outOfStock ? "Out of stock" : "Add to cart"}
    </Button>
  )
}
```

- [ ] **Step 3: Write the QuantityStepper tests**

Create `frontend/src/features/cart-actions/ui/QuantityStepper.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { QuantityStepper } from "./QuantityStepper"

describe("QuantityStepper", () => {
  it("calls onChange(+1) when + is clicked and not at stock ceiling", async () => {
    const onChange = vi.fn()
    render(<QuantityStepper quantity={2} stockQuantity={5} onChange={onChange} />)
    await userEvent.click(screen.getByRole("button", { name: /increase/i }))
    expect(onChange).toHaveBeenCalledWith(3)
  })

  it("disables + at the stock ceiling", () => {
    render(<QuantityStepper quantity={5} stockQuantity={5} onChange={() => {}} />)
    expect(screen.getByRole("button", { name: /increase/i })).toBeDisabled()
  })

  it("calls onChange(-1) when - is clicked", async () => {
    const onChange = vi.fn()
    render(<QuantityStepper quantity={3} stockQuantity={5} onChange={onChange} />)
    await userEvent.click(screen.getByRole("button", { name: /decrease/i }))
    expect(onChange).toHaveBeenCalledWith(2)
  })

  it("onChange(0) when decrementing from 1 (parent treats 0 as remove)", async () => {
    const onChange = vi.fn()
    render(<QuantityStepper quantity={1} stockQuantity={5} onChange={onChange} />)
    await userEvent.click(screen.getByRole("button", { name: /decrease/i }))
    expect(onChange).toHaveBeenCalledWith(0)
  })
})
```

- [ ] **Step 4: Write the QuantityStepper component**

Create `frontend/src/features/cart-actions/ui/QuantityStepper.tsx`:

```tsx
import { Button } from "@/shared/ui/button"

interface QuantityStepperProps {
  quantity: number
  stockQuantity: number
  onChange: (nextQuantity: number) => void
}

export function QuantityStepper({ quantity, stockQuantity, onChange }: QuantityStepperProps) {
  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label="Decrease quantity"
        onClick={() => onChange(quantity - 1)}
      >
        −
      </Button>
      <span aria-live="polite" className="min-w-6 text-center text-sm">
        {quantity}
      </span>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label="Increase quantity"
        disabled={quantity >= stockQuantity}
        onClick={() => onChange(quantity + 1)}
      >
        +
      </Button>
    </div>
  )
}
```

- [ ] **Step 5: Write the barrel**

Create `frontend/src/features/cart-actions/index.ts`:

```ts
export { AddToCartButton } from "./ui/AddToCartButton"
export { QuantityStepper } from "./ui/QuantityStepper"
```

- [ ] **Step 6: Run tests**

```bash
cd frontend
bun run test src/features/cart-actions
```

Expected: 6/6 pass.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/cart-actions/
git commit -m "feat(frontend): add cart-actions feature (AddToCartButton + QuantityStepper)"
```

---

## Task 10 — `widgets/site-header` + `widgets/cart-line`

**Files:**
- Create: `frontend/src/widgets/site-header/SiteHeader.tsx`
- Create: `frontend/src/widgets/site-header/SiteHeader.test.tsx`
- Create: `frontend/src/widgets/site-header/index.ts`
- Create: `frontend/src/widgets/cart-line/CartLine.tsx`
- Create: `frontend/src/widgets/cart-line/CartLine.test.tsx`
- Create: `frontend/src/widgets/cart-line/index.ts`

---

- [ ] **Step 1: Write the SiteHeader tests**

Create `frontend/src/widgets/site-header/SiteHeader.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { MemoryRouter } from "react-router"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { SiteHeader } from "./SiteHeader"

const mockUseAuth = vi.hoisted(() => vi.fn())
const mockUseCart = vi.hoisted(() => vi.fn())

vi.mock("@/entities/user", () => ({ useAuth: mockUseAuth }))
vi.mock("@/entities/cart", () => ({ useCart: mockUseCart }))
vi.mock("@/features/auth-logout", () => ({
  LogoutButton: () => <button type="button">Log out</button>,
}))

function wrapper({ children }: { children: ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>
}

describe("SiteHeader", () => {
  beforeEach(() => {
    mockUseAuth.mockReset()
    mockUseCart.mockReset()
    mockUseCart.mockReturnValue({ items: [] })
  })

  it("shows Log in / Sign up links when logged out", () => {
    mockUseAuth.mockReturnValue({ isLoading: false, isSuccess: false, isError: true, data: undefined })
    render(<SiteHeader />, { wrapper })
    expect(screen.getByRole("link", { name: /log in/i })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /sign up/i })).toBeInTheDocument()
  })

  it("shows the cart count badge with total quantity", () => {
    mockUseAuth.mockReturnValue({ isLoading: false, isSuccess: false, isError: true, data: undefined })
    mockUseCart.mockReturnValue({
      items: [
        { productId: "a", name: "A", priceCents: 1, quantity: 2, stockQuantity: 5, imageUrl: null },
        { productId: "b", name: "B", priceCents: 1, quantity: 3, stockQuantity: 5, imageUrl: null },
      ],
    })
    render(<SiteHeader />, { wrapper })
    expect(screen.getByText("5")).toBeInTheDocument()
  })

  it("shows the user email and account link when authenticated", () => {
    mockUseAuth.mockReturnValue({
      isLoading: false,
      isSuccess: true,
      isError: false,
      data: { id: "u1", email: "a@b.com", createdAt: "2026-04-18T00:00:00Z", updatedAt: "2026-04-18T00:00:00Z" },
    })
    render(<SiteHeader />, { wrapper })
    expect(screen.getByText(/a@b\.com/)).toBeInTheDocument()
  })

  it("renders a skeleton while auth is loading", () => {
    mockUseAuth.mockReturnValue({ isLoading: true, isSuccess: false, isError: false, data: undefined })
    render(<SiteHeader />, { wrapper })
    expect(screen.getByTestId("site-header-auth-skeleton")).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Write the SiteHeader widget**

Create `frontend/src/widgets/site-header/SiteHeader.tsx`:

```tsx
import { Link } from "react-router"
import { useCart } from "@/entities/cart"
import { useAuth } from "@/entities/user"
import { LogoutButton } from "@/features/auth-logout"
import { Badge } from "@/shared/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu"
import { Skeleton } from "@/shared/ui/skeleton"

export function SiteHeader() {
  const auth = useAuth()
  const cart = useCart()
  const cartCount = cart.items.reduce((sum, i) => sum + i.quantity, 0)

  return (
    <header className="flex items-center justify-between gap-4 border-b px-6 py-4">
      <nav className="flex items-center gap-6">
        <Link to="/" className="font-semibold">
          Spacecraft Store
        </Link>
        <Link to="/products">Catalog</Link>
      </nav>
      <div className="flex items-center gap-4">
        <Link to="/cart" aria-label="Cart" className="flex items-center gap-2">
          <span>Cart</span>
          {cartCount > 0 && <Badge>{cartCount}</Badge>}
        </Link>
        {auth.isLoading ? (
          <Skeleton data-testid="site-header-auth-skeleton" className="h-9 w-20" />
        ) : auth.isSuccess ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="text-sm">
                {auth.data.email}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{auth.data.email}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/account">Account</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <LogoutButton />
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div className="flex items-center gap-3 text-sm">
            <Link to="/login">Log in</Link>
            <Link to="/signup">Sign up</Link>
          </div>
        )}
      </div>
    </header>
  )
}
```

- [ ] **Step 3: Write the barrel**

Create `frontend/src/widgets/site-header/index.ts`:

```ts
export { SiteHeader } from "./SiteHeader"
```

- [ ] **Step 4: Write the CartLine tests**

Create `frontend/src/widgets/cart-line/CartLine.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { CartLine } from "./CartLine"

const item = {
  productId: "p1",
  name: "X-Wing",
  priceCents: 12500000,
  imageUrl: null,
  quantity: 2,
  stockQuantity: 5,
}

describe("CartLine", () => {
  it("renders name, price, and quantity", () => {
    render(<CartLine item={item} onSet={() => {}} onRemove={() => {}} />)
    expect(screen.getByText("X-Wing")).toBeInTheDocument()
    expect(screen.getByText("$125,000.00")).toBeInTheDocument()
    expect(screen.getByText("2")).toBeInTheDocument()
  })

  it("calls onSet when the stepper fires", async () => {
    const onSet = vi.fn()
    render(<CartLine item={item} onSet={onSet} onRemove={() => {}} />)
    await userEvent.click(screen.getByRole("button", { name: /increase/i }))
    expect(onSet).toHaveBeenCalledWith("p1", 3)
  })

  it("calls onRemove from the remove button", async () => {
    const onRemove = vi.fn()
    render(<CartLine item={item} onSet={() => {}} onRemove={onRemove} />)
    await userEvent.click(screen.getByRole("button", { name: /remove/i }))
    expect(onRemove).toHaveBeenCalledWith("p1")
  })
})
```

- [ ] **Step 5: Write the CartLine widget**

Create `frontend/src/widgets/cart-line/CartLine.tsx`:

```tsx
import type { CartItem } from "@/entities/cart"
import { QuantityStepper } from "@/features/cart-actions"
import { formatPrice } from "@/shared/lib/format-price"
import { Button } from "@/shared/ui/button"

interface CartLineProps {
  item: CartItem
  onSet: (productId: string, quantity: number) => void
  onRemove: (productId: string) => void
}

export function CartLine({ item, onSet, onRemove }: CartLineProps) {
  return (
    <div className="flex items-center gap-4 border-b py-4">
      {item.imageUrl ? (
        <img src={item.imageUrl} alt={item.name} className="size-16 object-cover" />
      ) : (
        <div className="size-16" />
      )}
      <div className="flex-1">
        <p>{item.name}</p>
        <p className="text-sm">{formatPrice(item.priceCents)}</p>
      </div>
      <QuantityStepper
        quantity={item.quantity}
        stockQuantity={item.stockQuantity}
        onChange={(q) => onSet(item.productId, q)}
      />
      <Button variant="ghost" size="sm" onClick={() => onRemove(item.productId)}>
        Remove
      </Button>
    </div>
  )
}
```

- [ ] **Step 6: Write the barrel**

Create `frontend/src/widgets/cart-line/index.ts`:

```ts
export { CartLine } from "./CartLine"
```

- [ ] **Step 7: Run tests**

```bash
cd frontend
bun run test src/widgets/site-header src/widgets/cart-line
```

Expected: 7/7 pass.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/widgets/site-header/ frontend/src/widgets/cart-line/
git commit -m "feat(frontend): add site-header + cart-line widgets"
```

---

## Task 11 — Pages: login, signup, account, cart + route wiring + ProductDetail update

**Files:**
- Create: `frontend/src/pages/login/ui/LoginPage.tsx`, `LoginPage.test.tsx`, `frontend/src/pages/login/index.ts`
- Create: `frontend/src/pages/signup/ui/SignupPage.tsx`, `SignupPage.test.tsx`, `frontend/src/pages/signup/index.ts`
- Create: `frontend/src/pages/account/ui/AccountPage.tsx`, `AccountPage.test.tsx`, `frontend/src/pages/account/index.ts`
- Create: `frontend/src/pages/cart/ui/CartPage.tsx`, `CartPage.test.tsx`, `frontend/src/pages/cart/index.ts`
- Create: `frontend/src/shared/lib/require-auth.tsx`
- Modify: `frontend/src/pages/product-detail/ui/ProductDetailPage.tsx`
- Modify: `frontend/src/pages/product-detail/ui/ProductDetailPage.test.tsx`
- Modify: `frontend/src/app/providers/router/routes.tsx`

---

- [ ] **Step 1: Write the RequireAuth helper**

Create `frontend/src/shared/lib/require-auth.tsx`:

```tsx
import type { ReactNode } from "react"
import { Navigate } from "react-router"
import { useAuth } from "@/entities/user"
import { Skeleton } from "@/shared/ui/skeleton"

// RequireAuth renders its children only when the user is authenticated.
// Loading renders a skeleton; 401 redirects to /login preserving no state.
export function RequireAuth({ children }: { children: ReactNode }) {
  const auth = useAuth()
  if (auth.isLoading) {
    return <Skeleton className="h-8 w-40 m-8" />
  }
  if (auth.isError || !auth.data) {
    return <Navigate to="/login" replace />
  }
  return <>{children}</>
}
```

- [ ] **Step 2: Write the LoginPage**

Create `frontend/src/pages/login/ui/LoginPage.tsx`:

```tsx
import { LoginForm } from "@/features/auth-login"

export function LoginPage() {
  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 p-8">
      <h1>Log in</h1>
      <LoginForm />
    </main>
  )
}
```

Create `frontend/src/pages/login/ui/LoginPage.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { MemoryRouter } from "react-router"
import { describe, expect, it, vi } from "vitest"
import { LoginPage } from "./LoginPage"

vi.mock("@/entities/user", () => ({
  useLoginMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))
vi.mock("@/entities/cart", () => ({
  useGuestCartStore: { getState: () => ({ items: [], clear: () => {} }) },
  useMergeCartMutation: () => ({ mutateAsync: vi.fn() }),
}))

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

describe("LoginPage", () => {
  it("mounts the heading and form", () => {
    render(<LoginPage />, { wrapper })
    expect(screen.getByRole("heading", { name: /log in/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
  })
})
```

Create `frontend/src/pages/login/index.ts`:

```ts
export { LoginPage } from "./ui/LoginPage"
```

- [ ] **Step 3: Write the SignupPage**

Create `frontend/src/pages/signup/ui/SignupPage.tsx`:

```tsx
import { SignupForm } from "@/features/auth-signup"

export function SignupPage() {
  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 p-8">
      <h1>Sign up</h1>
      <SignupForm />
    </main>
  )
}
```

Create `frontend/src/pages/signup/ui/SignupPage.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { MemoryRouter } from "react-router"
import { describe, expect, it, vi } from "vitest"
import { SignupPage } from "./SignupPage"

vi.mock("@/entities/user", () => ({
  useSignupMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))
vi.mock("@/entities/cart", () => ({
  useGuestCartStore: { getState: () => ({ items: [], clear: () => {} }) },
  useMergeCartMutation: () => ({ mutateAsync: vi.fn() }),
}))

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

describe("SignupPage", () => {
  it("mounts the heading and form", () => {
    render(<SignupPage />, { wrapper })
    expect(screen.getByRole("heading", { name: /sign up/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
  })
})
```

Create `frontend/src/pages/signup/index.ts`:

```ts
export { SignupPage } from "./ui/SignupPage"
```

- [ ] **Step 4: Write the AccountPage**

Create `frontend/src/pages/account/ui/AccountPage.tsx`:

```tsx
import { useAuth } from "@/entities/user"
import { LogoutButton } from "@/features/auth-logout"
import { RequireAuth } from "@/shared/lib/require-auth"
import { Separator } from "@/shared/ui/separator"

function AccountContent() {
  const auth = useAuth()
  if (!auth.data) return null

  const joined = new Date(auth.data.createdAt).toLocaleDateString()
  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 p-8">
      <h1>Account</h1>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
        <dt>Email</dt>
        <dd>{auth.data.email}</dd>
        <dt>Member since</dt>
        <dd>{joined}</dd>
      </dl>
      <Separator />
      <LogoutButton />
    </main>
  )
}

export function AccountPage() {
  return (
    <RequireAuth>
      <AccountContent />
    </RequireAuth>
  )
}
```

Create `frontend/src/pages/account/ui/AccountPage.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { MemoryRouter, Route, Routes } from "react-router"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { AccountPage } from "./AccountPage"

const mockUseAuth = vi.hoisted(() => vi.fn())
vi.mock("@/entities/user", () => ({
  useAuth: mockUseAuth,
  useLogoutMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))
vi.mock("@/entities/cart", () => ({
  cartKeys: { server: () => ["cart", "server"] },
  useGuestCartStore: { getState: () => ({ clear: () => {} }) },
}))

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/account"]}>
        <Routes>
          <Route path="/login" element={<div data-testid="login-redirect" />} />
          <Route path="/account" element={children} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe("AccountPage", () => {
  beforeEach(() => mockUseAuth.mockReset())

  it("redirects to /login when 401", () => {
    mockUseAuth.mockReturnValue({ isLoading: false, isError: true, isSuccess: false, data: undefined })
    render(<AccountPage />, { wrapper })
    expect(screen.getByTestId("login-redirect")).toBeInTheDocument()
  })

  it("renders email and join date when authed", () => {
    mockUseAuth.mockReturnValue({
      isLoading: false,
      isError: false,
      isSuccess: true,
      data: { id: "u1", email: "a@b.com", createdAt: "2026-04-18T00:00:00Z", updatedAt: "2026-04-18T00:00:00Z" },
    })
    render(<AccountPage />, { wrapper })
    expect(screen.getByRole("heading", { name: /account/i })).toBeInTheDocument()
    expect(screen.getByText("a@b.com")).toBeInTheDocument()
  })
})
```

Create `frontend/src/pages/account/index.ts`:

```ts
export { AccountPage } from "./ui/AccountPage"
```

- [ ] **Step 5: Write the CartPage**

Create `frontend/src/pages/cart/ui/CartPage.tsx`:

```tsx
import { Link } from "react-router"
import { useCart } from "@/entities/cart"
import { CartLine } from "@/widgets/cart-line"
import { formatPrice } from "@/shared/lib/format-price"
import { Button } from "@/shared/ui/button"
import { Separator } from "@/shared/ui/separator"

export function CartPage() {
  const cart = useCart()

  if (cart.isLoading) {
    return <main className="p-8" data-testid="cart-loading">Loading cart…</main>
  }

  if (cart.items.length === 0) {
    return (
      <main className="mx-auto flex max-w-2xl flex-col gap-4 p-8">
        <h1>Your cart is empty</h1>
        <Link to="/products" className="underline">Browse catalog</Link>
      </main>
    )
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-8">
      <h1>Your cart</h1>
      <div>
        {cart.items.map((item) => (
          <CartLine
            key={item.productId}
            item={item}
            onSet={(id, q) => void cart.set(id, q)}
            onRemove={(id) => void cart.remove(id)}
          />
        ))}
      </div>
      <Separator />
      <div className="flex items-center justify-between">
        <p>Subtotal</p>
        <p>{formatPrice(cart.subtotalCents)}</p>
      </div>
      <Button disabled>Checkout (coming Phase 3)</Button>
    </main>
  )
}
```

Create `frontend/src/pages/cart/ui/CartPage.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { MemoryRouter } from "react-router"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { CartPage } from "./CartPage"

const mockUseCart = vi.hoisted(() => vi.fn())
vi.mock("@/entities/cart", () => ({ useCart: mockUseCart }))

function wrapper({ children }: { children: ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>
}

describe("CartPage", () => {
  beforeEach(() => mockUseCart.mockReset())

  it("shows empty-state link when items is empty", () => {
    mockUseCart.mockReturnValue({
      items: [],
      subtotalCents: 0,
      isLoading: false,
      add: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
    })
    render(<CartPage />, { wrapper })
    expect(screen.getByRole("heading", { name: /empty/i })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /browse catalog/i })).toBeInTheDocument()
  })

  it("renders items + subtotal when populated", () => {
    mockUseCart.mockReturnValue({
      items: [
        {
          productId: "p1",
          name: "X-Wing",
          priceCents: 100,
          imageUrl: null,
          quantity: 2,
          stockQuantity: 5,
        },
      ],
      subtotalCents: 200,
      isLoading: false,
      add: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
    })
    render(<CartPage />, { wrapper })
    expect(screen.getByText("X-Wing")).toBeInTheDocument()
    expect(screen.getByText("$2.00")).toBeInTheDocument()
  })

  it("checkout button is disabled", () => {
    mockUseCart.mockReturnValue({
      items: [
        {
          productId: "p1",
          name: "X-Wing",
          priceCents: 100,
          imageUrl: null,
          quantity: 1,
          stockQuantity: 5,
        },
      ],
      subtotalCents: 100,
      isLoading: false,
      add: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
    })
    render(<CartPage />, { wrapper })
    expect(screen.getByRole("button", { name: /checkout/i })).toBeDisabled()
  })
})
```

Create `frontend/src/pages/cart/index.ts`:

```ts
export { CartPage } from "./ui/CartPage"
```

- [ ] **Step 6: Update ProductDetailPage to render AddToCartButton**

Modify `frontend/src/pages/product-detail/ui/ProductDetailPage.tsx`. Replace the body (keeping the existing loading/error branches unchanged) with a version that mounts `AddToCartButton` below the description:

```tsx
import { Link, useParams } from "react-router"
import { StockBadge, useProduct } from "@/entities/product"
import { AddToCartButton } from "@/features/cart-actions"
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
            <img src={data.imageUrl} alt={data.name} className="h-full w-full object-cover" />
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
          <AddToCartButton
            product={{
              id: data.id,
              name: data.name,
              priceCents: data.priceCents,
              imageUrl: data.imageUrl,
              stockQuantity: data.stockQuantity,
            }}
          />
        </div>
      </div>
    </main>
  )
}
```

Update `frontend/src/pages/product-detail/ui/ProductDetailPage.test.tsx` — add a mock for the cart facade so the new `AddToCartButton` doesn't hit real stores. At the top of the file (after the existing imports), insert:

```tsx
vi.mock("@/entities/cart", () => ({
  useCart: () => ({ add: vi.fn() }),
}))
```

Place this before the `vi.mock("@/entities/product", ...)` block. No other existing assertions change — the new button renders and is simply ignored by the existing `screen.getByText(...)` assertions.

- [ ] **Step 7: Update router with the four new routes**

Modify `frontend/src/app/providers/router/routes.tsx` to add the four pages:

```tsx
import type { RouteObject } from "react-router"
import { App } from "@/app/App"
import { AccountPage } from "@/pages/account"
import { CartPage } from "@/pages/cart"
import { CatalogPage } from "@/pages/catalog"
import { HomePage } from "@/pages/home"
import { LoginPage } from "@/pages/login"
import { ProductDetailPage } from "@/pages/product-detail"
import { SignupPage } from "@/pages/signup"

export const routes: RouteObject[] = [
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "products", element: <CatalogPage /> },
      { path: "products/:id", element: <ProductDetailPage /> },
      { path: "cart", element: <CartPage /> },
      { path: "login", element: <LoginPage /> },
      { path: "signup", element: <SignupPage /> },
      { path: "account", element: <AccountPage /> },
    ],
  },
]
```

- [ ] **Step 8: Run the full test suite**

```bash
cd frontend
bun run test
bun run typecheck
bun run lint
```

Expected: all tests green (existing + new), typecheck clean, Biome happy, Steiger happy — except possibly `fsd/no-segmentless-slices` on pages/widgets, which is already suppressed in `steiger.config.ts` for the existing phases. If Steiger flags any NEW path, widen the existing suppression block rather than adding new ones (Task 12 reviews all Steiger output).

- [ ] **Step 9: Commit**

```bash
git add frontend/src/pages/login/ frontend/src/pages/signup/ frontend/src/pages/account/ frontend/src/pages/cart/ frontend/src/pages/product-detail/ui/ProductDetailPage.tsx frontend/src/pages/product-detail/ui/ProductDetailPage.test.tsx frontend/src/shared/lib/require-auth.tsx frontend/src/app/providers/router/routes.tsx
git commit -m "feat(frontend): add login/signup/account/cart pages + AddToCartButton on product detail"
```

---

## Task 12 — App shell (header + toaster), Steiger review, PR, CI, merge, Vercel verify

**Files:**
- Modify: `frontend/src/app/App.tsx`
- Modify: `frontend/steiger.config.ts` (only if needed)

---

- [ ] **Step 1: Wire SiteHeader + Toaster into the app shell**

Modify `frontend/src/app/App.tsx`:

```tsx
import { Outlet } from "react-router"
import { Toaster } from "@/shared/ui/sonner"
import { SiteHeader } from "@/widgets/site-header"

export function App() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <Outlet />
      <Toaster />
    </div>
  )
}
```

- [ ] **Step 2: Run the full local verification**

```bash
cd frontend
bun run typecheck
bun run lint
bun run test
bun run build
```

Expected: all green. The production build must succeed — this catches any prop-type mismatch that vitest's jsdom environment masked.

- [ ] **Step 3: Update Steiger config if any new slice is flagged**

Run:

```bash
cd frontend
bunx steiger src
```

Read the report. If new slices are flagged by:

- `fsd/no-segmentless-slices` — extend the existing glob in `steiger.config.ts` rather than creating a new rule block.
- `fsd/public-api` — add the missing `index.ts` re-export rather than suppressing.
- `fsd/repetitive-naming` — narrow glob, document rationale inline.

Only add a suppression when the alternative is a structural refactor that serves no goal. Document every suppression with a comment block explaining WHY, matching the existing style in `steiger.config.ts`.

- [ ] **Step 4: Smoke-test locally against the deployed backend**

```bash
cd frontend
bun run dev
```

Then in a browser at `http://localhost:5173`:

1. Sign up with a fresh email — should land on `/` and the site header should show the email dropdown.
2. Log out — header reverts to Log in / Sign up links.
3. Log back in — header flips back to authenticated state.
4. Navigate to a product, click "Add to cart" while logged out — toast fires, guest cart populates (check `localStorage.getItem("guest-cart")`).
5. Sign up again with a different fresh email — the guest items merge into the server cart (check `/api/cart` via DevTools Network tab).
6. Visit `/cart` — see items, +/- works, remove works, subtotal updates.
7. Visit `/account` while logged out — redirects to `/login`.

If any of the above fails, stop and fix before pushing.

- [ ] **Step 5: Commit the app-shell wiring + any Steiger tweaks**

```bash
git add frontend/src/app/App.tsx frontend/steiger.config.ts
git commit -m "feat(frontend): wire SiteHeader + Sonner toaster into app shell"
```

- [ ] **Step 6: Push the branch**

```bash
cd /home/z3tz3r0/Projects/ecommerce-space-craft
git push -u origin phase-2b/identity-cart-frontend
```

- [ ] **Step 7: Open the PR**

```bash
gh pr create --title "phase 2b — identity & cart frontend" --body "$(cat <<'EOF'
## Summary

Ship Phase 2b per [docs/superpowers/specs/2026-04-18-phase-2-identity-cart-design.md](docs/superpowers/specs/2026-04-18-phase-2-identity-cart-design.md).

- **New entities**: `entities/user` (useAuth + mutations) and `entities/cart` (server query + mutations + zustand guest store + cart-facade routing).
- **New features**: `auth-login`, `auth-signup`, `auth-logout`, `cart-actions` (AddToCartButton + QuantityStepper) with react-hook-form + zod validation.
- **New widgets**: `site-header` (auth-aware nav + cart count badge) and `cart-line`.
- **New pages**: `/login`, `/signup`, `/account` (RequireAuth-gated), `/cart` (public, shows guest or server cart).
- **Merge-on-login**: login and signup mutations POST guest items to `/api/cart/merge`, clear the zustand store, invalidate queries.
- **Layout-only Tailwind**: no color/typography/motion utilities introduced — shadcn primitive defaults only (Phase 4 handles styling).

## Test plan

- [ ] `bun run test` green locally (full suite)
- [ ] `bun run typecheck` clean
- [ ] `bun run lint` (Biome + Steiger) clean
- [ ] `bun run build` succeeds
- [ ] Browser smoke: signup flow, guest-cart → merge on login, logout, /account redirect, cart +/− controls
- [ ] CI lint + test + build jobs green
- [ ] Vercel auto-deploy succeeds
- [ ] Production browser smoke: the same walkthrough on `https://ecommerce-space-craft.vercel.app/`

EOF
)"
```

- [ ] **Step 8: Watch CI**

```bash
gh pr checks --watch
```

Expected: `lint`, `test`, `build` all pass.

- [ ] **Step 9: Merge**

After CI is green:

```bash
gh pr merge --squash --delete-branch
```

- [ ] **Step 10: Verify Vercel deploys**

Vercel watches `main` and redeploys on push. Check the deploy status via:

```bash
gh run list --limit 3
```

Or visit the Vercel dashboard. Allow ~1-2 minutes.

- [ ] **Step 11: Production browser smoke test**

Walk through the complete flow on `https://ecommerce-space-craft.vercel.app/`:

1. Visit `/` — site header renders with Log in / Sign up.
2. Open DevTools → Application → Local Storage → clear `guest-cart` if set.
3. Visit a product detail page, click **Add to cart**. Confirm toast fires and the header cart badge shows `1`.
4. Visit `/cart` — see one item, +/- works.
5. Visit `/signup` — sign up with a fresh email. Confirm header now shows the email dropdown.
6. Visit `/cart` — the item from step 3 is still there (merge worked).
7. Click the email dropdown → **Account** — `/account` renders with email + member-since + Log out.
8. Click **Log out** — redirected, header reverts to logged-out state.
9. Visit `/account` while logged out — redirects to `/login`.
10. Log in with the account from step 5 — header flips back to authenticated.

- [ ] **Step 12: Report back**

Once the production smoke test passes, report to the user that Phase 2 is shipped end-to-end. Update `memory/phase_status.md` with the Phase 2 completion note (separate memory update, not part of this plan).

---

**End of Plan 2b.**
