import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { MemoryRouter } from "react-router"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { SiteHeader } from "./SiteHeader"

const mockUseAuth = vi.hoisted(() => vi.fn())
const mockUseCart = vi.hoisted(() => vi.fn())

vi.mock("@/entities/user", () => ({ useAuth: mockUseAuth }))
vi.mock("@/entities/cart", () => ({ useCart: mockUseCart }))
vi.mock("@/features/auth-logout", () => ({
  LogoutButton: () => <button type="button">Log out</button>,
}))

function wrapper({ children }: { children: ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>
}

describe("SiteHeader", () => {
  beforeEach(() => {
    mockUseAuth.mockReset()
    mockUseCart.mockReset()
    mockUseCart.mockReturnValue({ items: [] })
  })

  it("shows Log in / Sign up links when logged out", () => {
    mockUseAuth.mockReturnValue({
      isLoading: false,
      isSuccess: false,
      isError: true,
      data: undefined,
    })
    render(<SiteHeader />, { wrapper })
    expect(screen.getByRole("link", { name: /log in/i })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /sign up/i })).toBeInTheDocument()
  })

  it("shows the cart count badge with total quantity", () => {
    mockUseAuth.mockReturnValue({
      isLoading: false,
      isSuccess: false,
      isError: true,
      data: undefined,
    })
    mockUseCart.mockReturnValue({
      items: [
        { productId: "a", name: "A", priceCents: 1, quantity: 2, stockQuantity: 5, imageUrl: null },
        { productId: "b", name: "B", priceCents: 1, quantity: 3, stockQuantity: 5, imageUrl: null },
      ],
    })
    render(<SiteHeader />, { wrapper })
    expect(screen.getByText("5")).toBeInTheDocument()
  })

  it("shows the user email and account link when authenticated", () => {
    mockUseAuth.mockReturnValue({
      isLoading: false,
      isSuccess: true,
      isError: false,
      data: {
        id: "u1",
        email: "a@b.com",
        createdAt: "2026-04-18T00:00:00Z",
        updatedAt: "2026-04-18T00:00:00Z",
      },
    })
    render(<SiteHeader />, { wrapper })
    expect(screen.getByText(/a@b\.com/)).toBeInTheDocument()
  })

  it("renders a skeleton while auth is loading", () => {
    mockUseAuth.mockReturnValue({
      isLoading: true,
      isSuccess: false,
      isError: false,
      data: undefined,
    })
    render(<SiteHeader />, { wrapper })
    expect(screen.getByTestId("site-header-auth-skeleton")).toBeInTheDocument()
  })
})
