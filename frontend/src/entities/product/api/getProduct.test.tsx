import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useProduct } from "./getProduct"

const mockGet = vi.fn()
vi.mock("@/shared/api", () => ({
  api: {
    GET: (...args: unknown[]) => mockGet(...args),
  },
}))

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

beforeEach(() => mockGet.mockReset())
afterEach(() => mockGet.mockReset())

describe("useProduct", () => {
  it("calls GET /api/products/:id with the path param", async () => {
    mockGet.mockResolvedValue({ data: { id: "abc", name: "X-Wing" }, error: undefined })

    const { result } = renderHook(() => useProduct("abc"), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockGet).toHaveBeenCalledWith("/api/products/{id}", {
      params: { path: { id: "abc" } },
    })
    expect(result.current.data).toEqual({ id: "abc", name: "X-Wing" })
  })

  it("throws when the API returns an error envelope", async () => {
    mockGet.mockResolvedValue({ data: undefined, error: { title: "Not Found", status: 404 } })

    const { result } = renderHook(() => useProduct("missing"), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toMatch(/not found/i)
  })

  it("is disabled when id is empty", () => {
    const { result } = renderHook(() => useProduct(""), { wrapper: makeWrapper() })
    expect(result.current.fetchStatus).toBe("idle")
    expect(mockGet).not.toHaveBeenCalled()
  })
})
