import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useAuth } from "./use-auth"

const mockGet = vi.hoisted(() => vi.fn())

vi.mock("@/shared/api", () => ({
  api: { GET: mockGet },
}))

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe("useAuth", () => {
  beforeEach(() => {
    mockGet.mockReset()
  })
  afterEach(() => {
    mockGet.mockReset()
  })

  it("returns the user on 200", async () => {
    const user = {
      id: "u1",
      email: "a@b.com",
      createdAt: "2026-04-18T00:00:00Z",
      updatedAt: "2026-04-18T00:00:00Z",
    }
    mockGet.mockResolvedValue({ data: user, error: undefined })

    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(user)
  })

  it("surfaces 401 as isError", async () => {
    mockGet.mockResolvedValue({
      data: undefined,
      error: { title: "Unauthorized", status: 401, detail: "not authenticated" },
    })

    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.data).toBeUndefined()
  })
})
