/**
 * Pembuka jalan supaya Node bisa mengimpor modul TypeScript proyek ini apa
 * adanya — tanpa membangun apa pun lebih dulu.
 *
 * Node memakai resolusi ESM yang menuntut akhiran berkas ditulis lengkap
 * (`./kelengkapan.ts`), sementara proyek ini memakai resolusi ala bundler
 * (`./kelengkapan`) seperti Next.js dan vitest. Hook di bawah menambalkan
 * selisih itu: kalau sebuah specifier relatif tidak ketemu, dicoba lagi dengan
 * `.ts`, `.tsx`, dan bentuk `index`-nya.
 *
 * KENAPA REPOT-REPOT. Supaya skrip rekonsiliasi menjalankan KODE YANG SAMA
 * dengan yang dipakai aplikasi — `sales-fact.ts`, `kpi-sales.ts`,
 * `target-sales.ts` yang itu juga, bukan salinannya. Salinan yang dibuat khusus
 * untuk pengujian membuktikan salinannya benar, bukan kodenya.
 *
 * Alias `@/` ikut dipetakan ke `src/`, sama seperti `tsconfig.json`.
 *
 * Dipakai lewat `node --experimental-strip-types --import ./scripts/muat-ts.mjs`,
 * dan hanya oleh skrip. Bukan bagian dari build, bukan bagian dari runtime
 * aplikasi.
 */

import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("./hook-ts.mjs", pathToFileURL(`${import.meta.dirname}/`));
