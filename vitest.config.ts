import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    // `server-only` / `client-only` are Next.js build-time guards with no Node
    // resolution; stub them so unit tests can import server modules directly.
    alias: {
      "server-only": new URL("./src/test/noop.ts", import.meta.url).pathname,
      "client-only": new URL("./src/test/noop.ts", import.meta.url).pathname,
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
