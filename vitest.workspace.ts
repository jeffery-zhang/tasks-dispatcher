import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    pool: "forks",
    maxWorkers: 1,
    minWorkers: 1,
    environment: "node",
    include: [
      "packages/core/tests/**/*.test.ts",
      "packages/workspace-runtime/tests/**/*.test.ts",
      "apps/cli/tests/**/*.test.ts",
      "apps/desktop/src/renderer/__tests__/**/*.test.tsx",
      "apps/desktop/src/main/__tests__/**/*.test.ts"
    ]
  }
});
