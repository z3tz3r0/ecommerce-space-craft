import { describe, expect, it } from "vitest"
import { subtotalCents } from "./subtotal"

describe("subtotalCents", () => {
  it("empty cart → 0", () => {
    expect(subtotalCents([])).toBe(0)
  })

  it("single line", () => {
    expect(subtotalCents([{ priceCents: 1250, quantity: 2 }])).toBe(2500)
  })

  it("multi line", () => {
    expect(
      subtotalCents([
        { priceCents: 100, quantity: 3 },
        { priceCents: 250, quantity: 2 },
      ]),
    ).toBe(800)
  })

  it("handles large values without overflow", () => {
    expect(subtotalCents([{ priceCents: 999_999_999, quantity: 1 }])).toBe(999_999_999)
  })
})
