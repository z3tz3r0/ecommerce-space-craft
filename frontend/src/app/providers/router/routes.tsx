import type { RouteObject } from "react-router"
import { App } from "@/app/App"
import { CatalogPage } from "@/pages/catalog"
import { HomePage } from "@/pages/home"
import { ProductDetailPage } from "@/pages/product-detail"

export const routes: RouteObject[] = [
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "products", element: <CatalogPage /> },
      { path: "products/:id", element: <ProductDetailPage /> },
    ],
  },
]
