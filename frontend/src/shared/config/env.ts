const apiUrl = import.meta.env.VITE_API_URL

if (!apiUrl) {
  throw new Error("VITE_API_URL is not set — check frontend/.env and Vercel project env vars")
}

export const env = {
  apiUrl,
} as const
