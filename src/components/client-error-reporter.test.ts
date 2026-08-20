import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SUMBER = readFileSync(join(process.cwd(), "src/components/client-error-reporter.tsx"), "utf8");

/**
 * Catatan galat hanya berguna kalau isinya benar-benar galat.
 *
 * `redirect()` dan `notFound()` di Next.js bekerja dengan MELEMPAR
 * pengecualian. Setiap kali sebuah halaman mengalihkan pengunjung — izin
 * kurang, sesi habis, halaman pindah — peramban melihatnya sebagai galat
 * bernama NEXT_REDIRECT dan melaporkannya.
 *
 * Pada pemakaian normal itu terjadi puluhan kali sehari. Kalau ikut dicatat,
 * kerusakan sungguhan tenggelam di antaranya, dan orang berhenti membuka
 * catatan itu sama sekali — persis kebalikan dari gunanya.
 */
describe("pelapor galat klien", () => {
  it("mengenali alur kendali Next sebagai bukan galat", () => {
    for (const kunci of ["NEXT_REDIRECT", "NEXT_NOT_FOUND"]) {
      expect(SUMBER, `${kunci} harus ikut disaring`).toContain(kunci);
    }
  });

  it("penyaringnya dipakai di jalur otomatis maupun jalur layar galat", () => {
    // Dua pintu masuk, dan keduanya harus disaring: penangkap
    // window.onerror/unhandledrejection lewat `kirim`, dan `laporkanGalat`
    // yang dipanggil layar galat React. Menyaring salah satu saja
    // meninggalkan separuh kebisingannya.
    expect(SUMBER, "jalur penangkap otomatis").toContain("if (alurKendali(message)) return;");
    expect(SUMBER, "jalur layar galat React").toMatch(/laporkanGalat[\s\S]*alurKendali\(/);
  });

  it("penyaringan terjadi SEBELUM pengiriman, bukan sesudah", () => {
    const iSaring = SUMBER.indexOf("if (alurKendali(message)) return;");
    const iKirim = SUMBER.indexOf("sendBeacon");
    expect(iSaring).toBeGreaterThan(0);
    expect(iSaring, "saringan harus mendahului pengiriman").toBeLessThan(iKirim);
  });
});
