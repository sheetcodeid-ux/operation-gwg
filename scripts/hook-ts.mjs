/**
 * Hook resolusi untuk `muat-ts.mjs`. Dijalankan di utas pemuat, bukan di utas
 * utama — itu sebabnya ia berkas sendiri.
 *
 * Yang dikerjakan cuma satu: mencoba akhiran berkas yang lazim ketika sebuah
 * specifier tidak bisa diselesaikan apa adanya. Tidak ada transformasi, tidak
 * ada cache, tidak ada tebakan lain.
 */

import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const AKHIRAN = [".ts", ".tsx", "/index.ts", "/index.tsx", ".mjs", ".js"];
const AKAR_SRC = new URL("../src/", import.meta.url);

export async function resolve(specifier, context, next) {
  // `@/x` → `<akar>/src/x`, sama seperti paths di tsconfig.json.
  const spec = specifier.startsWith("@/") ? new URL(specifier.slice(2), AKAR_SRC).href : specifier;

  try {
    return await next(spec, context);
  } catch (galat) {
    if (galat?.code !== "ERR_MODULE_NOT_FOUND") throw galat;
    const dasar = spec.startsWith("file:") ? spec : context.parentURL ? new URL(spec, context.parentURL).href : null;
    if (!dasar) throw galat;
    for (const akhiran of AKHIRAN) {
      const calon = `${dasar}${akhiran}`;
      if (existsSync(fileURLToPath(calon))) return await next(calon, context);
    }
    throw galat;
  }
}

export { pathToFileURL };
