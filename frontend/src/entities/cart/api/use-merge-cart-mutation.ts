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
      // Invalidates even when mutationFn early-returned for empty input.
      // The redundant refetch on no-op merge is benign (login already triggers
      // its own /me query); keeping the invalidation unconditional avoids the
      // trap of moving it into a success branch and silently breaking the
      // real-merge path.
      qc.invalidateQueries({ queryKey: cartKeys.server() })
    },
  })
}
