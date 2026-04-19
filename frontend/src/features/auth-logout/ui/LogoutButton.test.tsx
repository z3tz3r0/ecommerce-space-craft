import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { MemoryRouter } from "react-router"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { LogoutButton } from "./LogoutButton"

const mutateAsync = vi.hoisted(() => vi.fn())
vi.mock("@/entities/user", () => ({
  useLogoutMutation: () => ({ mutateAsync, isPending: false }),
}))

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

describe("LogoutButton", () => {
  beforeEach(() => {
    mutateAsync.mockReset()
  })

  it("calls logout mutation on click", async () => {
    mutateAsync.mockResolvedValue(undefined)
    render(<LogoutButton />, { wrapper })
    await userEvent.click(screen.getByRole("button", { name: /log out/i }))
    expect(mutateAsync).toHaveBeenCalled()
  })
})
