import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useFeaturedProducts } from "./getFeaturedProducts"

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

describe("useFeaturedProducts", () => {
  it("calls GET /api/products with featured=true and the requested limit", async () => {
    mockGet.mockResolvedValue({ data: [{ id: "1" }, { id: "2" }], error: undefined })

    const { result } = renderHook(() => useFeaturedProducts(4), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockGet).toHaveBeenCalledWith("/api/products", {
      params: { query: { featured: true, limit: 4 } },
    })
    expect(result.current.data).toHaveLength(2)
  })

  it("uses limit=4 when no argument is passed", async () => {
    mockGet.mockResolvedValue({ data: [], error: undefined })

    renderHook(() => useFeaturedProducts(), { wrapper: makeWrapper() })

    await waitFor(() => expect(mockGet).toHaveBeenCalled())
    expect(mockGet).toHaveBeenCalledWith("/api/products", {
      params: { query: { featured: true, limit: 4 } },
    })
  })

  it("throws when the API returns an error envelope", async () => {
    mockGet.mockResolvedValue({ data: undefined, error: { title: "Server Error" } })

    const { result } = renderHook(() => useFeaturedProducts(4), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})
