export interface ProductSpecs {
  manufacturer: string;
  crewAmount: number;
  maxSpeed: string;
}

export interface Product {
  _id: string; // MondoDB IDs are strings.
  name: string;
  description: string;
  price: number;
  imageUrl?: string;
  specs?: ProductSpecs;
  category: string; // Not an array of string[] because should match enum value ideally.
  stockQuantity: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
