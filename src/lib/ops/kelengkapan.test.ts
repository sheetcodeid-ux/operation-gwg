import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { nilaiKelengkapan, wajibPasangan, type AmbangKelengkapan } from "./kelengkapan";
import type { FaktaPenjualan } from "./sales-fact";

/**
 * GERBANG KELENGKAPAN — yang diuji di sini PEMBEDAAN EMPAT KEADAAN.
 *
 * "Nol jualan" dan "data belum ada" terlihat sama di layar kalau keduanya
 * ditulis 0. Yang pertama menuntut tindakan sekarang; yang kedua menuntut
 * menunggu cron. Menyamakannya membuat setengah tindakan operasional diarahkan
 * ke masalah yang salah.
 */

const ambang = (persen: number): AmbangKelengkapan => ({ persen, sumber: "parameter" });

const fakta = (n: number, net = 1_000): FaktaPenjualan[] =>
  Array.from({ length: n }, (_, i) => ({
    outletId: `o${(i % 3) + 1}`,
    branch: `b${(i % 3) + 1}`,
    tanggal: `2026-08-${String((i % 28) + 1).padStart(2, "0")}`,
    net,
    gross: null,
    pax: null,
    bills: null,
  }));

describe("empat keadaan yang harus dibedakan", () => {
  it("LENGKAP — mencapai ambang", () => {
    const h = nilaiKelengkapan({ wajib: 100, fakta: fakta(96), ambang: ambang(95) });
    expect(h.status).toBe("lengkap");
    expect(h.bolehDinilai).toBe(true);
    expect(h.persen).toBe(96);
  });

  it("TIDAK LENGKAP — ada datanya, belum sampai ambang", () => {
    const h = nilaiKelengkapan({ wajib: 100, fakta: fakta(80), ambang: ambang(95) });
    expect(h.status).toBe("tidak_lengkap");
    expect(h.bolehDinilai).toBe(false);
    expect(h.hilang).toBe(20);
    expect(h.alasan).toContain("20 dari 100");
  });

  it("TIDAK TERSEDIA — tidak ada satu baris pun", () => {
    const h = nilaiKelengkapan({ wajib: 100, fakta: [], ambang: ambang(95) });
    expect(h.status).toBe("tidak_tersedia");
    expect(h.bolehDinilai).toBe(false);
    expect(h.hilang).toBe(100);
    // Kalimatnya menyebut bedanya dari nol jualan — supaya yang membacanya
    // tidak menyimpulkan outletnya sepi.
    expect(h.alasan).toContain("bukan nol jualan");
  });

  it("INVALID — ada barisnya, sebagiannya tidak bisa dipercaya", () => {
    const h = nilaiKelengkapan({ wajib: 100, fakta: fakta(97), cacat: 3, ambang: ambang(95) });
    expect(h.status).toBe("invalid");
    expect(h.bolehDinilai).toBe(false);
    expect(h.cacat).toBe(3);
  });

  it("INVALID mengalahkan persentase yang sudah cukup", () => {
    // Angka yang salah lebih berbahaya daripada angka yang tidak ada: yang
    // tidak ada masih kelihatan tidak ada.
    const h = nilaiKelengkapan({ wajib: 100, fakta: fakta(99), cacat: 1, ambang: ambang(50) });
    expect(h.persen).toBe(99);
    expect(h.status).toBe("invalid");
    expect(h.bolehDinilai).toBe(false);
  });
});

describe("NOL JUALAN bukan data hilang", () => {
  it("baris ber-net nol dihitung ADA, dan periodenya tetap lengkap", () => {
    const semuaNol = fakta(100, 0);
    const h = nilaiKelengkapan({ wajib: 100, fakta: semuaNol, ambang: ambang(95) });
    expect(h.ada).toBe(100);
    expect(h.hilang).toBe(0);
    expect(h.status).toBe("lengkap");
    expect(h.bolehDinilai).toBe(true);
  });

  it("seratus baris nol berbeda status dari nol baris", () => {
    const nolJualan = nilaiKelengkapan({ wajib: 100, fakta: fakta(100, 0), ambang: ambang(95) });
    const tidakAda = nilaiKelengkapan({ wajib: 100, fakta: [], ambang: ambang(95) });
    expect(nolJualan.status).toBe("lengkap");
    expect(tidakAda.status).toBe("tidak_tersedia");
    expect(nolJualan.status).not.toBe(tidakAda.status);
  });
});

describe("ambang datang dari luar, tidak pernah dari dalam", () => {
  it("ambang yang berbeda memberi keputusan yang berbeda untuk data yang sama", () => {
    const data = { wajib: 100, fakta: fakta(90) };
    expect(nilaiKelengkapan({ ...data, ambang: ambang(95) }).bolehDinilai).toBe(false);
    expect(nilaiKelengkapan({ ...data, ambang: ambang(85) }).bolehDinilai).toBe(true);
  });

  it("ambangnya ikut dikembalikan supaya bisa dilacak", () => {
    const h = nilaiKelengkapan({ wajib: 10, fakta: fakta(10), ambang: { persen: 90, sumber: "op_settings" } });
    expect(h.ambang).toEqual({ persen: 90, sumber: "op_settings" });
  });

  it("TIDAK ADA angka 95 yang ditanam di dalam berkasnya", () => {
    // Keputusan 95% masih terbuka (decisions.md nomor 14). Menuliskannya
    // sebagai tetapan berarti mengarang keputusan bisnis lalu menyebarkannya.
    const sumber = readFileSync(join(process.cwd(), "src/lib/ops/kelengkapan.ts"), "utf8");
    const kode = sumber.replace(/\/\*\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(kode).not.toMatch(/\b95\b/);
    expect(kode).not.toMatch(/0\.95/);
    // Dan tidak ada nilai bawaan yang diam-diam mengisinya.
    expect(kode).not.toMatch(/ambang\s*[:=]\s*\{[^}]*persen\s*:\s*\d/);
  });
});

describe("pembagi", () => {
  it("wajib nol berarti tidak ada yang kurang", () => {
    const h = nilaiKelengkapan({ wajib: 0, fakta: [], ambang: ambang(95) });
    expect(h.status).toBe("lengkap");
    expect(h.persen).toBeNull();
    expect(h.bolehDinilai).toBe(true);
  });

  it("wajib dihitung dari hari yang SUDAH LEWAT, bukan seluruh bulan", () => {
    // Memakai seluruh hari membuat periode berjalan selamanya tidak lengkap.
    expect(wajibPasangan(57, 16)).toBe(912);
    expect(wajibPasangan(57, 31)).toBe(1_767);
    expect(wajibPasangan(0, 31)).toBe(0);
    expect(wajibPasangan(57, 0)).toBe(0);
  });

  it("angka negatif tidak menghasilkan pembagi negatif", () => {
    expect(wajibPasangan(-5, 10)).toBe(0);
    const h = nilaiKelengkapan({ wajib: -1, fakta: [], ambang: ambang(95) });
    expect(h.wajib).toBe(0);
    expect(h.hilang).toBe(0);
  });

  it("data lebih banyak dari yang diminta tidak membuat hilang jadi negatif", () => {
    const h = nilaiKelengkapan({ wajib: 10, fakta: fakta(12), ambang: ambang(95) });
    expect(h.hilang).toBe(0);
    expect(h.persen).toBe(120);
    expect(h.status).toBe("lengkap");
  });
});
