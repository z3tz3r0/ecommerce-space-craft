import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import CartPage from "./pages/CartPage";
import HomePage from "./pages/HomePage";
import ProductDetailPage from "./pages/ProductDetailPage";
import ProductListPage from "./pages/ProductListPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />

        <Route path="products" element={<ProductListPage />} />

        <Route path="products/:productId" element={<ProductDetailPage />} />
        <Route path="cart" element={<CartPage />} />
      </Route>

      {/* <Route path='/login' element={<LoginPage />} */}
    </Routes>
  );
}
