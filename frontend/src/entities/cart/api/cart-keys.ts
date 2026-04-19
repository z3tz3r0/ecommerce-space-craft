export const cartKeys = {
  all: ["cart"] as const,
  server: () => [...cartKeys.all, "server"] as const,
}
