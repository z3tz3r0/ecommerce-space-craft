import type { components } from "@/shared/api"

// Server-side cart item shape, defined by the backend OpenAPI.
export type ServerCartItem = components["schemas"]["Item"]

// Guest cart item — shape captured at add-time into localStorage. The
// StockQuantity is a snapshot; the server refreshes it on the next fetch.
export interface GuestCartItem {
  productId: string
  name: string
  priceCents: number
  imageUrl?: string | null
  quantity: number
  stockQuantity: number
}

// Unified cart item shape consumed by UI. Both guest and server items
// coerce to this.
export interface CartItem {
  productId: string
  name: string
  priceCents: number
  imageUrl?: string | null
  quantity: number
  stockQuantity: number
}
