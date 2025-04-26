import { useState } from "react";
import { CartItem, CartProviderProps } from "../interfaces/Cart";
import { Product } from "../interfaces/Product";
import { CartContext } from "./cartHooks";

export const CartProvider: React.FC<CartProviderProps> = ({ children }) => {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  const addToCart = (product: Product) => {
    setCartItems((prevItem) => {
      const existingItem = prevItem.find((item) => item.id === product._id);

      if (existingItem) {
        const newQuantity = Math.min(
          existingItem.quantity + 1,
          product.stockQuantity
        );
        return prevItem.map((item) =>
          item.id === product._id ? { ...item, quantity: newQuantity } : item
        );
      }
      if (product.stockQuantity > 0) {
        return [
          ...prevItem,
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
        return prevItem;
      }
    });
    console.log("Cart after add: ", cartItems);
  };

  const removeFromCart = (productId: string) => {
    setCartItems((prevItems) =>
      prevItems.filter((item) => item.id !== productId)
    );
    console.log("Cart after remove: ", cartItems);
  };

  const updateQuantity = (productId: string, quantity: number) => {
    setCartItems((prevItems) => {
      const itemToUpdate = prevItems.find((item) => item.id === productId);
      const newQuantity = Math.max(
        1,
        Math.min(quantity, itemToUpdate?.stockQuantity || 1)
      );

      if (quantity <= 0) {
        return prevItems.filter((item) => item.id !== productId);
      }

      return prevItems.map((item) =>
        item.id === productId ? { ...item, quantity: newQuantity } : item
      );
    });
  };

  const clearCart = () => {
    setCartItems([]);
    console.log("Cart cleared");
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
