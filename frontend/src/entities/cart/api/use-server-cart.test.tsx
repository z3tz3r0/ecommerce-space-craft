import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useServerCart } from "./use-server-cart"

const mockGet = vi.hoisted(() => vi.fn())

vi.mock("@/shared/api", () => ({
  api: { GET: mockGet },
}))

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe("useServerCart", () => {
  beforeEach(() => mockGet.mockReset())

  it("returns items when enabled and authenticated", async () => {
    mockGet.mockResolvedValue({ data: { items: [] }, error: undefined })
    const { result } = renderHook(() => useServerCart({ enabled: true }), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual({ items: [] })
  })

  it("does not fetch when disabled", async () => {
    const { result } = renderHook(() => useServerCart({ enabled: false }), { wrapper })
    expect(result.current.fetchStatus).toBe("idle")
    expect(mockGet).not.toHaveBeenCalled()
  })
})
