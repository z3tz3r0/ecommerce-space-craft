import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import List from "@mui/material/List";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import React from "react";
// import { useNavigate } from "react-router-dom";
import CartItem from "../components/CartItem";
import EmptyCartView from "../components/EmptyCartView";
import { useCart } from "../context/cartHooks";

const CartPage: React.FC = () => {
  const { cartItems, removeFromCart, updateQuantity, clearCart } = useCart();
  // const navigate = useNavigate();

  // Calculate Total Price
  const totalPrice = cartItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  // Handle for quantity change
  const handleQuantityChange = (
    productId: string,
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const newQuantity = parseInt(event.target.value, 10) || 1;
    updateQuantity(productId, newQuantity);
  };

  if (cartItems.length === 0) {
    return <EmptyCartView />;
  }

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Your Shopping Cart
      </Typography>
      <Paper elevation={2} sx={{ mb: 3 }}>
        <List>
          {cartItems.map((item) => (
            <CartItem
              product={item}
              removeFromCart={removeFromCart}
              handleQuantityChange={handleQuantityChange}
            />
          ))}
        </List>
      </Paper>

      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mt: 3,
        }}
      >
        <Button variant="outlined" color="error" onClick={clearCart}>
          Clear Cart
        </Button>
        <Box sx={{ textAlign: "right" }}>
          <Typography variant="h5" component="p">
            Total:{" "}
            {new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: "USD",
            }).format(totalPrice)}
          </Typography>
          <Button
            variant="contained"
            color="primary"
            size="large"
            sx={{ mt: 1 }}
            disabled={cartItems.length === 0}
            // onClick={() => navigate('/checkout')}
          >
            Proceed to Checkout
          </Button>
        </Box>
      </Box>
    </Container>
  );
};

export default CartPage;
