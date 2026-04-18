import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { StockBadge } from "./StockBadge"

describe("StockBadge", () => {
  it("renders 'In stock' when quantity is high", () => {
    render(<StockBadge quantity={10} />)
    expect(screen.getByText("In stock")).toBeInTheDocument()
  })

  it("renders 'Low stock — 3 left' when quantity is 1-5", () => {
    render(<StockBadge quantity={3} />)
    expect(screen.getByText("Low stock — 3 left")).toBeInTheDocument()
  })

  it("renders 'Out of stock' when quantity is zero", () => {
    render(<StockBadge quantity={0} />)
    expect(screen.getByText("Out of stock")).toBeInTheDocument()
  })

  it("renders 'Out of stock' when quantity is negative (defensive)", () => {
    render(<StockBadge quantity={-1} />)
    expect(screen.getByText("Out of stock")).toBeInTheDocument()
  })
})
