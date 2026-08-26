import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isChunkLoadError, isGalatUrutanHook, isVersiBasi } from "./chunk-recovery";

/**
 * React #310 di produksi, dan mengapa dua tebakan sebelumnya meleset.
 *
 * Jejak minifikasinya, setelah dipetakan ke chunk produksi, berhenti di:
 *
 *     function L({ actionQueue, globalError, webSocket, staticIndicatorState }) {
 *       let s = useActionQueue(e), { canonicalUrl: d } = s,
 *           { searchParams, pathname } = useMemo(() => { … }, [d]);
 *
 * Itu Router App milik Next SENDIRI, bukan komponen mana pun milik kita. Yang
 * menjelaskan tiga hal sekaligus: mengapa pemeriksa aturan hook tidak
 * menemukan apa-apa di kode kita (memang tidak ada), mengapa halaman yang
 * sama sekali tidak berhubungan ikut kena, dan mengapa melepas tiga komponen
 * antrian dari React Compiler tidak mengubah apa pun.
 *
 * Karena akarnya di hulu, yang bisa dikerjakan bukan mencegahnya melainkan
 * berhenti meninggalkan orang di layar mati. Itu yang dikunci di sini.
 */

describe("galat urutan hook dikenali", () => {
  it("mengenali pesan produksi yang diminifikasi", () => {
    for (const kode of ["#300", "#301", "#310"]) {
      const e = new Error(`Minified React error ${kode}; visit https://react.dev/errors/${kode.slice(1)}`);
      expect(isGalatUrutanHook(e), kode).toBe(true);
    }
  });

  it("mengenali kalimat lengkapnya di mode pengembangan", () => {
    expect(isGalatUrutanHook(new Error("Rendered more hooks than during the previous render."))).toBe(true);
  });

  it("BUKAN versi basi — sebabnya berbeda, dan menyebutnya begitu menyesatkan", () => {
    // Keduanya sama-sama dipulihkan dengan muat ulang, tapi yang dibaca orang
    // di layar harus jujur: ini bukan "aplikasi baru saja diperbarui".
    const e = new Error("Minified React error #310; visit https://react.dev/errors/310");
    expect(isGalatUrutanHook(e)).toBe(true);
    expect(isVersiBasi(e)).toBe(false);
    expect(isChunkLoadError(e)).toBe(false);
  });

  it("galat biasa tidak ikut terseret", () => {
    expect(isGalatUrutanHook(new Error("Cabang di luar cakupan Anda."))).toBe(false);
    expect(isGalatUrutanHook(new Error("Minified React error #418"))).toBe(false);
    expect(isGalatUrutanHook(null)).toBe(false);
  });
});

describe("halaman yang mogok dipulihkan, bukan ditinggal", () => {
  const RECOVERY = readFileSync(join(process.cwd(), "src/lib/chunk-recovery.ts"), "utf8");
  const BATAS = readFileSync(join(process.cwd(), "src/app/(app)/error.tsx"), "utf8");
  const AKAR = readFileSync(join(process.cwd(), "src/app/global-error.tsx"), "utf8");

  it("muat ulang keras mencakup kedua kelas galat", () => {
    const fn = RECOVERY.slice(RECOVERY.indexOf("export function recoverFromChunkError"));
    expect(fn).toContain("isGalatUrutanHook(error)");
    expect(fn).toContain("isVersiBasi(error)");
  });

  it("penjaga anti-putar tetap ada — muat ulang yang berputar lebih buruk", () => {
    const fn = RECOVERY.slice(RECOVERY.indexOf("export function recoverFromChunkError"));
    expect(fn).toContain("RELOAD_COOLDOWN_MS");
  });

  it("batas galat menyebut sebabnya dengan jujur, bukan menuduh versi lama", () => {
    expect(BATAS).toContain("isGalatUrutanHook");
    expect(BATAS).toContain("Memulihkan halaman…");
    // "Aplikasi baru saja diperbarui" hanya boleh untuk kasus chunk.
    const potongan = BATAS.slice(BATAS.indexOf("{chunk"), BATAS.indexOf("{error.digest"));
    expect(potongan).toContain("hook");
  });

  it("batas akar ikut memulihkan, karena #310 bisa lolos ke root layout", () => {
    expect(AKAR).toMatch(/Minified React error #3\(00\|01\|10\)/);
  });
});

describe("tidak ada lagi komponen yang dilepas dari React Compiler", () => {
  it('"use no memo" sudah dicabut — teorinya salah dan biayanya nyata', () => {
    // Tiga komponen antrian sempat dilepas atas dugaan kompilernya yang salah.
    // Setelah dipasang, #310 tetap terjadi enam kali — termasuk di halaman yang
    // tidak punya arahan itu sama sekali. Dibiarkan, ia hanya mematikan
    // optimasi pada tiga komponen terberat tanpa menukar apa pun.
    for (const f of [
      "src/components/system/helpdesk-panel.tsx",
      "src/components/system/system-review.tsx",
      "src/components/system/helpdesk-tabel.tsx",
    ]) {
      expect(readFileSync(join(process.cwd(), f), "utf8"), f).not.toContain("use no memo");
    }
  });
});
