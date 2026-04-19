import { Link } from "react-router"
import { useCart } from "@/entities/cart"
import { formatPrice } from "@/shared/lib/format-price"
import { Button } from "@/shared/ui/button"
import { Separator } from "@/shared/ui/separator"
import { CartLine } from "@/widgets/cart-line"

export function CartPage() {
  const cart = useCart()

  if (cart.isLoading) {
    return (
      <main className="p-8" data-testid="cart-loading">
        Loading cart…
      </main>
    )
  }

  if (cart.items.length === 0) {
    return (
      <main className="mx-auto flex max-w-2xl flex-col gap-4 p-8">
        <h1>Your cart is empty</h1>
        <Link to="/products" className="underline">
          Browse catalog
        </Link>
      </main>
    )
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-8">
      <h1>Your cart</h1>
      <div>
        {cart.items.map((item) => (
          <CartLine
            key={item.productId}
            item={item}
            onSet={(id, q) => void cart.set(id, q)}
            onRemove={(id) => void cart.remove(id)}
          />
        ))}
      </div>
      <Separator />
      <div className="flex items-center justify-between">
        <p>Subtotal</p>
        <p>{formatPrice(cart.subtotalCents)}</p>
      </div>
      <Button disabled>Checkout (coming Phase 3)</Button>
    </main>
  )
}
