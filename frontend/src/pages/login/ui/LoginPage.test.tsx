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
