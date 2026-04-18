import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select"
import { SORT_LABELS, SORT_ORDERS, type SortOrder } from "../model/sort"
import { useSortOrder } from "../model/use-sort-order"

export function SortDropdown() {
  const [value, setValue] = useSortOrder()
  return (
    <Select value={value} onValueChange={(v) => setValue(v as SortOrder)}>
      <SelectTrigger className="w-48">
        <SelectValue placeholder="Sort by" />
      </SelectTrigger>
      <SelectContent>
        {SORT_ORDERS.map((order) => (
          <SelectItem key={order} value={order}>
            {SORT_LABELS[order]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
