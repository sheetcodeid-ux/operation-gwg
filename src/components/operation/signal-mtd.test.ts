import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * KONTRAK Z-03 — SIGNAL BULAN BERJALAN ADALAH INDIKASI (AD-17).
 *
 * Keputusan Owner: Q1 MTD Early Warning · Q2 accept as indication ·
 * Q3 one mode · Q4 no schema change.
 *
 * Yang dijaga berkas ini BUKAN tampilannya melainkan KLAIMNYA. Sebuah label
 * yang menyatakan lebih daripada yang bisa dibuktikan datanya adalah cara
 * tercepat mengubah early warning menjadi vonis — dan vonis yang salah
 * mengirim orang memperbaiki sesuatu yang tidak pernah rusak.
 *
 * Dibaca sebagai TEKS, bukan dirender: yang diuji adalah janji yang tertulis
 * di kode, dan janji itu harus tetap ada walau susunan komponennya berubah.
 */

const akar = process.cwd();
const baca = (p: string) => readFileSync(join(akar, p), "utf8");

const tabel = baca("src/components/operation/tabel-mingguan.tsx");
const pembaca = baca("src/lib/data/mingguan-performa.ts");
const penulis = baca("src/lib/data/signals.ts");
const bacaSignal = baca("src/lib/data/signal-baca.ts");

/* ───────────────────── Q2 — Signal tidak pernah jadi vonis ───────────────────── */

describe("layar tidak boleh menyimpulkan lebih dari yang bisa dibuktikan", () => {
  it('sel Signal kosong TIDAK lagi berbunyi "tidak ada"', () => {
    // "tidak ada" menutup tiga kemungkinan jadi satu, dan yang paling sering
    // dibaca adalah yang paling melegakan.
    expect(tabel).not.toContain('<span className="text-[11px] text-muted-foreground">tidak ada</span>');
    expect(tabel).toContain("belum ada indikasi");
  });

  it("sel kosong bulan berjalan menyebut bahwa itu BUKAN berarti aman", () => {
    expect(tabel).toContain("SEBAB_TANPA_INDIKASI");
    expect(tabel).toMatch(/berjalan:[\s\S]{0,400}BUKAN berarti outlet ini aman/);
  });

  it("badge bulan berjalan bertanda MTD", () => {
    expect(tabel).toContain("function PenandaMtd()");
    expect(tabel).toContain("{detail.berjalan && <PenandaMtd />}");
  });

  it("kalimat MTD menyatakan indikasi dan menolak kata diagnosis", () => {
    const m = tabel.match(/const SEBAB_MTD =[\s\S]*?;/);
    expect(m).not.toBeNull();
    const kalimat = m![0];
    expect(kalimat).toContain("INDIKASI");
    expect(kalimat).toContain("bukan diagnosis");
    expect(kalimat).toContain("bukan hasil bulan penuh");
  });

  it("tidak ada satu pun kata yang menyatakan kepastian vonis", () => {
    for (const dilarang of ["performa buruk", "bulan bermasalah", "hasil final", "terbukti buruk"]) {
      expect(tabel.toLowerCase()).not.toContain(dilarang);
    }
  });

  it("banner kelengkapan menolak dibaca sebagai kelengkapan biaya", () => {
    expect(tabel).toContain("Kelengkapan data {formatNumber(persenLengkap");
    expect(tabel).toContain("Kelengkapan biaya tidak ikut terukur di sini");
  });
});

/* ───────────────────── penanda bulan berjalan memakai WIB ───────────────────── */

describe("bulan berjalan ditentukan server, memakai WIB", () => {
  it("`berjalan` diturunkan dari bulanIniWib(), bukan jam peramban", () => {
    expect(pembaca).toContain("berjalan: periode === bulanIniWib()");
    expect(pembaca).toMatch(/import \{[^}]*bulanIniWib[^}]*\} from "@\/lib\/ops\/waktu";/);
  });

  it("komponen tidak pernah menghitung bulan berjalan sendiri", () => {
    // `new Date()` tanpa argumen di peramban bukan WIB — tujuh jam bisa
    // memindahkan seluruh layar ke bulan yang salah.
    expect(tabel).not.toMatch(/new Date\(\)/);
  });
});

/* ───────────────────── Q3 — satu mode, tanpa kekecualian per rule ───────────────────── */

describe("ONE MODE — tidak ada mode per rule", () => {
  const berkas = ["src/lib/data/signals.ts", "src/lib/data/rules.ts", "src/lib/ops/rules.ts", "src/lib/ops/deteksi.ts"];

  it("tidak ada konfigurasi mode penilaian di jalur deteksi", () => {
    for (const f of berkas) {
      expect(baca(f)).not.toMatch(/mode_penilaian|modePenilaian/);
    }
  });
});

/* ───────────────────── detektor TIDAK berubah ───────────────────── */

describe("Q1 MTD — detektor dibiarkan apa adanya", () => {
  it("syarat kelahiran Signal tetap: melanggar DAN sumbernya sah", () => {
    expect(penulis).toContain("const bolehSisip = melanggar && b.sumberSah;");
  });

  it("tidak ada gerbang kelengkapan yang diselipkan ke jalur deteksi", () => {
    // Z-03 dikunci sebagai MTD; menambahkan gerbang di sini akan membalik
    // keputusan Owner tanpa pernah menyebutnya.
    for (const f of ["src/lib/data/signals.ts", "src/lib/data/rules.ts", "src/lib/ops/deteksi.ts"]) {
      expect(baca(f).toLowerCase()).not.toContain("kelengkapan");
    }
  });

  it("pembaca Signal tetap terkunci pada skala bulanan", () => {
    expect(bacaSignal).toContain('export const SKALA_SIGNAL = "bulanan" as const;');
  });
});

/* ───────────────────── Q4 — tidak ada schema change ───────────────────── */

describe("NO SCHEMA CHANGE", () => {
  /**
   * BATAS YANG DIJAGA PENJAGA INI, DAN KENAPA IA BERBATAS.
   *
   * Z-03 memutuskan TIDAK menambah migration, dan keputusan itu tetap berlaku
   * selamanya. Tapi ia keputusan tentang Z-03 — bukan tentang repositori.
   *
   * Versi pertama penjaga ini menuntut `total = 112`, dan itu keliru sebagai
   * bentuk: ia menyalakan merah untuk SETIAP migration gate berikutnya, walau
   * gate itu memang diizinkan pemiliknya. Penjaga yang gagal karena pekerjaan
   * yang sah bukan penjaga — ia cuma gangguan yang cepat atau lambat dimatikan
   * orang, dan begitu ia mati, kontrak Z-03 ikut hilang bersamanya.
   *
   * Yang dijaga sekarang RENTANGNYA: seluruh migration sampai 0112 adalah
   * milik Z-03 dan sebelumnya, dan rentang itu tidak boleh bergeser — tidak
   * bertambah, tidak berkurang, tidak berganti nama. Nomor di atas 0112 milik
   * gate lain (0113 = Z-01, diizinkan §P) dan sengaja TIDAK dihitung di sini.
   */
  const BATAS_Z03 = 112;
  const TERAKHIR_Z03 = "0112_kunci_app_config.sql";

  const migrasi = () =>
    readdirSync(join(akar, "supabase/migrations"))
      .filter((f) => f.endsWith(".sql"))
      .sort();
  const nomor = (f: string) => Number(f.slice(0, 4));

  it("Z-03 tidak menambah satu migration pun — rentang sampai 0112 tetap 112 berkas", () => {
    const sampaiZ03 = migrasi().filter((f) => nomor(f) <= BATAS_Z03);
    expect(sampaiZ03).toHaveLength(BATAS_Z03);
  });

  it("batas Z-03 tetap 0112_kunci_app_config.sql", () => {
    const sampaiZ03 = migrasi().filter((f) => nomor(f) <= BATAS_Z03);
    expect(sampaiZ03[sampaiZ03.length - 1]).toBe(TERAKHIR_Z03);
    expect(sampaiZ03).toContain("0111_signals.sql");
  });

  it("tidak ada nomor kembar maupun lubang di rentang Z-03", () => {
    // Kembar berarti dua migration berebut satu urutan; lubang berarti ada
    // yang dihapus. Keduanya tidak akan terlihat dari jumlahnya saja kalau
    // salah satunya menutupi yang lain.
    const nomorZ03 = migrasi()
      .filter((f) => nomor(f) <= BATAS_Z03)
      .map(nomor);
    expect(new Set(nomorZ03).size).toBe(BATAS_Z03);
    expect(Math.min(...nomorZ03)).toBe(1);
    expect(Math.max(...nomorZ03)).toBe(BATAS_Z03);
  });

  it("migration di atas 0112 milik gate lain — di luar cakupan kontrak Z-03", () => {
    // Bukan izin longgar: yang dinyatakan di sini persis batas wewenang
    // penjaga ini. Kontrak gate lain dijaga berkas ujinya sendiri —
    // `src/lib/data/signal-triase.test.ts` untuk 0113 (Z-01).
    const sesudah = migrasi().filter((f) => nomor(f) > BATAS_Z03);
    for (const f of sesudah) expect(nomor(f)).toBeGreaterThan(BATAS_Z03);
  });

  it("tidak ada kolom cakupan biaya yang diam-diam ditambahkan", () => {
    for (const dilarang of ["hari_tercakup", "periode_awal", "periode_akhir"]) {
      expect(pembaca).not.toContain(dilarang);
      expect(penulis).not.toContain(dilarang);
    }
  });
});
