import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { useGuestCartStore } from "./guest-store"

function resetStore() {
  useGuestCartStore.setState({ items: [] })
  localStorage.clear()
}

describe("useGuestCartStore", () => {
  beforeEach(resetStore)
  afterEach(resetStore)

  it("adds a new item", () => {
    useGuestCartStore.getState().add({
      productId: "p1",
      name: "X-Wing",
      priceCents: 100,
      stockQuantity: 5,
    })
    expect(useGuestCartStore.getState().items).toEqual([
      {
        productId: "p1",
        name: "X-Wing",
        priceCents: 100,
        quantity: 1,
        stockQuantity: 5,
      },
    ])
  })

  it("increments an existing item", () => {
    useGuestCartStore.getState().add({
      productId: "p1",
      name: "X-Wing",
      priceCents: 100,
      stockQuantity: 5,
    })
    useGuestCartStore.getState().add({
      productId: "p1",
      name: "X-Wing",
      priceCents: 100,
      stockQuantity: 5,
      quantity: 2,
    })
    expect(useGuestCartStore.getState().items[0].quantity).toBe(3)
  })

  it("clamps add to stockQuantity", () => {
    useGuestCartStore.getState().add({
      productId: "p1",
      name: "X-Wing",
      priceCents: 100,
      stockQuantity: 2,
      quantity: 5,
    })
    expect(useGuestCartStore.getState().items[0].quantity).toBe(2)
  })

  it("set replaces quantity, clamped to stock", () => {
    useGuestCartStore.getState().add({
      productId: "p1",
      name: "X-Wing",
      priceCents: 100,
      stockQuantity: 3,
    })
    useGuestCartStore.getState().set("p1", 5)
    expect(useGuestCartStore.getState().items[0].quantity).toBe(3)
  })

  it("set with 0 removes the item", () => {
    useGuestCartStore.getState().add({
      productId: "p1",
      name: "X-Wing",
      priceCents: 100,
      stockQuantity: 3,
    })
    useGuestCartStore.getState().set("p1", 0)
    expect(useGuestCartStore.getState().items).toHaveLength(0)
  })

  it("remove drops an item", () => {
    useGuestCartStore.getState().add({
      productId: "p1",
      name: "X-Wing",
      priceCents: 100,
      stockQuantity: 3,
    })
    useGuestCartStore.getState().remove("p1")
    expect(useGuestCartStore.getState().items).toHaveLength(0)
  })

  it("clear empties the store", () => {
    useGuestCartStore.getState().add({
      productId: "p1",
      name: "X-Wing",
      priceCents: 100,
      stockQuantity: 3,
    })
    useGuestCartStore.getState().clear()
    expect(useGuestCartStore.getState().items).toHaveLength(0)
  })
})
