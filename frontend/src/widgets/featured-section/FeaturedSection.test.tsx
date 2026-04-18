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
