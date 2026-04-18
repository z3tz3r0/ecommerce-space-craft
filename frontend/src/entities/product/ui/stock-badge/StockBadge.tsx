import { Badge } from "@/shared/ui/badge"
import { stockLabel, stockStatus } from "../../model/stock"

interface StockBadgeProps {
  quantity: number
}

export function StockBadge({ quantity }: StockBadgeProps) {
  const status = stockStatus(quantity)
  const variant = status === "in" ? "default" : status === "low" ? "secondary" : "outline"
  return <Badge variant={variant}>{stockLabel(quantity)}</Badge>
}
