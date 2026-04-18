import { describe, expect, it } from "vitest"
import type { Product } from "@/entities/product"
import { type SortOrder, sortProducts } from "./sort"

type TestProduct = Pick<Product, "priceCents" | "createdAt"> & { id: string }

const products: TestProduct[] = [
  { id: "a", priceCents: 200, createdAt: "2026-04-10T00:00:00Z" },
  { id: "b", priceCents: 300, createdAt: "2026-04-12T00:00:00Z" },
  { id: "c", priceCents: 100, createdAt: "2026-04-11T00:00:00Z" },
]

describe("sortProducts", () => {
  it("sorts by newest (createdAt DESC) by default", () => {
    expect(sortProducts(products, "newest").map((p) => p.id)).toEqual(["b", "c", "a"])
  })

  it("sorts by price ascending", () => {
    expect(sortProducts(products, "price-asc").map((p) => p.id)).toEqual(["c", "a", "b"])
  })

  it("sorts by price descending", () => {
    expect(sortProducts(products, "price-desc").map((p) => p.id)).toEqual(["b", "a", "c"])
  })

  it("does not mutate the input array", () => {
    const input = [...products]
    const orig = input.map((p) => p.id)
    sortProducts(input, "price-asc")
    expect(input.map((p) => p.id)).toEqual(orig)
  })

  it("handles empty array", () => {
    expect(sortProducts([], "newest")).toEqual([])
  })

  const allOrders: SortOrder[] = ["newest", "price-asc", "price-desc"]
  for (const order of allOrders) {
    it(`returns same length for sort=${order}`, () => {
      expect(sortProducts(products, order)).toHaveLength(3)
    })
  }
})
