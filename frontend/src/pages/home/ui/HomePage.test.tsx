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
