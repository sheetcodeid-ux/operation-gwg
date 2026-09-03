/**
 * Pratinjau komponen — BUKAN bagian aplikasi.
 *
 * Membangun satu berkas JS berisi komponen sungguhan supaya bisa dibuka di
 * peramban tanpa menjalankan Next dan tanpa perlu masuk akun. Gunanya satu:
 * memeriksa tampilan sebelum dipasang, dan mengirim tangkapan layarnya lebih
 * dulu. Lihat `.preview/README.md`.
 */
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "next/navigation": fileURLToPath(new URL("./.preview/next-navigation-stub.ts", import.meta.url)),
    },
  },
  build: {
    outDir: fileURLToPath(new URL("./.preview/dist", import.meta.url)),
    emptyOutDir: true,
    lib: { entry: fileURLToPath(new URL("./.preview/entry.tsx", import.meta.url)), formats: ["iife"], name: "Preview", fileName: () => "preview.js" },
  },
  define: { "process.env.NODE_ENV": '"production"' },
});
