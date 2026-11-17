import { defineConfig } from "vitest/config";

// Vitest yalnızca birim testlerini çalıştırır (tests/unit).
// tests/e2e altındaki Playwright testleri tarayıcı gerektirir; "npm run test:e2e" ile ayrı çalıştırılır.
export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.ts"],
    passWithNoTests: true,
  },
});
