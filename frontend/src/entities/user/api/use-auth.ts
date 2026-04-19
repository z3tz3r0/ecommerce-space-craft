import { useQuery } from "@tanstack/react-query"
import { api } from "@/shared/api"
import type { User } from "../model/types"
import { userKeys } from "./user-keys"

// useAuth returns the currently authenticated user. A 401 from the backend
// surfaces as isError=true and data=undefined; callers use isError as the
// "logged out" signal rather than a sentinel error value.
export function useAuth() {
  return useQuery<User>({
    queryKey: userKeys.me(),
    retry: false,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await api.GET("/api/auth/me")
      if (error) {
        throw error
      }
      if (!data) {
        throw new Error("auth: empty response from /api/auth/me")
      }
      return data
    },
  })
}
