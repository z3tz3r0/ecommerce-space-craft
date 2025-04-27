import { Box, Container } from "@mui/material";
import { Outlet, useNavigate } from "react-router-dom";
import { useCart } from "../context/cartHooks";
import Footer from "./Footer";
import NavBar from "./NavBar";

const Layout: React.FC = () => {
  const { cartItems } = useCart();
  const navigate = useNavigate();

  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
      }}
    >
      {/* ------ Top Navigation Bar ------ */}
      <NavBar totalItems={totalItems} navigate={navigate} />

      {/* ------ Main Content Area ------ */}
      <Container component="main" sx={{ my: 4, flexGrow: 1 }}>
        <Outlet />
      </Container>

      {/* ------ Footer ------ */}
      <Footer />
    </Box>
  );
};

export default Layout;
