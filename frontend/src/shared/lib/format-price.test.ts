import { describe, expect, it } from "vitest"
import { formatPrice } from "./format-price"

describe("formatPrice", () => {
  it("formats 0 cents as $0.00", () => {
    expect(formatPrice(0)).toBe("$0.00")
  })

  it("formats whole dollars", () => {
    expect(formatPrice(100)).toBe("$1.00")
    expect(formatPrice(99900)).toBe("$999.00")
  })

  it("formats with cents precision", () => {
    expect(formatPrice(123)).toBe("$1.23")
    expect(formatPrice(99999)).toBe("$999.99")
  })

  it("formats large amounts with thousands separators", () => {
    expect(formatPrice(1234567)).toBe("$12,345.67")
    expect(formatPrice(1000000000)).toBe("$10,000,000.00")
  })

  it("handles negative cents (refund display)", () => {
    expect(formatPrice(-500)).toBe("-$5.00")
  })
})
