import { useMemo } from "react"
import { useNavigate } from "react-router"
import { useProducts } from "@/entities/product"
import { useCategoryFilter } from "@/features/catalog-filter"
import { SearchInput, useSearchQuery } from "@/features/catalog-search"
import { SortDropdown, sortProducts, useSortOrder } from "@/features/catalog-sort"
import { FilterSidebar } from "@/widgets/filter-sidebar"
import { ProductGrid } from "@/widgets/product-grid"

export function CatalogPage() {
  const navigate = useNavigate()
  const { data, isLoading, isError, refetch } = useProducts()
  const { selected, clear: clearCategories } = useCategoryFilter()
  const [sort] = useSortOrder()
  const { committed: q } = useSearchQuery()

  const visible = useMemo(() => {
    if (!data) return []
    let result = data
    if (selected.length > 0) {
      const set: Set<string> = new Set(selected)
      result = result.filter((p) => set.has(p.category))
    }
    if (q.trim() !== "") {
      const needle = q.toLowerCase()
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(needle) || p.description.toLowerCase().includes(needle),
      )
    }
    return sortProducts(result, sort)
  }, [data, selected, q, sort])

  const filtersActive = selected.length > 0 || q.trim() !== ""

  const onClearFilters = () => {
    clearCategories()
    navigate("/products", { replace: true })
  }

  return (
    <main className="flex flex-col gap-8 p-8">
      <h1>Catalog</h1>
      <div className="flex flex-col gap-8 lg:flex-row">
        <FilterSidebar />
        <div className="flex flex-1 flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <SearchInput />
            <SortDropdown />
          </div>
          <ProductGrid
            products={visible}
            isLoading={isLoading}
            isError={isError}
            onRetry={() => refetch()}
            onClearFilters={filtersActive ? onClearFilters : undefined}
          />
        </div>
      </div>
    </main>
  )
}
