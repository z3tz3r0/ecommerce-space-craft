import { act, renderHook } from "@testing-library/react"
import type { ReactNode } from "react"
import { MemoryRouter } from "react-router"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useSearchQuery } from "./use-search-query"

function makeWrapper(initialEntries: string[]) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
  }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe("useSearchQuery", () => {
  it("reads initial query from URL", () => {
    const { result } = renderHook(() => useSearchQuery(), {
      wrapper: makeWrapper(["/products?q=tie"]),
    })
    expect(result.current.value).toBe("tie")
    expect(result.current.committed).toBe("tie")
  })

  it("returns empty string when q is absent", () => {
    const { result } = renderHook(() => useSearchQuery(), {
      wrapper: makeWrapper(["/products"]),
    })
    expect(result.current.value).toBe("")
    expect(result.current.committed).toBe("")
  })

  it("setValue updates the visible value immediately and the URL after debounce", () => {
    const { result } = renderHook(() => useSearchQuery(), {
      wrapper: makeWrapper(["/products"]),
    })

    act(() => result.current.setValue("hello"))
    // visible immediately
    expect(result.current.value).toBe("hello")
    // not yet committed to URL
    expect(result.current.committed).toBe("")

    // advance the debounce
    act(() => vi.advanceTimersByTime(300))
    expect(result.current.committed).toBe("hello")
  })

  it("debounces rapid changes — only the last value commits", () => {
    const { result } = renderHook(() => useSearchQuery(), {
      wrapper: makeWrapper(["/products"]),
    })

    act(() => result.current.setValue("h"))
    act(() => vi.advanceTimersByTime(100))
    act(() => result.current.setValue("he"))
    act(() => vi.advanceTimersByTime(100))
    act(() => result.current.setValue("hel"))
    act(() => vi.advanceTimersByTime(300))

    expect(result.current.committed).toBe("hel")
  })

  it("clearing pushes empty and removes URL key", () => {
    const { result } = renderHook(() => useSearchQuery(), {
      wrapper: makeWrapper(["/products?q=tie"]),
    })
    act(() => result.current.setValue(""))
    act(() => vi.advanceTimersByTime(300))
    expect(result.current.committed).toBe("")
  })
})
