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
    renderGrid({ products: [], isLoading: false, isError: false, onRetry: vi.fn() })
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
