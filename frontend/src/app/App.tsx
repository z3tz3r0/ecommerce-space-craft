import { Outlet } from "react-router"
import { Toaster } from "@/shared/ui/sonner"
import { SiteHeader } from "@/widgets/site-header"

export function App() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <Outlet />
      <Toaster />
    </div>
  )
}
