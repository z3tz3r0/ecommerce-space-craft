import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { CartLine } from "./CartLine"

const item = {
  productId: "p1",
  name: "X-Wing",
  priceCents: 12500000,
  imageUrl: null,
  quantity: 2,
  stockQuantity: 5,
}

describe("CartLine", () => {
  it("renders name, price, and quantity", () => {
    render(<CartLine item={item} onSet={() => {}} onRemove={() => {}} />)
    expect(screen.getByText("X-Wing")).toBeInTheDocument()
    expect(screen.getByText("$125,000.00")).toBeInTheDocument()
    expect(screen.getByText("2")).toBeInTheDocument()
  })

  it("calls onSet when the stepper fires", async () => {
    const onSet = vi.fn()
    render(<CartLine item={item} onSet={onSet} onRemove={() => {}} />)
    await userEvent.click(screen.getByRole("button", { name: /increase/i }))
    expect(onSet).toHaveBeenCalledWith("p1", 3)
  })

  it("calls onRemove from the remove button", async () => {
    const onRemove = vi.fn()
    render(<CartLine item={item} onSet={() => {}} onRemove={onRemove} />)
    await userEvent.click(screen.getByRole("button", { name: /remove/i }))
    expect(onRemove).toHaveBeenCalledWith("p1")
  })
})
