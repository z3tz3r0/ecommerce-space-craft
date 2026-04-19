import { useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/shared/api"
import { cartKeys } from "./cart-keys"

interface MergeItemInput {
  productId: string
  quantity: number
}

export function useMergeCartMutation() {
  const qc = useQueryClient()
  return useMutation<void, Error, MergeItemInput[]>({
    mutationFn: async (items) => {
      if (items.length === 0) return
      const { error } = await api.POST("/api/cart/merge", {
        body: { items },
      })
      if (error) throw new Error(error.detail ?? error.title ?? "Cart merge failed")
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: cartKeys.server() })
    },
  })
}
