import { useQuery } from "@tanstack/react-query"
import { api } from "@/shared/api"
import type { Product } from "../model/types"
import { productKeys } from "./product-keys"

export function useProduct(id: string) {
  return useQuery<Product>({
    queryKey: productKeys.detail(id),
    enabled: id !== "",
    queryFn: async () => {
      const { data, error } = await api.GET("/api/products/{id}", {
        params: { path: { id } },
      })
      if (error) {
        throw new Error(`Failed to load product: ${error.detail ?? error.title ?? "unknown error"}`)
      }
      if (!data) {
        throw new Error("Failed to load product: empty response")
      }
      return data
    },
  })
}
