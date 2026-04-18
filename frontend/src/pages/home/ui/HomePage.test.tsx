import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { HomePage } from "./HomePage"

vi.mock("@/entities/product", () => ({
  useProducts: () => ({
    data: [
      { id: "1", name: "X-Wing" },
      { id: "2", name: "Millennium Falcon" },
      { id: "3", name: "Naboo N-1" },
    ],
    isLoading: false,
    error: null,
  }),
}))

describe("HomePage", () => {
  it("renders the loaded product count", () => {
    render(<HomePage />)
    expect(screen.getByText(/Loaded 3 products/i)).toBeInTheDocument()
  })
})
