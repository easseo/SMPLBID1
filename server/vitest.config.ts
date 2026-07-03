import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Set env vars before any source module is imported.
    // auth.ts throws at module evaluation if JWT_SECRET is not set.
    env: {
      JWT_SECRET: "test-secret-for-vitest",
      DATABASE_URL: "file:./test.db",
    },
    // Global setup runs once before the whole test suite (push schema, etc.)
    globalSetup: ["./src/test/globalSetup.ts"],
    // Per-file setup runs before each test file (reset tables, stub Socket.IO)
    setupFiles: ["./src/test/setup.ts"],
    // Run test files sequentially so DB resets don't race
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
});
