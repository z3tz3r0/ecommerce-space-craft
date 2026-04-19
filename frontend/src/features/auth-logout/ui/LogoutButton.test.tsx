import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { LogoutButton } from "./LogoutButton"

const logout = vi.hoisted(() => vi.fn())
vi.mock("../model/use-logout-handler", () => ({
  useLogoutHandler: () => ({ logout, isPending: false }),
}))

describe("LogoutButton", () => {
  beforeEach(() => {
    logout.mockReset()
  })

  it("calls logout handler on click", async () => {
    logout.mockResolvedValue(undefined)
    render(<LogoutButton />)
    await userEvent.click(screen.getByRole("button", { name: /log out/i }))
    expect(logout).toHaveBeenCalled()
  })
})
