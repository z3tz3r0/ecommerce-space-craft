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
