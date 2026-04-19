import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { MemoryRouter } from "react-router"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { CartPage } from "./CartPage"

const mockUseCart = vi.hoisted(() => vi.fn())
vi.mock("@/entities/cart", () => ({ useCart: mockUseCart }))

function wrapper({ children }: { children: ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>
}

describe("CartPage", () => {
  beforeEach(() => {
    mockUseCart.mockReset()
  })

  it("shows empty-state link when items is empty", () => {
    mockUseCart.mockReturnValue({
      items: [],
      subtotalCents: 0,
      isLoading: false,
      add: vi.fn(async () => undefined),
      set: vi.fn(async () => undefined),
      remove: vi.fn(async () => undefined),
    })
    render(<CartPage />, { wrapper })
    expect(screen.getByRole("heading", { name: /empty/i })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /browse catalog/i })).toBeInTheDocument()
  })

  it("renders items + subtotal when populated", () => {
    mockUseCart.mockReturnValue({
      items: [
        {
          productId: "p1",
          name: "X-Wing",
          priceCents: 100,
          imageUrl: null,
          quantity: 2,
          stockQuantity: 5,
        },
      ],
      subtotalCents: 200,
      isLoading: false,
      add: vi.fn(async () => undefined),
      set: vi.fn(async () => undefined),
      remove: vi.fn(async () => undefined),
    })
    render(<CartPage />, { wrapper })
    expect(screen.getByText("X-Wing")).toBeInTheDocument()
    expect(screen.getByText("$2.00")).toBeInTheDocument()
  })

  it("shows loading skeleton when isLoading is true", () => {
    mockUseCart.mockReturnValue({
      items: [],
      subtotalCents: 0,
      isLoading: true,
      add: vi.fn(async () => undefined),
      set: vi.fn(async () => undefined),
      remove: vi.fn(async () => undefined),
    })
    render(<CartPage />, { wrapper })
    expect(screen.getByTestId("cart-loading")).toBeInTheDocument()
  })

  it("checkout button is disabled", () => {
    mockUseCart.mockReturnValue({
      items: [
        {
          productId: "p1",
          name: "X-Wing",
          priceCents: 100,
          imageUrl: null,
          quantity: 1,
          stockQuantity: 5,
        },
      ],
      subtotalCents: 100,
      isLoading: false,
      add: vi.fn(async () => undefined),
      set: vi.fn(async () => undefined),
      remove: vi.fn(async () => undefined),
    })
    render(<CartPage />, { wrapper })
    expect(screen.getByRole("button", { name: /checkout/i })).toBeDisabled()
  })
})
