import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/** DB-backed tests. Run with `npm run test:db`; they only ever touch the separate `*_test` database. */
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "node",
    include: ["tests/db/**/*.db.test.ts"],
    globalSetup: ["./tests/db/global-setup.ts"],
    setupFiles: ["./tests/db/setup.ts"],
    // One shared database: files run one after another, in a single process.
    fileParallelism: false,
    pool: "forks",
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
