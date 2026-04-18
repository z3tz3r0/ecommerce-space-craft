import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes, useSearchParams } from "react-router"
import { describe, expect, it } from "vitest"
import { FilterSidebar } from "./FilterSidebar"

function URLProbe() {
  const [params] = useSearchParams()
  return <div data-testid="probe">{params.toString()}</div>
}

function renderSidebar(initialEntries: string[]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <FilterSidebar />
      <Routes>
        <Route path="*" element={<URLProbe />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe("FilterSidebar", () => {
  it("renders all 6 categories as checkboxes", () => {
    renderSidebar(["/products"])
    for (const cat of ["Fighter", "Freighter", "Shuttle", "Speeder", "Cruiser", "Capital Ship"]) {
      expect(screen.getByLabelText(cat)).toBeInTheDocument()
    }
  })

  it("clicking a category checkbox pushes it to the URL", async () => {
    renderSidebar(["/products"])
    await userEvent.click(screen.getByLabelText("Fighter"))
    expect(screen.getByTestId("probe").textContent).toContain("category=Fighter")
  })

  it("clicking an already-selected category removes it", async () => {
    renderSidebar(["/products?category=Fighter"])
    await userEvent.click(screen.getByLabelText("Fighter"))
    expect(screen.getByTestId("probe").textContent).not.toContain("category=Fighter")
  })

  it("reflects pre-selected categories from URL", () => {
    renderSidebar(["/products?category=Fighter&category=Cruiser"])
    expect(screen.getByLabelText("Fighter")).toBeChecked()
    expect(screen.getByLabelText("Cruiser")).toBeChecked()
    expect(screen.getByLabelText("Shuttle")).not.toBeChecked()
  })
})
