import type { ReactNode } from "react"
import { Navigate } from "react-router"
import { useAuth } from "@/entities/user"
import { Skeleton } from "@/shared/ui/skeleton"

// RequireAuth renders its children only when the user is authenticated.
// Loading renders a skeleton; 401 redirects to /login preserving no state.
// Lives in features/ because it composes entities/user auth state — FSD
// forbids shared → entities imports, so the route guard sits here.
export function RequireAuth({ children }: { children: ReactNode }) {
  const auth = useAuth()
  if (auth.isLoading) {
    return <Skeleton className="h-8 w-40 m-8" />
  }
  if (auth.isError || !auth.data) {
    return <Navigate to="/login" replace />
  }
  return <>{children}</>
}
