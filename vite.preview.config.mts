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
    // Urutannya penting: Vite memakai padanan PERTAMA yang cocok. Kalau "@"
    // ditaruh duluan, ia menang atas seluruh alias yang lebih khusus di
    // bawahnya — dan modul server yang mau dihindari tetap ikut terbawa.
    alias: [
      { find: "next/navigation", replacement: fileURLToPath(new URL("./.preview/next-navigation-stub.ts", import.meta.url)) },
      // Aksi server ditiru: tanpa ini seluruh lapisan server ikut terbawa ke
      // bundel peramban, termasuk modul yang membaca kredensial.
      { find: "@/lib/actions/kpi", replacement: fileURLToPath(new URL("./.preview/kpi-actions-stub.ts", import.meta.url)) },
      { find: "@/lib/data/kpi", replacement: fileURLToPath(new URL("./.preview/data-kpi-stub.ts", import.meta.url)) },
      // Pengunggah menarik `node:crypto` lewat aksi presign. Tanpa tiruan ini
      // seluruh halaman berhenti dirender — kosong, tanpa petunjuk apa pun.
      { find: "@/lib/upload-client", replacement: fileURLToPath(new URL("./.preview/upload-client-stub.ts", import.meta.url)) },
      { find: "server-only", replacement: fileURLToPath(new URL("./src/test/noop.ts", import.meta.url)) },
      { find: /^@\//, replacement: `${fileURLToPath(new URL("./src", import.meta.url))}/` },
    ],
  },
  build: {
    outDir: fileURLToPath(new URL("./.preview/dist", import.meta.url)),
    emptyOutDir: true,
    lib: { entry: fileURLToPath(new URL("./.preview/entry.tsx", import.meta.url)), formats: ["iife"], name: "Preview", fileName: () => "preview.js" },
  },
  // Modul server yang ikut terbawa membaca `process.env`. Di peramban benda
  // itu tidak ada sama sekali, dan yang terjadi bukan nilai kosong melainkan
  // seluruh halaman gagal dirender. Diisi objek kosong: pratinjau memang tidak
  // boleh menyentuh satu pun nilai lingkungan.
  define: { "process.env.NODE_ENV": '"production"', "process.env": "{}" },
});
