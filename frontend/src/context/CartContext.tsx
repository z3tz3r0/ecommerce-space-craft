import { useState } from "react";
import { CartItem, CartProviderProps } from "../interfaces/Cart";
import { Product } from "../interfaces/Product";
import { CartContext } from "./cartHooks";
import { useSnackbar } from "./snackbarHooks";

export const CartProvider: React.FC<CartProviderProps> = ({ children }) => {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const { showSnackbar } = useSnackbar();

  const addToCart = (product: Product) => {
    let itemAdded = false;
    setCartItems((prevItems) => {
      const existingItem = prevItems.find((item) => item.id === product._id);
      if (existingItem) {
        const newQuantity = Math.min(
          existingItem.quantity + 1,
          product.stockQuantity
        );

        if (newQuantity > existingItem.quantity) {
          return prevItems.map((item) =>
            item.id === product._id ? { ...item, quantity: newQuantity } : item
          );
        }
        return prevItems;
      }
      if (product.stockQuantity > 0) {
        itemAdded = true;
        return [
          ...prevItems,
          {
            id: product._id,
            name: product.name,
            price: product.price,
            imageUrl: product.imageUrl,
            quantity: 1,
            stockQuantity: product.stockQuantity,
          },
        ];
      } else {
        console.warn("Attemped to add out-of-stock item: ", product.name);
        return prevItems;
      }
    });
    console.log("Cart after add: ", cartItems);

    if (itemAdded) {
      showSnackbar({
        message: `${product.name} added to cart`,
        severity: "success",
      });
    } else if (
      product.stockQuantity <=
      (cartItems.find((item) => item.id === product._id)?.quantity ?? 0)
    ) {
      showSnackbar({
        message: `Max quantity for ${product.name} reached`,
        severity: "warning",
      });
    }
  };

  const removeFromCart = (productId: string) => {
    const itemToRemove = cartItems.find((item) => item.id === productId);
    if (itemToRemove) {
      setCartItems((prevItems) =>
        prevItems.filter((item) => item.id !== productId)
      );
      showSnackbar({
        message: `${itemToRemove.name} removed from cart`,
        severity: "info",
      });
    }
  };

  const updateQuantity = (productId: string, quantity: number) => {
    let quantityChanged = false;
    setCartItems((prevItems) => {
      const itemToUpdate = prevItems.find((item) => item.id === productId);
      if (!itemToUpdate) return prevItems;
      const newQuantity = Math.max(
        1,
        Math.min(quantity, itemToUpdate?.stockQuantity || 1)
      );

      if (newQuantity !== itemToUpdate.quantity) {
        quantityChanged = true;
      }

      if (quantity <= 0) {
        quantityChanged = true;
        return prevItems.filter((item) => item.id !== productId);
      }

      return prevItems.map((item) =>
        item.id === productId ? { ...item, quantity: newQuantity } : item
      );
    });

    if (quantityChanged) {
      showSnackbar({ message: `Cart updated`, severity: `success` });
    }
  };

  const clearCart = () => {
    setCartItems([]);
    showSnackbar({ message: `Cart cleared`, severity: "warning" });
  };

  const value = {
    cartItems,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};
