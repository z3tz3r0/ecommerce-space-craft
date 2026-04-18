import { describe, it, expect, vi, afterEach } from "vitest"

describe("env", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it("returns the configured VITE_API_URL", async () => {
    vi.stubEnv("VITE_API_URL", "https://example.test")
    const { env } = await import("./env")
    expect(env.apiUrl).toBe("https://example.test")
  })

  it("throws when VITE_API_URL is missing", async () => {
    vi.stubEnv("VITE_API_URL", "")
    await expect(import("./env")).rejects.toThrow(/VITE_API_URL/)
  })
})
