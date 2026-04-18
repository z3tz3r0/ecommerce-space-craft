import { useQuery } from "@tanstack/react-query"
import { api } from "@/shared/api"
import type { Product } from "../model/types"
import { productKeys } from "./product-keys"

export function useProducts() {
  return useQuery<Product[]>({
    queryKey: productKeys.list(),
    queryFn: async () => {
      const { data, error } = await api.GET("/api/products")
      if (error) {
        throw new Error(
          `Failed to load products: ${error.detail ?? error.title ?? "unknown error"}`,
        )
      }
      return data ?? []
    },
  })
}
