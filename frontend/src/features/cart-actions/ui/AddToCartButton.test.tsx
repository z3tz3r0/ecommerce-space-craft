import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { MemoryRouter } from "react-router"
import { describe, expect, it, vi } from "vitest"
import { AddToCartButton } from "./AddToCartButton"

const addFn = vi.hoisted(() => vi.fn())
const toastSuccess = vi.hoisted(() => vi.fn())

vi.mock("@/entities/cart", () => ({
  useCart: () => ({ add: addFn }),
}))
vi.mock("sonner", () => ({
  toast: { success: toastSuccess },
}))

function wrapper({ children }: { children: ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>
}

describe("AddToCartButton", () => {
  it("is disabled when out of stock", () => {
    render(
      <AddToCartButton
        product={{
          id: "p1",
          name: "X-Wing",
          priceCents: 100,
          stockQuantity: 0,
        }}
      />,
      { wrapper },
    )
    const btn = screen.getByRole("button")
    expect(btn).toBeDisabled()
    expect(btn).toHaveTextContent(/out of stock/i)
  })

  it("calls cart.add + fires toast on click", async () => {
    addFn.mockResolvedValue(undefined)
    render(
      <AddToCartButton
        product={{
          id: "p1",
          name: "X-Wing",
          priceCents: 100,
          stockQuantity: 5,
        }}
      />,
      { wrapper },
    )
    await userEvent.click(screen.getByRole("button", { name: /add to cart/i }))
    expect(addFn).toHaveBeenCalledWith({
      productId: "p1",
      name: "X-Wing",
      priceCents: 100,
      imageUrl: undefined,
      stockQuantity: 5,
      quantity: 1,
    })
    expect(toastSuccess).toHaveBeenCalled()
  })
})
