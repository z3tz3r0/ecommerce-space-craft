import { Button } from "@/shared/ui/button"
import { useLogoutHandler } from "../model/use-logout-handler"

export function LogoutButton() {
  const { logout, isPending } = useLogoutHandler()

  return (
    <Button variant="outline" onClick={logout} disabled={isPending}>
      {isPending ? "Logging out…" : "Log out"}
    </Button>
  )
}
