import { Route, Routes } from "react-router-dom";
import Layout from "./assets/Layout";
import ProductListPage from "./components/ProductListPage";

export default function App() {
    return (
        <Routes>
            <Route path="/" element={<Layout />}>
                {/* <Route index element={<HomePage />} /> */}
                <Route index element={<div>Home page placeholder</div>} />

                <Route path="products" element={<ProductListPage />} />

                {/* <Route path="products/:productId" element={<ProductDetailPage />} /> */}
                <Route
                    path="products/:productId"
                    element={<div>Product Detail Page placeholder</div>}
                />
            </Route>

            {/* <Route path='/login' element={<LoginPage />} */}
        </Routes>
    );
}
