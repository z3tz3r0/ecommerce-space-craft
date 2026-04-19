import { useNavigate } from "react-router"
import { toast } from "sonner"
import { useCart } from "@/entities/cart"
import { Button } from "@/shared/ui/button"

interface AddToCartButtonProps {
  product: {
    id: string
    name: string
    priceCents: number
    imageUrl?: string | null
    stockQuantity: number
  }
}

export function AddToCartButton({ product }: AddToCartButtonProps) {
  const cart = useCart()
  const navigate = useNavigate()
  const outOfStock = product.stockQuantity <= 0

  async function handleClick() {
    await cart.add({
      productId: product.id,
      name: product.name,
      priceCents: product.priceCents,
      imageUrl: product.imageUrl ?? undefined,
      stockQuantity: product.stockQuantity,
      quantity: 1,
    })
    toast.success(`${product.name} added to cart`, {
      action: {
        label: "View cart",
        onClick: () => navigate("/cart"),
      },
    })
  }

  return (
    <Button onClick={handleClick} disabled={outOfStock}>
      {outOfStock ? "Out of stock" : "Add to cart"}
    </Button>
  )
}
