import { Link } from "react-router"
import { type Product, StockBadge } from "@/entities/product"
import { formatPrice } from "@/shared/lib/format-price"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card"

interface ProductCardProps {
  product: Product
}

export function ProductCard({ product }: ProductCardProps) {
  return (
    <Link to={`/products/${product.id}`} className="block" aria-label={product.name}>
      <Card className="h-full overflow-hidden">
        {product.imageUrl ? (
          <div className="aspect-square w-full overflow-hidden">
            <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
          </div>
        ) : (
          <div className="aspect-square w-full" />
        )}
        <CardHeader>
          <CardTitle>{product.name}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <p>{formatPrice(product.priceCents)}</p>
          <StockBadge quantity={product.stockQuantity} />
        </CardContent>
      </Card>
    </Link>
  )
}
