import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { GuestCartItem } from "./types"

interface GuestCartState {
  items: GuestCartItem[]
  add: (item: Omit<GuestCartItem, "quantity"> & { quantity?: number }) => void
  set: (productId: string, quantity: number) => void
  remove: (productId: string) => void
  clear: () => void
}

export const useGuestCartStore = create<GuestCartState>()(
  persist(
    (setState) => ({
      items: [],
      add: (input) => {
        const incoming = input.quantity ?? 1
        setState((state) => {
          const idx = state.items.findIndex((i) => i.productId === input.productId)
          if (idx === -1) {
            const clamped = Math.min(incoming, input.stockQuantity)
            if (clamped < 1) return state
            return {
              items: [
                ...state.items,
                {
                  productId: input.productId,
                  name: input.name,
                  priceCents: input.priceCents,
                  imageUrl: input.imageUrl ?? undefined,
                  stockQuantity: input.stockQuantity,
                  quantity: clamped,
                },
              ],
            }
          }
          const next = [...state.items]
          const existing = next[idx]
          const nextQty = Math.min(existing.quantity + incoming, input.stockQuantity)
          if (nextQty < 1) {
            return { items: state.items.filter((i) => i.productId !== input.productId) }
          }
          next[idx] = { ...existing, stockQuantity: input.stockQuantity, quantity: nextQty }
          return { items: next }
        })
      },
      set: (productId, quantity) => {
        setState((state) => {
          const idx = state.items.findIndex((i) => i.productId === productId)
          if (idx === -1) return state
          if (quantity < 1) {
            return { items: state.items.filter((i) => i.productId !== productId) }
          }
          const next = [...state.items]
          const existing = next[idx]
          const nextQty = Math.min(quantity, existing.stockQuantity)
          if (nextQty < 1) {
            return { items: state.items.filter((i) => i.productId !== productId) }
          }
          next[idx] = { ...existing, quantity: nextQty }
          return { items: next }
        })
      },
      remove: (productId) => {
        setState((state) => ({ items: state.items.filter((i) => i.productId !== productId) }))
      },
      clear: () => setState({ items: [] }),
    }),
    { name: "guest-cart" },
  ),
)
