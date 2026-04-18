import { describe, expect, it } from "vitest"
import { stockLabel, stockStatus } from "./stock"

describe("stockStatus", () => {
  it("returns 'out' for zero", () => {
    expect(stockStatus(0)).toBe("out")
  })

  it("returns 'out' for negative (defensive)", () => {
    expect(stockStatus(-3)).toBe("out")
  })

  it("returns 'low' for 1 through 5 inclusive", () => {
    expect(stockStatus(1)).toBe("low")
    expect(stockStatus(3)).toBe("low")
    expect(stockStatus(5)).toBe("low")
  })

  it("returns 'in' for 6 and above", () => {
    expect(stockStatus(6)).toBe("in")
    expect(stockStatus(50)).toBe("in")
    expect(stockStatus(9999)).toBe("in")
  })
})

describe("stockLabel", () => {
  it("returns 'Out of stock' for out", () => {
    expect(stockLabel(0)).toBe("Out of stock")
  })

  it("returns 'Low stock — N left' for low", () => {
    expect(stockLabel(3)).toBe("Low stock — 3 left")
    expect(stockLabel(1)).toBe("Low stock — 1 left")
  })

  it("returns 'In stock' for in", () => {
    expect(stockLabel(6)).toBe("In stock")
    expect(stockLabel(100)).toBe("In stock")
  })
})
