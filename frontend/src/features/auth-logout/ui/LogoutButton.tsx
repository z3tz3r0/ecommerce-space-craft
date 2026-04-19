import { useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "react-router"
import { cartKeys, useGuestCartStore } from "@/entities/cart"
import { useLogoutMutation } from "@/entities/user"
import { Button } from "@/shared/ui/button"

export function LogoutButton() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const logout = useLogoutMutation()

  async function handleClick() {
    try {
      await logout.mutateAsync()
    } catch {
      // Server logout failed; client still clears state in `finally` so the
      // user sees a logged-out UI. Surfacing the error here would be wrong —
      // any subsequent `useAuth()` read will surface 401 if the session does
      // somehow persist.
    } finally {
      qc.removeQueries({ queryKey: cartKeys.server() })
      useGuestCartStore.getState().clear()
      navigate("/")
    }
  }

  return (
    <Button variant="outline" onClick={handleClick} disabled={logout.isPending}>
      {logout.isPending ? "Logging out…" : "Log out"}
    </Button>
  )
}
