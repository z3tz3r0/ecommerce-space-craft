import { Input } from "@/shared/ui/input"
import { useSearchQuery } from "../model/use-search-query"

export function SearchInput() {
  const { value, setValue } = useSearchQuery()
  return (
    <Input
      type="search"
      placeholder="Search ships…"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      className="w-64"
      aria-label="Search products"
    />
  )
}
