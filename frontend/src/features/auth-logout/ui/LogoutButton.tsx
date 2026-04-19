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
    } finally {
      // Even if the server call errored we still want the client to
      // reflect a logged-out state.
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
