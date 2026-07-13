import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    env: {
      // The real @workspace/db module throws at import time unless DATABASE_URL
      // is set. Tests mock the module, but provide a dummy value as a safety net.
      DATABASE_URL: "postgres://test:test@localhost:5432/test",
    },
  },
});
