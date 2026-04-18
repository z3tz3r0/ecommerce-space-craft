export type StockStatus = "in" | "low" | "out"

export function stockStatus(quantity: number): StockStatus {
  if (quantity <= 0) return "out"
  if (quantity <= 5) return "low"
  return "in"
}

export function stockLabel(quantity: number): string {
  const status = stockStatus(quantity)
  if (status === "out") return "Out of stock"
  if (status === "low") return `Low stock — ${quantity} left`
  return "In stock"
}
