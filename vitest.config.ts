import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // JSX ikut ditransformasi supaya komponen bisa BENAR-BENAR dirender di tes,
  // bukan cuma dibaca sebagai teks. Alasannya mahal: satu kali komponen ikon
  // dikirim sebagai prop dari halaman server ke komponen klien, enam halaman
  // mati di produksi — dan tsc, lint, tes, serta build semuanya hijau, karena
  // tak satu pun dari mereka pernah merender apa pun.
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
    // `server-only` / `client-only` are Next.js build-time guards with no Node
    // resolution; stub them so unit tests can import server modules directly.
    alias: {
      "server-only": new URL("./src/test/noop.ts", import.meta.url).pathname,
      "client-only": new URL("./src/test/noop.ts", import.meta.url).pathname,
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
