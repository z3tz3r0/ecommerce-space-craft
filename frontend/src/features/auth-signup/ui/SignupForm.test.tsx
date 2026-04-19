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
  beforeEach(() => {
    // Use braces — implicit return of the mock object confuses vitest's
    // unhandled-rejection detector when combined with mockRejectedValue.
    mutateAsync.mockReset()
  })

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
