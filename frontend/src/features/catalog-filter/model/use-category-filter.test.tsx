import { act, renderHook } from "@testing-library/react"
import type { ReactNode } from "react"
import { MemoryRouter } from "react-router"
import { describe, expect, it } from "vitest"
import { useCategoryFilter } from "./use-category-filter"

function makeWrapper(initialEntries: string[]) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
  }
}

describe("useCategoryFilter", () => {
  it("reads selected categories from URL", () => {
    const { result } = renderHook(() => useCategoryFilter(), {
      wrapper: makeWrapper(["/products?category=Fighter&category=Cruiser"]),
    })
    expect(result.current.selected).toEqual(["Fighter", "Cruiser"])
  })

  it("ignores invalid category values in URL", () => {
    const { result } = renderHook(() => useCategoryFilter(), {
      wrapper: makeWrapper(["/products?category=Fighter&category=Bogus"]),
    })
    expect(result.current.selected).toEqual(["Fighter"])
  })

  it("toggle adds a category when not selected", () => {
    const { result } = renderHook(() => useCategoryFilter(), {
      wrapper: makeWrapper(["/products"]),
    })
    act(() => result.current.toggle("Fighter"))
    expect(result.current.selected).toEqual(["Fighter"])
  })

  it("toggle removes a category when already selected", () => {
    const { result } = renderHook(() => useCategoryFilter(), {
      wrapper: makeWrapper(["/products?category=Fighter&category=Cruiser"]),
    })
    act(() => result.current.toggle("Fighter"))
    expect(result.current.selected).toEqual(["Cruiser"])
  })

  it("isSelected reflects current state", () => {
    const { result } = renderHook(() => useCategoryFilter(), {
      wrapper: makeWrapper(["/products?category=Fighter"]),
    })
    expect(result.current.isSelected("Fighter")).toBe(true)
    expect(result.current.isSelected("Cruiser")).toBe(false)
  })

  it("clear empties selection and removes URL key", () => {
    const { result } = renderHook(() => useCategoryFilter(), {
      wrapper: makeWrapper(["/products?category=Fighter&category=Cruiser"]),
    })
    act(() => result.current.clear())
    expect(result.current.selected).toEqual([])
  })
})
