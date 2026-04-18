import createClient from "openapi-fetch"
import { env } from "@/shared/config/env"
import type { paths } from "./generated/types"

export const api = createClient<paths>({
  baseUrl: env.apiUrl,
  credentials: "include",
})
