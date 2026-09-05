import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Aturan-aturan Coordinator Area yang kalau dilanggar TIDAK terlihat salah.
 *
 * Seluruhnya menghasilkan angka yang tetap masuk akal di layar — outlet baru
 * yang ikut terhitung, satu area yang terhitung tiga kali, HPP yang
 * dirata-ratakan begitu saja. Tidak ada yang akan mencurigainya, dan itu
 * sebabnya dijaga di sini.
 */

const data = readFileSync(join(process.cwd(), "src/lib/data/kpi.ts"), "utf8");
const papan = readFileSync(join(process.cwd(), "src/components/kpi/papan-kpi.tsx"), "utf8");
const halaman = readFileSync(join(process.cwd(), "src/app/(app)/kpi/[posisi]/page.tsx"), "utf8");

describe("aturan tiga bulan", () => {
  it("outlet yang belum genap tiga bulan tidak ikut dinilai SAMA SEKALI", () => {
    // Bukan hanya di Gross Sales: outlet baru selalu menyeret rata-rata ke
    // bawah, dan komplain awal yang wajar terhitung sebagai kegagalan.
    const blok = data.slice(data.indexOf("async function angkaCa"));
    const badan = blok.slice(0, blok.indexOf("\n/**", 1));
    expect(badan).toContain("belum.push(o)");
    // Komplain dihitung dari outlet yang LOLOS saja.
    expect(badan).toContain("komplainOutlet(periode, lolos.map((o) => o.id))");
  });

  it("yang menentukan adalah ada-tidaknya data, bukan tanggal yang diketik", () => {
    // Tanggal buka tidak pernah ada di basis data ini, dan yang diketik
    // belakangan hampir selalu tanggal yang diingat, bukan yang benar.
    const blok = data.slice(data.indexOf("function tigaBulanSebelum"));
    expect(blok.slice(0, 400)).toContain("bulanSebelum");
    expect(data).toContain("if (!tiga.every(berjalan))");
  });
});

describe("gross sales manual", () => {
  it("ESB selalu menang atas angka yang diketik", () => {
    // Angka yang bisa diperdebatkan tidak boleh mengalahkan angka yang tidak
    // bisa — kalau kalah, tidak akan ada yang tahu mana yang sedang dibaca.
    const blok = data.slice(data.indexOf("function grossOutlet"));
    const badan = blok.slice(0, blok.indexOf("\n}"));
    expect(badan).toContain("if (dariEsb !== undefined && dariEsb > 0) return dariEsb;");
    expect(badan).toContain("tangan.get(o.id)?.gross");
  });

  it("di layar, outlet yang sudah punya angka ESB tidak bisa diketik", () => {
    const form = readFileSync(join(process.cwd(), "src/components/kpi/form-tabel.tsx"), "utf8");
    expect(form).toContain('jenis === "gross_manual" ? outlet.filter((o) => !o.dariEsb) : outlet');
  });

  it("satu outlet yang angkanya belum ada menahan totalnya, bukan tampil kurang", () => {
    // Total yang kurang akan menyeret target bulan berikutnya ikut salah,
    // karena target dihitung dari rata-rata tiga bulan sebelumnya.
    expect(data).toContain("grossPerOutlet.some((v) => v === null)");
  });
});

describe('pilihan "Semua"', () => {
  it("dihitung per AREA, bukan per orang", () => {
    // Tiga orang memegang Area Poetri; menghitung per orang menjumlahkan
    // penjualan area itu tiga kali, dan totalnya tidak pernah cocok dengan
    // angka perusahaan.
    expect(data).toContain("[...new Set(semuaPic.map((o) => getUser(o.value)?.areaId ?? \"\").filter(Boolean))]");
  });

  it("target per orang dikalikan jumlah orang yang tercakup", () => {
    // Gabungan delapan Coordinator Area dibandingkan dengan target satu orang
    // akan selalu terlihat jauh melampaui atau jauh gagal.
    expect(data).toContain('const perOrang = i.key === "hygiene_cctv" || i.key === "komplain_area"');
    expect(data).toContain("target * pengali");
  });

  it("hanya untuk membaca — tidak bisa dipakai menyimpan", () => {
    expect(papan).toContain("laporan.pic !== SEMUA_PIC");
    expect(halaman).toContain("Semua Coordinator Area");
  });
});

describe("HPP se-area", () => {
  it("ditimbang penjualan tiap outlet, bukan dirata-rata begitu saja", () => {
    // Merata-ratakan persen membuat outlet terkecil sama beratnya dengan
    // outlet terbesar, dan angkanya tidak pernah cocok dengan laporan keuangan.
    expect(data).toContain("jumlahHpp += h * g");
    expect(data).toContain("bobotHpp > 0 ? jumlahHpp / bobotHpp : null");
  });
});

describe("satu pintu masuk", () => {
  it("tombol Input hanya muncul bila ada yang belum tercakup form tabel", () => {
    // Dua pintu ke tujuan yang sama membuat orang bertanya-tanya mana yang
    // benar, dan angka yang sama bisa masuk dua kali lewat jalan berbeda.
    expect(papan).toContain('bentukIsian(i) !== "otomatis" && bentukIsian(i) !== "kegiatan"');
    expect(papan).toContain("perluDialogInput &&");
  });

  it("angka bulanan per outlet ikut di dalam form yang sama", () => {
    expect(papan).toContain('out.push({ jenis: "net_profit"');
    expect(papan).toContain('out.push({ jenis: "hpp"');
    expect(papan).toContain('jenis: "gross_manual"');
  });
});

describe("bulan pembanding yang belum ditarik", () => {
  it("dibedakan dari outlet yang memang baru", () => {
    // Kejadian nyata: menilai Agustus membutuhkan Mei, dan penarikan bulanan
    // hanya menjangkau tiga bulan — jadi SELURUH outlet terbaca "belum genap 3
    // bulan" pada bulan mana pun selain yang terbaru. Pesannya menyalahkan
    // outletnya, padahal yang kurang datanya.
    expect(data).toContain("const bulanKosong = bulanLalu.filter(");
    expect(data).toContain("ca.bulanKosong.length > 0");
    const form = readFileSync(join(process.cwd(), "src/components/kpi/form-tabel.tsx"), "utf8");
    expect(form).toContain("angka ESB bulan pembanding belum ditarik");
  });

  it("penarikan bulanan menjangkau dua belas bulan, bukan tiga", () => {
    // Tiga bulan hanya cukup untuk menilai bulan berjalan.
    const rute = readFileSync(join(process.cwd(), "src/app/api/cron/fraud-sync/route.ts"), "utf8");
    expect(rute).toContain('searchParams.get("mundur") ?? "12"');
  });
});

describe("nol dari ESB", () => {
  it("dibaca sebagai 'belum ada di bulan itu', bukan penjualan nol", () => {
    // ESB tetap membalas untuk cabang yang belum buka, dan balasannya nol —
    // barisnya selalu tersimpan. Kalau nol dianggap angka yang sah: outlet yang
    // belum buka LOLOS aturan tiga bulan dengan penjualan nol dan menyeret
    // rata-rata seluruh area ke bawah. Empat sampai tiga belas cabang bernilai
    // nol pada tiap bulan yang sudah ditarik — ini bukan kemungkinan teoretis.
    expect(data).toContain("if (dariEsb !== undefined && dariEsb > 0) return dariEsb;");
    expect(data).toContain("const berjalan = (nilai: number | null): boolean => nilai !== null && nilai > 0;");
    expect(data).toContain("if (!tiga.every(berjalan))");
  });

  it("nol dari ESB tidak menutup jalan isian tangan", () => {
    // Justru tiga outlet pindahan Majoo yang bernilai nol — riwayatnya tidak
    // ikut terbawa. Kalau nol dianggap "sudah ada di ESB", kolom isiannya
    // hilang dan tidak ada cara memperbaikinya sama sekali.
    expect(data).toContain("const dariEsb = !!(o.branch && (esbIni.get(o.branch)?.net ?? 0) > 0);");
  });
});
