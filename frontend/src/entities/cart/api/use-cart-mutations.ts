import { useMutation, useQueryClient } from "@tanstack/react-query"
import { api, type components } from "@/shared/api"
import { cartKeys } from "./cart-keys"

type ServerCart = components["schemas"]["Cart"]

interface MutationContext {
  prev?: ServerCart
}

export function useAddCartItemMutation() {
  const qc = useQueryClient()
  return useMutation<void, Error, { productId: string; quantity: number }, MutationContext>({
    mutationFn: async ({ productId, quantity }) => {
      const { error } = await api.POST("/api/cart/items", {
        body: { productId, quantity },
      })
      if (error) throw new Error(error.detail ?? error.title ?? "Failed to add to cart")
    },
    onMutate: async ({ productId, quantity }) => {
      await qc.cancelQueries({ queryKey: cartKeys.server() })
      const prev = qc.getQueryData<ServerCart>(cartKeys.server())
      if (prev) {
        const prevItems = prev.items ?? []
        const idx = prevItems.findIndex((i) => i.productId === productId)
        const nextItems =
          idx === -1
            ? [
                ...prevItems,
                // Placeholder for optimistic add — name/price/stock fill in when
                // onSettled triggers a refetch. stockQuantity uses the requested
                // quantity as the upper bound; concurrent adds before settle can
                // clamp against this stale value rather than real stock. Acceptable
                // for the current single-button add UX; revisit if rapid concurrent
                // adds become possible.
                {
                  productId,
                  name: "…",
                  priceCents: 0,
                  imageUrl: undefined,
                  quantity,
                  stockQuantity: quantity,
                },
              ]
            : prevItems.map((i, j) =>
                j === idx
                  ? { ...i, quantity: Math.min(i.stockQuantity, i.quantity + quantity) }
                  : i,
              )
        qc.setQueryData<ServerCart>(cartKeys.server(), { items: nextItems })
      }
      return { prev }
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) qc.setQueryData(cartKeys.server(), context.prev)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: cartKeys.server() })
    },
  })
}

export function useSetCartItemMutation() {
  const qc = useQueryClient()
  return useMutation<void, Error, { productId: string; quantity: number }, MutationContext>({
    mutationFn: async ({ productId, quantity }) => {
      const { error } = await api.PATCH("/api/cart/items/{productId}", {
        params: { path: { productId } },
        body: { quantity },
      })
      if (error) throw new Error(error.detail ?? error.title ?? "Failed to update quantity")
    },
    onMutate: async ({ productId, quantity }) => {
      await qc.cancelQueries({ queryKey: cartKeys.server() })
      const prev = qc.getQueryData<ServerCart>(cartKeys.server())
      if (prev) {
        const prevItems = prev.items ?? []
        const nextItems = prevItems.map((i) =>
          i.productId === productId ? { ...i, quantity: Math.min(i.stockQuantity, quantity) } : i,
        )
        qc.setQueryData<ServerCart>(cartKeys.server(), { items: nextItems })
      }
      return { prev }
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) qc.setQueryData(cartKeys.server(), context.prev)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: cartKeys.server() })
    },
  })
}

export function useRemoveCartItemMutation() {
  const qc = useQueryClient()
  return useMutation<void, Error, { productId: string }, MutationContext>({
    mutationFn: async ({ productId }) => {
      const { error } = await api.DELETE("/api/cart/items/{productId}", {
        params: { path: { productId } },
      })
      if (error) throw new Error(error.detail ?? error.title ?? "Failed to remove item")
    },
    onMutate: async ({ productId }) => {
      await qc.cancelQueries({ queryKey: cartKeys.server() })
      const prev = qc.getQueryData<ServerCart>(cartKeys.server())
      if (prev) {
        const prevItems = prev.items ?? []
        qc.setQueryData<ServerCart>(cartKeys.server(), {
          items: prevItems.filter((i) => i.productId !== productId),
        })
      }
      return { prev }
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) qc.setQueryData(cartKeys.server(), context.prev)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: cartKeys.server() })
    },
  })
}
