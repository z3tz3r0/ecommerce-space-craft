import createClient from "openapi-fetch"
import type { paths } from "./generated/types"
import { env } from "@/shared/config/env"

export const api = createClient<paths>({
  baseUrl: env.apiUrl,
  credentials: "include",
})
