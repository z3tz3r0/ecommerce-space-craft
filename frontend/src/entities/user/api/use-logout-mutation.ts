import { useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/shared/api"
import { userKeys } from "./user-keys"

export function useLogoutMutation() {
  const qc = useQueryClient()
  return useMutation<void, Error>({
    mutationFn: async () => {
      const { error } = await api.POST("/api/auth/logout")
      if (error) {
        throw new Error(error.detail ?? error.title ?? "Logout failed")
      }
    },
    onSuccess: () => {
      qc.removeQueries({ queryKey: userKeys.me() })
      // Cart queries are invalidated by the cart slice's own wiring.
    },
  })
}
