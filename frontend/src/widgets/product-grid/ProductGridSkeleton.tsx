import { Skeleton } from "@/shared/ui/skeleton"

const PLACEHOLDER_COUNT = 8

export function ProductGridSkeleton() {
  return (
    <div
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
      data-testid="product-grid-skeleton"
    >
      {Array.from({ length: PLACEHOLDER_COUNT }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder list, no reorder or state
        <div key={i} className="flex flex-col gap-3">
          <Skeleton className="aspect-square w-full" />
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/3" />
        </div>
      ))}
    </div>
  )
}
