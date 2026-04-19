import { useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/shared/api"
import type { User } from "../model/types"
import { userKeys } from "./user-keys"

export function useLoginMutation() {
  const qc = useQueryClient()
  return useMutation<User, Error, { email: string; password: string }>({
    mutationFn: async ({ email, password }) => {
      const { data, error } = await api.POST("/api/auth/login", {
        body: { email, password },
      })
      if (error) {
        throw new Error(error.detail ?? error.title ?? "Login failed")
      }
      if (!data) {
        throw new Error("auth: empty response from /api/auth/login")
      }
      return data
    },
    onSuccess: (user) => {
      qc.setQueryData(userKeys.me(), user)
    },
  })
}
