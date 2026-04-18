import { fileURLToPath, URL } from "node:url"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@/app": fileURLToPath(new URL("./src/app", import.meta.url)),
      "@/pages": fileURLToPath(new URL("./src/pages", import.meta.url)),
      "@/widgets": fileURLToPath(new URL("./src/widgets", import.meta.url)),
      "@/features": fileURLToPath(new URL("./src/features", import.meta.url)),
      "@/entities": fileURLToPath(new URL("./src/entities", import.meta.url)),
      "@/shared": fileURLToPath(new URL("./src/shared", import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/shared/lib/test-setup.ts"],
    css: true,
  },
})
