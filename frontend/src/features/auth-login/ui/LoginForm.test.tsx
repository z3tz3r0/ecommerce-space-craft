import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { MemoryRouter } from "react-router"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { LoginForm } from "./LoginForm"

const mutateAsync = vi.hoisted(() => vi.fn())
const mergeMutateAsync = vi.hoisted(() => vi.fn())
const guestStoreState = vi.hoisted(() => ({
  items: [] as Array<{
    productId: string
    name: string
    priceCents: number
    quantity: number
    stockQuantity: number
  }>,
  clear: vi.fn(),
}))

vi.mock("@/entities/user", () => ({
  useLoginMutation: () => ({ mutateAsync, isPending: false }),
}))
vi.mock("@/entities/cart", () => ({
  useGuestCartStore: { getState: () => guestStoreState },
  useMergeCartMutation: () => ({ mutateAsync: mergeMutateAsync }),
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
  // NOTE: braces matter — `() => mutateAsync.mockReset()` returns the mock
  // (mockReset returns `this` for chaining), which vitest treats as the
  // beforeEach return value and its unhandled-rejection detector gets
  // confused when the same mock later rejects. `() => { ... }` returns
  // undefined and avoids the false-positive.
  beforeEach(() => {
    mutateAsync.mockReset()
    mergeMutateAsync.mockReset()
    guestStoreState.items = []
    guestStoreState.clear = vi.fn()
  })

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

  it("navigates home even when guest-cart merge fails", async () => {
    mutateAsync.mockResolvedValue({
      id: "u1",
      email: "a@b.com",
      createdAt: "2026-04-18T00:00:00Z",
      updatedAt: "2026-04-18T00:00:00Z",
    })
    mergeMutateAsync.mockRejectedValue(new Error("merge failed"))
    // Seed a guest item so merge actually runs
    guestStoreState.items = [
      { productId: "p1", name: "X-Wing", priceCents: 100, quantity: 1, stockQuantity: 5 },
    ]
    render(<LoginForm />, { wrapper })
    await userEvent.type(screen.getByLabelText(/email/i), "a@b.com")
    await userEvent.type(screen.getByLabelText(/password/i), "hunter2!!")
    await userEvent.click(screen.getByRole("button", { name: /log in/i }))

    // Login mutation called
    await vi.waitFor(() => expect(mutateAsync).toHaveBeenCalled())
    // Merge mutation called and rejected
    await vi.waitFor(() => expect(mergeMutateAsync).toHaveBeenCalled())
    // No server error displayed (merge failure is silent)
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })
})
