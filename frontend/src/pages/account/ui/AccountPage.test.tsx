import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { MemoryRouter, Route, Routes } from "react-router"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { AccountPage } from "./AccountPage"

const mockUseAuth = vi.hoisted(() => vi.fn())
vi.mock("@/entities/user", () => ({
  useAuth: mockUseAuth,
  useLogoutMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))
vi.mock("@/entities/cart", () => ({
  cartKeys: { server: () => ["cart", "server"] },
  useGuestCartStore: { getState: () => ({ clear: () => {} }) },
}))
vi.mock("@/features/auth-logout", () => ({
  LogoutButton: () => <button type="button">Log out</button>,
}))

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/account"]}>
        <Routes>
          <Route path="/login" element={<div data-testid="login-redirect" />} />
          <Route path="/account" element={children} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe("AccountPage", () => {
  beforeEach(() => {
    mockUseAuth.mockReset()
  })

  it("redirects to /login when 401", () => {
    mockUseAuth.mockReturnValue({
      isLoading: false,
      isError: true,
      isSuccess: false,
      data: undefined,
    })
    render(<AccountPage />, { wrapper })
    expect(screen.getByTestId("login-redirect")).toBeInTheDocument()
  })

  it("renders email and join date when authed", () => {
    mockUseAuth.mockReturnValue({
      isLoading: false,
      isError: false,
      isSuccess: true,
      data: {
        id: "u1",
        email: "a@b.com",
        createdAt: "2026-04-18T00:00:00Z",
        updatedAt: "2026-04-18T00:00:00Z",
      },
    })
    render(<AccountPage />, { wrapper })
    expect(screen.getByRole("heading", { name: /account/i })).toBeInTheDocument()
    expect(screen.getByText("a@b.com")).toBeInTheDocument()
    expect(
      screen.getByText(new Date("2026-04-18T00:00:00Z").toLocaleDateString()),
    ).toBeInTheDocument()
  })
})
