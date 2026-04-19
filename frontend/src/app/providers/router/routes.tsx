import type { RouteObject } from "react-router"
import { App } from "@/app/App"
import { AccountPage } from "@/pages/account"
import { CartPage } from "@/pages/cart"
import { CatalogPage } from "@/pages/catalog"
import { HomePage } from "@/pages/home"
import { LoginPage } from "@/pages/login"
import { ProductDetailPage } from "@/pages/product-detail"
import { SignupPage } from "@/pages/signup"

export const routes: RouteObject[] = [
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "products", element: <CatalogPage /> },
      { path: "products/:id", element: <ProductDetailPage /> },
      { path: "cart", element: <CartPage /> },
      { path: "login", element: <LoginPage /> },
      { path: "signup", element: <SignupPage /> },
      { path: "account", element: <AccountPage /> },
    ],
  },
]
