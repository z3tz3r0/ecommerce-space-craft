import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useGuestCartStore } from "../model/guest-store"
import { useCart } from "./cart-facade"

const mockUseAuth = vi.hoisted(() => vi.fn())
const mockGet = vi.hoisted(() => vi.fn())

vi.mock("@/entities/user/@x/cart", () => ({
  useAuth: mockUseAuth,
}))
vi.mock("@/shared/api", () => ({
  api: { GET: mockGet },
}))

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

function resetStore() {
  useGuestCartStore.setState({ items: [] })
  localStorage.removeItem("guest-cart")
}

describe("useCart facade", () => {
  beforeEach(() => {
    resetStore()
    mockUseAuth.mockReset()
    mockGet.mockReset()
  })
  afterEach(resetStore)

  it("uses the guest store when unauthenticated", async () => {
    mockUseAuth.mockReturnValue({
      isSuccess: false,
      isError: true,
      isLoading: false,
      data: undefined,
    })
    useGuestCartStore.getState().add({
      productId: "p1",
      name: "X-Wing",
      priceCents: 100,
      stockQuantity: 5,
    })
    const { result } = renderHook(() => useCart(), { wrapper })
    expect(result.current.items).toHaveLength(1)
    expect(result.current.subtotalCents).toBe(100)
  })

  it("uses the server cart when authenticated", async () => {
    mockUseAuth.mockReturnValue({
      isSuccess: true,
      isError: false,
      isLoading: false,
      data: {
        id: "u1",
        email: "a@b.com",
        createdAt: "2026-04-18T00:00:00Z",
        updatedAt: "2026-04-18T00:00:00Z",
      },
    })
    mockGet.mockResolvedValue({
      data: {
        items: [
          {
            productId: "p2",
            name: "Y-Wing",
            priceCents: 200,
            imageUrl: null,
            quantity: 3,
            stockQuantity: 5,
          },
        ],
      },
      error: undefined,
    })
    const { result } = renderHook(() => useCart(), { wrapper })
    await waitFor(() => expect(result.current.items).toHaveLength(1))
    expect(result.current.subtotalCents).toBe(600)
  })

  it("reports isLoading and empty items while auth is resolving", () => {
    mockUseAuth.mockReturnValue({
      isSuccess: false,
      isError: false,
      isLoading: true,
      data: undefined,
    })
    // Even with guest items in the store, the loading window should hide them
    useGuestCartStore.getState().add({
      productId: "p1",
      name: "X-Wing",
      priceCents: 100,
      stockQuantity: 5,
    })
    const { result } = renderHook(() => useCart(), { wrapper })
    expect(result.current.isLoading).toBe(true)
    expect(result.current.items).toHaveLength(0)
  })
})
