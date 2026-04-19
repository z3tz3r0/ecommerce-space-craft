import { useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "react-router"
import { cartKeys, useGuestCartStore } from "@/entities/cart"
import { useLogoutMutation } from "@/entities/user"

// useLogoutHandler encapsulates the full logout flow: server mutation (best
// effort) + client-state cleanup + navigate. Returns a `{ logout, isPending }`
// shape consumed by LogoutButton (Account page) and the SiteHeader dropdown.
//
// The mutation rejection is swallowed so client cleanup in `finally` still
// runs — surfacing it would leave the UI stuck logged-in while any subsequent
// `useAuth()` read would flag 401 anyway if the session somehow persisted.
export function useLogoutHandler() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const logout = useLogoutMutation()

  async function handleLogout() {
    try {
      await logout.mutateAsync()
    } catch {
      // Server logout failed; client still clears state in `finally` so the
      // user sees a logged-out UI.
    } finally {
      qc.removeQueries({ queryKey: cartKeys.server() })
      useGuestCartStore.getState().clear()
      navigate("/")
    }
  }

  return { logout: handleLogout, isPending: logout.isPending }
}
