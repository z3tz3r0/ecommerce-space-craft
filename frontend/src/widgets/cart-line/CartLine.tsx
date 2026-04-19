import type { CartItem } from "@/entities/cart"
import { QuantityStepper } from "@/features/cart-actions"
import { formatPrice } from "@/shared/lib/format-price"
import { Button } from "@/shared/ui/button"

interface CartLineProps {
  item: CartItem
  onSet: (productId: string, quantity: number) => void
  onRemove: (productId: string) => void
}

export function CartLine({ item, onSet, onRemove }: CartLineProps) {
  return (
    <div className="flex items-center gap-4 border-b py-4">
      {item.imageUrl ? (
        <img src={item.imageUrl} alt={item.name} className="size-16 object-cover" />
      ) : (
        <div className="size-16" />
      )}
      <div className="flex-1">
        <p>{item.name}</p>
        <p className="text-sm">{formatPrice(item.priceCents)}</p>
      </div>
      <QuantityStepper
        quantity={item.quantity}
        stockQuantity={item.stockQuantity}
        onChange={(q) => onSet(item.productId, q)}
      />
      <Button variant="ghost" size="sm" onClick={() => onRemove(item.productId)}>
        Remove
      </Button>
    </div>
  )
}
