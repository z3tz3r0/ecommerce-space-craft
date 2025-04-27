import { Product } from "../interfaces/Product";

const BASE_URL = import.meta.env.VITE_API_URL;

const handleResponse = async <T>(response: Response): Promise<T> => {
  if (response.status === 404) {
    throw new Error("Not Found");
  }
  if (!response.ok) {
    let errorMessage = `API request failed: ${response.statusText} (Status: ${response.status})`;
    try {
      const errorBody = await response.json();
      errorMessage = errorBody.message || errorMessage;
    } catch (error) {
      throw new Error(`${errorMessage} with this ${error}`);
    }
  }
  return response.json() as Promise<T>;
};

export const getAllProducts = async (): Promise<Product[]> => {
  const response = await fetch(`${BASE_URL}/api/products`);
  return handleResponse<Product[]>(response);
};

export const getProductById = async (productId: string): Promise<Product> => {
  const response = await fetch(`${BASE_URL}/api/products/${productId}`);
  return handleResponse<Product>(response);
};
