import { useQuery } from "@tanstack/react-query"
import { api } from "@/shared/api"
import type { Product } from "../model/types"
import { productKeys } from "./product-keys"

const DEFAULT_LIMIT = 4

export function useFeaturedProducts(limit: number = DEFAULT_LIMIT) {
  return useQuery<Product[]>({
    queryKey: productKeys.featured(limit),
    queryFn: async () => {
      const { data, error } = await api.GET("/api/products", {
        params: { query: { featured: true, limit } },
      })
      if (error) {
        throw new Error(
          `Failed to load featured products: ${error.detail ?? error.title ?? "unknown error"}`,
        )
      }
      return data ?? []
    },
  })
}
