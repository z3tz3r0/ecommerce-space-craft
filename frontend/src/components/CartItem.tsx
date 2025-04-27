import { Delete } from "@mui/icons-material";
import {
  Avatar,
  Divider,
  IconButton,
  ListItem,
  ListItemAvatar,
  ListItemText,
  TextField,
} from "@mui/material";
import React from "react";
import { CartItem as CartItemInterface } from "../interfaces/Cart";

interface CartItemProps {
  product: CartItemInterface;
  removeFromCart: (productId: string) => void;
  handleQuantityChange: (
    productId: string,
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => void;
}

const CartItem: React.FC<CartItemProps> = ({
  product,
  removeFromCart,
  handleQuantityChange,
}) => {
  return (
    <React.Fragment>
      <ListItem
        secondaryAction={
          <IconButton
            edge="end"
            aria-label="delete"
            onClick={() => removeFromCart(product.id)}
          >
            <Delete />
          </IconButton>
        }
      >
        <ListItemAvatar>
          <Avatar
            variant="square"
            src={product.imageUrl || "https://placehold.co/60x60?text=N/A"}
            alt={product.name}
            sx={{ width: 60, height: 60, mr: 2 }}
          />
        </ListItemAvatar>
        <ListItemText
          primary={product.name}
          secondary={`Price: ${new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            maximumSignificantDigits: 3,
          }).format(product.price)}`}
        />
        <TextField
          type="number"
          label="Qty"
          value={product.quantity}
          onChange={(e) => handleQuantityChange(product.id, e)}
          size="small"
          slotProps={{
            htmlInput: {
              "min": 1,
              "max": product.stockQuantity,
              "aria-label": `Quantity for ${product.name}`,
            },
          }}
          sx={{ width: "80px", mx: 2 }}
        />
      </ListItem>
      <Divider variant="inset" component="li" />
    </React.Fragment>
  );
};

export default CartItem;
