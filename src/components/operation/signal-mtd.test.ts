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
  it("jumlah migration tetap 112", () => {
    const berkas = readdirSync(join(akar, "supabase/migrations")).filter((f) => f.endsWith(".sql"));
    expect(berkas).toHaveLength(112);
  });

  it("migration terakhir tidak bergeser — Z-03 tidak menambah satu pun", () => {
    const berkas = readdirSync(join(akar, "supabase/migrations"))
      .filter((f) => f.endsWith(".sql"))
      .sort();
    expect(berkas[berkas.length - 1]).toBe("0112_kunci_app_config.sql");
    expect(berkas).toContain("0111_signals.sql");
  });

  it("tidak ada kolom cakupan biaya yang diam-diam ditambahkan", () => {
    for (const dilarang of ["hari_tercakup", "periode_awal", "periode_akhir"]) {
      expect(pembaca).not.toContain(dilarang);
      expect(penulis).not.toContain(dilarang);
    }
  });
});
