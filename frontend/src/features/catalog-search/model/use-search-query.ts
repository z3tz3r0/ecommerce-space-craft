import { useCallback, useEffect, useRef, useState } from "react"
import { useQueryParam } from "@/shared/lib/use-query-params"

const DEBOUNCE_MS = 300

export function useSearchQuery() {
  const [committedRaw, setCommittedRaw] = useQueryParam("q")
  const committed = committedRaw ?? ""
  const [value, setLocalValue] = useState(committed)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Keep local in sync if URL changes externally (e.g., back button).
  useEffect(() => {
    setLocalValue(committed)
  }, [committed])

  const setValue = useCallback(
    (next: string) => {
      setLocalValue(next)
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        setCommittedRaw(next === "" ? null : next)
      }, DEBOUNCE_MS)
    },
    [setCommittedRaw],
  )

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return { value, committed, setValue }
}
