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
    render(<div />, { wrapper: makeWrapper() })
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
    render(<div />, { wrapper: makeWrapper() })
    expect(screen.getByTestId("product-detail-skeleton")).toBeInTheDocument()
  })

  it("renders not-found state on error", () => {
    mockState = { data: undefined, isLoading: false, isError: true }
    render(<div />, { wrapper: makeWrapper() })
    expect(screen.getByText(/not found/i)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /back to catalog/i })).toHaveAttribute(
      "href",
      "/products",
    )
  })
})
