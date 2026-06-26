import { defineConfig } from "vitest/config";

// Separate from vite.config.ts: the Cloudflare plugin's dev-server hooks don't
// run under vitest, so we keep unit tests on a plain node environment. These
// tests cover pure logic (pricing, aggregation) — no Workers runtime needed.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
