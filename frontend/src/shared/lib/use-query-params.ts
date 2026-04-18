import { useCallback } from "react"
import { useSearchParams } from "react-router"

export function useQueryParam(key: string) {
  const [params, setParams] = useSearchParams()
  const value = params.get(key)

  const setValue = useCallback(
    (next: string | null) => {
      setParams(
        (prev) => {
          const nextParams = new URLSearchParams(prev)
          if (next === null || next === "") {
            nextParams.delete(key)
          } else {
            nextParams.set(key, next)
          }
          return nextParams
        },
        { replace: true },
      )
    },
    [key, setParams],
  )

  return [value, setValue] as const
}

export function useQueryParamList(key: string) {
  const [params, setParams] = useSearchParams()
  const values = params.getAll(key)

  const setValues = useCallback(
    (next: string[]) => {
      setParams(
        (prev) => {
          const nextParams = new URLSearchParams(prev)
          nextParams.delete(key)
          for (const v of next) {
            nextParams.append(key, v)
          }
          return nextParams
        },
        { replace: true },
      )
    },
    [key, setParams],
  )

  return [values, setValues] as const
}
