import type { Product } from "./types"

export const CATEGORIES = [
  "Fighter",
  "Freighter",
  "Shuttle",
  "Speeder",
  "Cruiser",
  "Capital Ship",
] as const satisfies readonly Product["category"][]

export type Category = (typeof CATEGORIES)[number]
