import { useCallback } from "react"
import { useSearchParams } from "react-router"

export function useQueryParam(key: string) {
  const [params, setParams] = useSearchParams()
  const value = params.get(key)

  const setValue = useCallback(
    (next: string | null) => {
      const nextParams = new URLSearchParams(params)
      if (next === null || next === "") {
        nextParams.delete(key)
      } else {
        nextParams.set(key, next)
      }
      setParams(nextParams, { replace: true })
    },
    [key, params, setParams],
  )

  return [value, setValue] as const
}

export function useQueryParamList(key: string) {
  const [params, setParams] = useSearchParams()
  const values = params.getAll(key)

  const setValues = useCallback(
    (next: string[]) => {
      const nextParams = new URLSearchParams(params)
      nextParams.delete(key)
      for (const v of next) {
        nextParams.append(key, v)
      }
      setParams(nextParams, { replace: true })
    },
    [key, params, setParams],
  )

  return [values, setValues] as const
}
