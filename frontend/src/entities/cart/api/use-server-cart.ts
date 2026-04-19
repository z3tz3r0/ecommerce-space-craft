import { useQuery } from "@tanstack/react-query"
import { api, type components } from "@/shared/api"
import { cartKeys } from "./cart-keys"

type ServerCart = components["schemas"]["Cart"]

// useServerCart fetches the authenticated user's cart from the backend.
// The caller MUST gate the call with `enabled` — typically bound to
// `useAuth().isSuccess` via the cart facade.
export function useServerCart(options: { enabled: boolean }) {
  return useQuery<ServerCart>({
    queryKey: cartKeys.server(),
    enabled: options.enabled,
    retry: false,
    queryFn: async () => {
      const { data, error } = await api.GET("/api/cart")
      if (error) throw new Error(error.detail ?? error.title ?? "Failed to load cart")
      if (!data) throw new Error("cart: empty response from /api/cart")
      return data
    },
  })
}
