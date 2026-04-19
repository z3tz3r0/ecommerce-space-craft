import { Link } from "react-router"
import { useCart } from "@/entities/cart"
import { useAuth } from "@/entities/user"
import { LogoutButton } from "@/features/auth-logout"
import { Badge } from "@/shared/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu"
import { Skeleton } from "@/shared/ui/skeleton"

export function SiteHeader() {
  const auth = useAuth()
  const cart = useCart()
  const cartCount = cart.items.reduce((sum, i) => sum + i.quantity, 0)

  return (
    <header className="flex items-center justify-between gap-4 border-b px-6 py-4">
      <nav className="flex items-center gap-6">
        <Link to="/" className="font-semibold">
          Spacecraft Store
        </Link>
        <Link to="/products">Catalog</Link>
      </nav>
      <div className="flex items-center gap-4">
        <Link to="/cart" aria-label="Cart" className="flex items-center gap-2">
          <span>Cart</span>
          {cartCount > 0 && <Badge>{cartCount}</Badge>}
        </Link>
        {auth.isLoading ? (
          <Skeleton data-testid="site-header-auth-skeleton" className="h-9 w-20" />
        ) : auth.isSuccess ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="text-sm">
                {auth.data.email}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{auth.data.email}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/account">Account</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <LogoutButton />
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div className="flex items-center gap-3 text-sm">
            <Link to="/login">Log in</Link>
            <Link to="/signup">Sign up</Link>
          </div>
        )}
      </div>
    </header>
  )
}
