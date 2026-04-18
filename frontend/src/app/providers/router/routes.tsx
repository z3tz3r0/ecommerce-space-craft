import type { RouteObject } from "react-router"
import { App } from "@/app/App"
import { HomePage } from "@/pages/home"

export const routes: RouteObject[] = [
  {
    path: "/",
    element: <App />,
    children: [{ index: true, element: <HomePage /> }],
  },
]
