import type { RouteObject } from "react-router"
import { HomePage } from "@/pages/home"
import { App } from "@/app/App"

export const routes: RouteObject[] = [
  {
    path: "/",
    element: <App />,
    children: [{ index: true, element: <HomePage /> }],
  },
]
