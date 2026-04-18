import type { Product } from "@/entities/product"

export const SORT_ORDERS = ["newest", "price-asc", "price-desc"] as const
export type SortOrder = (typeof SORT_ORDERS)[number]
export const DEFAULT_SORT: SortOrder = "newest"

export function isSortOrder(v: string | null): v is SortOrder {
  return v !== null && (SORT_ORDERS as readonly string[]).includes(v)
}

export function sortProducts<T extends Pick<Product, "priceCents" | "createdAt">>(
  products: T[],
  order: SortOrder,
): T[] {
  const copy = products.slice()
  switch (order) {
    case "price-asc":
      return copy.sort((a, b) => a.priceCents - b.priceCents)
    case "price-desc":
      return copy.sort((a, b) => b.priceCents - a.priceCents)
    default:
      return copy.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }
}

export const SORT_LABELS: Record<SortOrder, string> = {
  newest: "Newest first",
  "price-asc": "Price: low to high",
  "price-desc": "Price: high to low",
}
