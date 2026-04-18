import { act, renderHook } from "@testing-library/react"
import type { ReactNode } from "react"
import { MemoryRouter } from "react-router"
import { describe, expect, it } from "vitest"
import { useQueryParam, useQueryParamList } from "./use-query-params"

function makeWrapper(initialEntries: string[]) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
  }
}

describe("useQueryParam (single value)", () => {
  it("reads the current value from the URL", () => {
    const { result } = renderHook(() => useQueryParam("q"), {
      wrapper: makeWrapper(["/products?q=tie"]),
    })
    expect(result.current[0]).toBe("tie")
  })

  it("returns null when the key is absent", () => {
    const { result } = renderHook(() => useQueryParam("q"), {
      wrapper: makeWrapper(["/products"]),
    })
    expect(result.current[0]).toBeNull()
  })

  it("setter writes the value to the URL", () => {
    const { result } = renderHook(() => useQueryParam("q"), {
      wrapper: makeWrapper(["/products"]),
    })
    act(() => result.current[1]("hello"))
    expect(result.current[0]).toBe("hello")
  })

  it("setter clears the key when given null", () => {
    const { result } = renderHook(() => useQueryParam("q"), {
      wrapper: makeWrapper(["/products?q=tie"]),
    })
    act(() => result.current[1](null))
    expect(result.current[0]).toBeNull()
  })

  it("setter clears the key when given empty string", () => {
    const { result } = renderHook(() => useQueryParam("q"), {
      wrapper: makeWrapper(["/products?q=tie"]),
    })
    act(() => result.current[1](""))
    expect(result.current[0]).toBeNull()
  })
})

describe("useQueryParamList (multi value)", () => {
  it("reads all values for a repeated key", () => {
    const { result } = renderHook(() => useQueryParamList("category"), {
      wrapper: makeWrapper(["/products?category=Fighter&category=Cruiser"]),
    })
    expect(result.current[0]).toEqual(["Fighter", "Cruiser"])
  })

  it("returns empty array when key is absent", () => {
    const { result } = renderHook(() => useQueryParamList("category"), {
      wrapper: makeWrapper(["/products"]),
    })
    expect(result.current[0]).toEqual([])
  })

  it("setter replaces the full list", () => {
    const { result } = renderHook(() => useQueryParamList("category"), {
      wrapper: makeWrapper(["/products?category=Fighter"]),
    })
    act(() => result.current[1](["Cruiser", "Shuttle"]))
    expect(result.current[0]).toEqual(["Cruiser", "Shuttle"])
  })

  it("setter with empty array clears the key entirely", () => {
    const { result } = renderHook(() => useQueryParamList("category"), {
      wrapper: makeWrapper(["/products?category=Fighter&category=Cruiser"]),
    })
    act(() => result.current[1]([]))
    expect(result.current[0]).toEqual([])
  })
})
