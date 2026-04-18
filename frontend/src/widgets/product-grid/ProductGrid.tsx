import type { Product } from "@/entities/product"
import { ProductCard } from "@/widgets/product-card"
import { ProductGridSkeleton } from "./ProductGridSkeleton"

interface ProductGridProps {
  products: Product[]
  isLoading: boolean
  isError: boolean
  onRetry: () => void
  onClearFilters?: () => void
}

export function ProductGrid({
  products,
  isLoading,
  isError,
  onRetry,
  onClearFilters,
}: ProductGridProps) {
  if (isLoading) {
    return <ProductGridSkeleton />
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-4 p-8">
        <p>Failed to load products.</p>
        <button type="button" onClick={onRetry} className="underline">
          Try again
        </button>
      </div>
    )
  }

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 p-8">
        <p>No spacecraft match your filters.</p>
        {onClearFilters && (
          <button type="button" onClick={onClearFilters} className="underline">
            Clear filters
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  )
}
