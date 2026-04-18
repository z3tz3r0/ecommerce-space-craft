import { useCallback, useMemo } from "react"
import { CATEGORIES, type Category } from "@/entities/product"
import { useQueryParamList } from "@/shared/lib/use-query-params"

const ALLOWED = new Set<string>(CATEGORIES)

export function useCategoryFilter() {
  const [raw, setRaw] = useQueryParamList("category")

  const selected = useMemo(() => raw.filter((v): v is Category => ALLOWED.has(v)), [raw])

  const toggle = useCallback(
    (cat: Category) => {
      const set = new Set(selected)
      if (set.has(cat)) set.delete(cat)
      else set.add(cat)
      setRaw(Array.from(set))
    },
    [selected, setRaw],
  )

  const clear = useCallback(() => setRaw([]), [setRaw])

  const isSelected = useCallback((cat: Category) => selected.includes(cat), [selected])

  return { selected, toggle, clear, isSelected }
}
