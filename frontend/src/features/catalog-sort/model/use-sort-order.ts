import { useCallback } from "react"
import { useQueryParam } from "@/shared/lib/use-query-params"
import { DEFAULT_SORT, isSortOrder, type SortOrder } from "./sort"

export function useSortOrder() {
  const [raw, setRaw] = useQueryParam("sort")
  const value: SortOrder = isSortOrder(raw) ? raw : DEFAULT_SORT

  const setValue = useCallback(
    (next: SortOrder) => {
      if (next === DEFAULT_SORT) {
        setRaw(null)
      } else {
        setRaw(next)
      }
    },
    [setRaw],
  )

  return [value, setValue] as const
}
