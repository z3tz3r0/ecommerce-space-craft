import { useFeaturedProducts } from "@/entities/product"
import { ProductCard } from "@/widgets/product-card"
import { ProductGridSkeleton } from "@/widgets/product-grid"

export function FeaturedSection() {
  const { data, isLoading, isError } = useFeaturedProducts(4)

  return (
    <section className="flex flex-col gap-6">
      <h2>Featured ships</h2>
      {isLoading ? (
        <ProductGridSkeleton />
      ) : isError ? (
        <p>Failed to load featured ships.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(data ?? []).map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </section>
  )
}
