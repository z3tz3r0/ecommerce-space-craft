import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router"
import { describe, expect, it } from "vitest"
import type { Product } from "@/entities/product"
import { ProductCard } from "./ProductCard"

const baseProduct: Product = {
  id: "abc-123",
  name: "X-Wing T-65",
  description: "A versatile starfighter.",
  priceCents: 12500000,
  imageUrl: "https://example.com/x-wing.jpg",
  category: "Fighter",
  stockQuantity: 8,
  isActive: true,
  isFeatured: false,
  createdAt: "2026-04-10T00:00:00Z",
  updatedAt: "2026-04-10T00:00:00Z",
}

function renderCard(p: Product) {
  return render(
    <MemoryRouter>
      <ProductCard product={p} />
    </MemoryRouter>,
  )
}

describe("ProductCard", () => {
  it("renders product name, formatted price, and stock badge", () => {
    renderCard(baseProduct)
    expect(screen.getByText("X-Wing T-65")).toBeInTheDocument()
    expect(screen.getByText("$125,000.00")).toBeInTheDocument()
    expect(screen.getByText("In stock")).toBeInTheDocument()
  })

  it("links to the product detail page", () => {
    renderCard(baseProduct)
    const link = screen.getByRole("link", { name: /X-Wing T-65/i })
    expect(link).toHaveAttribute("href", "/products/abc-123")
  })

  it("renders the image with name as alt text", () => {
    renderCard(baseProduct)
    const img = screen.getByAltText("X-Wing T-65")
    expect(img).toHaveAttribute("src", "https://example.com/x-wing.jpg")
  })

  it("renders no image element when imageUrl is missing", () => {
    renderCard({ ...baseProduct, imageUrl: undefined })
    expect(screen.queryByRole("img")).not.toBeInTheDocument()
  })

  it("shows 'Out of stock' badge for zero stock", () => {
    renderCard({ ...baseProduct, stockQuantity: 0 })
    expect(screen.getByText("Out of stock")).toBeInTheDocument()
  })

  it("shows 'Low stock \u2014 3 left' for low stock", () => {
    renderCard({ ...baseProduct, stockQuantity: 3 })
    expect(screen.getByText("Low stock \u2014 3 left")).toBeInTheDocument()
  })
})
