export const productKeys = {
  all: ["products"] as const,
  list: () => [...productKeys.all, "list"] as const,
  detail: (id: string) => [...productKeys.all, "detail", id] as const,
  featured: (limit: number) => [...productKeys.all, "featured", limit] as const,
}
