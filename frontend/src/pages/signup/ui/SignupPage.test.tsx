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
