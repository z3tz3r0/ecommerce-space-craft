import { Link, useParams } from "react-router"
import { StockBadge, useProduct } from "@/entities/product"
import { formatPrice } from "@/shared/lib/format-price"
import { Skeleton } from "@/shared/ui/skeleton"

export function ProductDetailPage() {
  const { id = "" } = useParams()
  const { data, isLoading, isError } = useProduct(id)

  if (isLoading) {
    return (
      <main className="flex flex-col gap-6 p-8" data-testid="product-detail-skeleton">
        <Skeleton className="h-10 w-1/2" />
        <div className="flex flex-col gap-6 lg:flex-row">
          <Skeleton className="aspect-square w-full lg:w-1/2" />
          <div className="flex flex-1 flex-col gap-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      </main>
    )
  }

  if (isError || !data) {
    return (
      <main className="flex flex-col items-center gap-4 p-8">
        <h1>Spacecraft not found</h1>
        <Link to="/products" className="underline">
          Back to catalog
        </Link>
      </main>
    )
  }

  return (
    <main className="flex flex-col gap-6 p-8">
      <Link to="/products" className="underline">
        ← Back to catalog
      </Link>
      <div className="flex flex-col gap-8 lg:flex-row">
        {data.imageUrl && (
          <div className="aspect-square w-full overflow-hidden lg:w-1/2">
            <img src={data.imageUrl} alt={data.name} className="h-full w-full object-cover" />
          </div>
        )}
        <div className="flex flex-1 flex-col gap-4">
          <h1>{data.name}</h1>
          <p>{formatPrice(data.priceCents)}</p>
          <StockBadge quantity={data.stockQuantity} />
          <p>{data.description}</p>
          <dl className="grid grid-cols-2 gap-4">
            <div>
              <dt>Category</dt>
              <dd>{data.category}</dd>
            </div>
            {data.manufacturer && (
              <div>
                <dt>Manufacturer</dt>
                <dd>{data.manufacturer}</dd>
              </div>
            )}
            {typeof data.crewAmount === "number" && (
              <div>
                <dt>Crew</dt>
                <dd>{data.crewAmount}</dd>
              </div>
            )}
            {data.maxSpeed && (
              <div>
                <dt>Max speed</dt>
                <dd>{data.maxSpeed}</dd>
              </div>
            )}
          </dl>
        </div>
      </div>
    </main>
  )
}
