import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SETELAN_POSISI_BAWAAN, alasanBelumDinilai, posisiDinilai } from "./berlaku";

/**
 * Berlakunya KPI sebuah posisi.
 *
 * Online Delivery Officer KPI-nya berlaku mulai September. Pada Agustus posisi
 * itu belum punya data sama sekali — dan kalau tetap ikut dihitung, rata-rata
 * departemennya turun dan KPI Manajemen ikut turun gara-gara orang yang bulan
 * itu memang belum dinilai.
 */

describe("kapan sebuah posisi dinilai", () => {
  it("tanpa setelan apa pun, dinilai sejak kapan pun", () => {
    // Bawaannya harus begini: kalau sebaliknya, SELURUH posisi yang sudah ada
    // mendadak hilang dari penilaian hanya karena tabel setelannya dibuat.
    expect(posisiDinilai(undefined, "2020-01")).toBe(true);
    expect(posisiDinilai(SETELAN_POSISI_BAWAAN, "2026-08")).toBe(true);
  });

  it("bulan sebelum berlakunya tidak dinilai, bulan berlakunya sudah", () => {
    const s = { aktif: true, berlakuMulai: "2026-09" };
    expect(posisiDinilai(s, "2026-08")).toBe(false);
    expect(posisiDinilai(s, "2026-09")).toBe(true);
    expect(posisiDinilai(s, "2026-10")).toBe(true);
    // Termasuk tahun sebelumnya — perbandingan teks "YYYY-MM" tetap benar
    // melewati pergantian tahun.
    expect(posisiDinilai(s, "2025-12")).toBe(false);
  });

  it("posisi yang dimatikan tidak dinilai pada bulan mana pun", () => {
    const s = { aktif: false, berlakuMulai: "2020-01" };
    expect(posisiDinilai(s, "2026-09")).toBe(false);
    expect(posisiDinilai(s, "2030-01")).toBe(false);
  });

  it("sebabnya ditulis apa adanya, bukan dibiarkan kosong", () => {
    expect(alasanBelumDinilai({ aktif: true, berlakuMulai: "2026-09" }, "2026-08")).toContain("September 2026");
    expect(alasanBelumDinilai({ aktif: false, berlakuMulai: null }, "2026-08")).toContain("dinonaktifkan");
    expect(alasanBelumDinilai(undefined, "2026-08")).toBeNull();
  });
});

describe("pengaruhnya ke KPI Manajemen dan rata-rata departemen", () => {
  const manajemen = readFileSync(join(process.cwd(), "src/lib/data/kpi-manajemen.ts"), "utf8");

  it("posisi yang belum berlaku DIKELUARKAN, bukan dinolkan", () => {
    // Dinolkan berarti dianggap gagal — tuduhan yang berbeda dari belum
    // waktunya dinilai, dan yang satu menarik turun rata-rata departemennya.
    expect(manajemen).toContain("posisiDinilai(setelan.get(p.kode), periode)");
    expect(manajemen).toContain("dipakai.map(capaian)");
  });

  it("gagal membaca setelannya tidak menjatuhkan halaman", () => {
    expect(manajemen).toContain("setelanPosisi().catch(");
  });
});

describe("hanya super admin yang boleh mengubahnya", () => {
  const aksi = readFileSync(join(process.cwd(), "src/lib/actions/kpi.ts"), "utf8");
  const blok = aksi.slice(aksi.indexOf("export async function simpanSetelanPosisiAction"));

  it("dijaga di server, dan bulannya divalidasi", () => {
    expect(blok).toContain("if (!bolehAturKpi(user))");
    expect(blok).toContain("/^\\d{4}-\\d{2}$/.test(input.berlakuMulai)");
  });

  it("menyegarkan halaman yang ikut berubah", () => {
    // Tiga halaman membaca setelan ini; menyegarkan satu saja membuat dua
    // lainnya menampilkan angka lama tanpa ada yang tahu.
    expect(blok).toContain('revalidatePath("/kpi")');
    expect(blok).toContain('revalidatePath("/kpi/manajemen")');
  });
});

describe("tipe kolom penyimpanannya", () => {
  const migrasi = readFileSync(join(process.cwd(), "supabase/migrations/0101_kpi_posisi_berlaku.sql"), "utf8");

  it("diubah_oleh disimpan sebagai TEXT, bukan uuid", () => {
    // Id pengguna di aplikasi ini berbentuk "usr_001". Dibuat uuid, setiap
    // penyimpanan gagal dengan pesan Postgres apa adanya di layar pengguna:
    // invalid input syntax for type uuid: "usr_001".
    expect(migrasi).toContain("diubah_oleh text");
    expect(migrasi).not.toMatch(/diubah_oleh\s+uuid/);
  });
});

describe("tampilan Detail KPI Divisi", () => {
  const manajemen = readFileSync(join(process.cwd(), "src/lib/data/kpi-manajemen.ts"), "utf8");
  const papan = readFileSync(join(process.cwd(), "src/components/kpi/papan-manajemen.tsx"), "utf8");

  it("posisi yang belum berlaku TIDAK didaftar, bukan tampil kosong", () => {
    // Ditulis "belum ada data", ia terbaca seperti pekerjaan yang belum
    // dikerjakan — padahal memang belum waktunya dinilai. Begitu bulannya
    // tiba, barisnya muncul sendiri.
    expect(manajemen).toContain("d.posisi.filter((kode) => dinilai.has(kode))");
    expect(manajemen).toContain("dinilai: new Set(dipakai.map((p) => p.kode))");
  });

  it("grafik departemen diurutkan dari tertinggi ke terendah", () => {
    expect(papan).toContain("(b.rata ?? 0) - (a.rata ?? 0)");
  });

  it("Total Skor dibulatkan di mana pun, termasuk di PDF", () => {
    // Diputuskan pemiliknya: angka ringkasan dibulatkan. Rincian per indikator
    // tetap berdesimal — di situlah angkanya dicocokkan baris demi baris
    // dengan laporan yang ditandatangani.
    const grafik = readFileSync(join(process.cwd(), "src/components/kpi/kpi-charts.tsx"), "utf8");
    expect(grafik).toContain('total.toLocaleString("id-ID", { maximumFractionDigits: 0 })');
    const pdf = readFileSync(join(process.cwd(), "src/components/kpi/laporan-pdf.tsx"), "utf8");
    expect(pdf).toContain("persen(ringkas.skor, 0)");
    expect(pdf).toContain("persen(ringkas.skorSetara, 0)");
    // Rinciannya TIDAK ikut dibulatkan.
    expect(pdf).toContain("persen(b.persenActual)");
  });
});

describe("capaian posisi yang dinilai per orang", () => {
  const manajemen = readFileSync(join(process.cwd(), "src/lib/data/kpi-manajemen.ts"), "utf8");

  it("dirata-ratakan dari tiap orangnya, bukan dibaca sekali sebagai 'semua'", () => {
    // Catatan kegiatan dan angka manual tersimpan atas NAMA masing-masing —
    // tidak ada satu baris pun bernama "semua". Dibaca begitu, yang kembali
    // hanya indikator otomatis: Food Staff dan Beverage Staff sempat sama-sama
    // terbaca 36,05% padahal di halamannya 77% dan 83%. Dua posisi berbeda
    // yang angkanya sama persis adalah tandanya.
    expect(manajemen).toContain("p.perPic && !p.picDinamis && p.pic.length > 0");
    expect(manajemen).toContain("p.pic.map((nama) => laporanKpi(p.kode, periode, nama)");
  });

  it("Coordinator Area tetap dibaca sebagai gabungan area", () => {
    // PIC-nya dinamis dan angkanya milik AREA, bukan milik orang. Dirata-rata
    // per orang, penjualan satu area terhitung sebanyak orang yang memegangnya.
    expect(manajemen).toContain("laporanKpi(p.kode, periode, p.perPic ? SEMUA_PIC : \"\")");
  });
});
