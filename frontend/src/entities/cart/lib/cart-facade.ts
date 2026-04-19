import { useCallback } from "react"
import { useAuth } from "@/entities/user/@x/cart"
import {
  useAddCartItemMutation,
  useRemoveCartItemMutation,
  useServerCart,
  useSetCartItemMutation,
} from "../api"
import { useGuestCartStore } from "../model/guest-store"
import { subtotalCents } from "../model/subtotal"
import type { CartItem } from "../model/types"

interface UseCartResult {
  items: CartItem[]
  isLoading: boolean
  add: (input: AddInput) => Promise<void>
  set: (productId: string, quantity: number) => Promise<void>
  remove: (productId: string) => Promise<void>
  subtotalCents: number
}

interface AddInput {
  productId: string
  name: string
  priceCents: number
  imageUrl?: string | null
  stockQuantity: number
  quantity?: number
}

// useCart is the single hook downstream UI consumes. Internally it routes
// to the zustand guest store when the user is unauthenticated (or auth is
// still loading on first mount) and to the server cart + mutations when
// authenticated.
export function useCart(): UseCartResult {
  const auth = useAuth()
  const authed = auth.isSuccess
  const guestItems = useGuestCartStore((s) => s.items)
  const guestAdd = useGuestCartStore((s) => s.add)
  const guestSet = useGuestCartStore((s) => s.set)
  const guestRemove = useGuestCartStore((s) => s.remove)
  const serverQuery = useServerCart({ enabled: authed })
  const addMut = useAddCartItemMutation()
  const setMut = useSetCartItemMutation()
  const removeMut = useRemoveCartItemMutation()

  const items: CartItem[] = auth.isLoading
    ? []
    : authed
      ? (serverQuery.data?.items ?? []).map((i) => ({
          productId: i.productId,
          name: i.name,
          priceCents: i.priceCents,
          imageUrl: i.imageUrl,
          quantity: i.quantity,
          stockQuantity: i.stockQuantity,
        }))
      : guestItems.map((i) => ({ ...i }))

  const isLoading = auth.isLoading || (authed && serverQuery.isLoading)

  const add = useCallback(
    async (input: AddInput) => {
      if (authed) {
        await addMut.mutateAsync({
          productId: input.productId,
          quantity: input.quantity ?? 1,
        })
        return
      }
      guestAdd({
        productId: input.productId,
        name: input.name,
        priceCents: input.priceCents,
        imageUrl: input.imageUrl ?? undefined,
        stockQuantity: input.stockQuantity,
        quantity: input.quantity,
      })
    },
    [addMut, authed, guestAdd],
  )

  const set = useCallback(
    async (productId: string, quantity: number) => {
      if (authed) {
        if (quantity < 1) {
          await removeMut.mutateAsync({ productId })
        } else {
          await setMut.mutateAsync({ productId, quantity })
        }
        return
      }
      guestSet(productId, quantity)
    },
    [authed, guestSet, removeMut, setMut],
  )

  const remove = useCallback(
    async (productId: string) => {
      if (authed) {
        await removeMut.mutateAsync({ productId })
        return
      }
      guestRemove(productId)
    },
    [authed, guestRemove, removeMut],
  )

  return {
    items,
    isLoading,
    add,
    set,
    remove,
    subtotalCents: subtotalCents(items),
  }
}
