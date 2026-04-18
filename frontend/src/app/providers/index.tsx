import { StrictMode } from "react"
import { QueryProvider } from "./query"
import { RouterProvider } from "./router"

export function Providers() {
  return (
    <StrictMode>
      <QueryProvider>
        <RouterProvider />
      </QueryProvider>
    </StrictMode>
  )
}
