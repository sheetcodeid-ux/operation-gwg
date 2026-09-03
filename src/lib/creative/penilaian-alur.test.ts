import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Yang dijaga di sini bukan rumus skornya (itu ada di `penilaian-request.test.ts`),
 * melainkan hal-hal yang membuat dashboard-nya bisa dipercaya sebagai bahan
 * evaluasi: dari mana angkanya datang, kapan disimpan, dan siapa yang mengisi.
 * Semuanya tersebar di berkas yang berbeda, jadi tidak ada satu fungsi pun yang
 * bisa mengujinya — yang diperiksa bentuk sambungannya.
 */

const baca = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

const aksi = baca("src/lib/actions/hc-requests.ts");
const data = baca("src/lib/data/creative-penilaian.ts");
const layar = baca("src/components/hc/request-review.tsx");
const nav = baca("src/lib/nav.ts");
const aksiLaporan = baca("src/lib/actions/creative-penilaian.ts");
const papan = baca("src/components/creative/penilaian-board.tsx");
const kit = baca("src/components/creative/kit-creative.tsx");
const halaman = baca("src/app/(app)/creative/penilaian/page.tsx");
const migrasi = baca("supabase/migrations/0069_penilaian_request_design.sql");

describe("selisih hari tidak pernah disimpan", () => {
  it("tabelnya hanya menyimpan ceklis, bukan angka harinya", () => {
    // Angka yang disimpan bisa berbeda dari sumbernya begitu tanggalnya
    // diperbaiki, dan angka yang tidak cocok dengan sumbernya justru jadi bahan
    // perdebatan baru — persis yang hendak dihentikan dashboard ini.
    const kolom = migrasi.slice(migrasi.indexOf("create table"), migrasi.indexOf(");"));
    expect(kolom).toContain("tujuan_jelas");
    expect(kolom).not.toMatch(/\bhari\b|selisih|\bskor\b|\blabel\b/i);
  });

  it("dihitung ulang dari hc_requests setiap dibaca", () => {
    expect(data).toContain("nilaiPermintaan(r.createdAt, r.plannedDate, ceklis)");
  });
});

describe("permintaannya dibaca lewat pembaca yang sama dengan modul lain", () => {
  it("membaca SELURUH riwayatnya, bukan 500 terbaru", () => {
    // Permintaan design masuk sekitar 55 per minggu. Dengan batas 500, bulan
    // ketiga ke belakang diam-diam hilang dari rata-rata — dan tidak ada yang
    // tampak salah di layar.
    expect(data).toContain("semua: true");
  });

  it("tidak menyusun kueri hc_requests sendiri", () => {
    // Nama pemohon dan nama outlet tidak ada di tabelnya — keduanya disusun
    // dari id-nya di `fromRow`. Kueri sendiri yang memintanya sebagai kolom
    // gagal tanpa suara, dan yang terlihat cuma dashboard kosong.
    expect(data).toContain('listHcRequests({ kind: "design", semua: true })');
    expect(data).not.toContain('from("hc_requests")');
  });
});

describe("penilaian menempel pada penutupan permintaan", () => {
  it("disimpan SESUDAH hasilnya terkirim, tidak sebelum", () => {
    // Kalau disimpan lebih dulu, permintaan yang gagal terkirim tetap
    // meninggalkan nilai — pemohonnya kena angka atas desain yang tidak pernah
    // ia terima.
    for (const nama of ["submitDesignResultAction", "accDesignResultAction"]) {
      const blok = aksi.slice(aksi.indexOf(`export async function ${nama}`));
      const badan = blok.slice(0, blok.indexOf("\nexport async function", 1));
      const kirim = badan.indexOf("kirimHasilKePemohon");
      const simpan = badan.indexOf("simpanPenilaian");
      expect(kirim, `${nama}: pengiriman hasil tidak ditemukan`).toBeGreaterThan(-1);
      expect(simpan, `${nama}: penyimpanan penilaian tidak ditemukan`).toBeGreaterThan(kirim);
    }
  });

  it("gagal menyimpan nilai tidak menahan desainnya", () => {
    // Yang menunggu desainnya tidak boleh ikut tertahan gara-gara catatan
    // evaluasi gagal tersimpan.
    const blok = aksi.slice(aksi.indexOf("await simpanPenilaian("));
    expect(blok.slice(0, 600)).toContain("console.error");
    expect(aksi).not.toMatch(/if \(!nilai\.ok\) return/);
  });

  it("dua pintu penutup permintaan, dua-duanya menilai", () => {
    // Pengelola antrian yang mengerjakan sendiri hasilnya langsung terkirim
    // tanpa tahap ACC. Kalau penilaiannya cuma dipasang di dialog ACC, setiap
    // permintaan yang kebetulan ia kerjakan hilang dari dashboard.
    expect(aksi.match(/simpanPenilaian\(/g)?.length).toBe(2);
    expect(layar).toContain("function PenilaianPemohonPanel");
    expect(layar.match(/<PenilaianPemohonPanel/g)?.length).toBe(2);
  });

  it("hasil yang DIKEMBALIKAN ke designer tidak ikut menilai pemohon", () => {
    // Permintaannya belum selesai di titik itu; menilai pemohon berarti menilai
    // sesuatu yang belum berakhir.
    expect(layar).toContain("...(approve ? { ceklis, catatanNilai } : {})");
  });

  it("yang belum boleh meloloskan hasil tidak diminta menilai", () => {
    // Designer biasa mengirim hasilnya untuk diperiksa. Ia bukan penilainya,
    // dan penilai yang berbeda-beda membuat angka antar-outlet tidak bisa
    // dibandingkan sama sekali.
    expect(layar).toContain("...(kelola ? { ceklis, catatanNilai } : {})");
    expect(layar).toContain("{kelola && (\n            <PenilaianPemohonPanel");
  });
});

describe("hanya permintaan selesai yang masuk hitungan", () => {
  it("yang masih berjalan tidak dihitung nol", () => {
    // Memasukkannya sebagai nol berarti menuduh orang atas pekerjaan yang belum
    // kelar.
    expect(data).toContain('r.status === "terlaksana"');
  });

  it("yang selesai tapi belum dinilai dihitung terpisah, bukan dibuang", () => {
    // Itulah sisa pekerjaan penilainya — kalau disembunyikan, dashboard tampak
    // lengkap padahal separuh permintaannya belum pernah dilihat.
    expect(data).toContain("belum.push(");
  });
});

describe("menunya terdaftar utuh", () => {
  it("Coordinator Area ikut bisa membukanya", () => {
    // Dashboard ini bahan evaluasi CA. Yang dievaluasi harus bisa melihat
    // angkanya sendiri — kalau tidak, satu-satunya jalan tahu adalah menunggu
    // dipanggil rapat.
    const blok = nav.slice(nav.indexOf("area_coordinator: ["));
    expect(blok.slice(0, blok.indexOf("\n"))).toContain("creative_penilaian");
  });

  it("terdaftar di union, sidebar, dan daftar menu divisi", () => {
    // Menu yang lupa didaftarkan di salah satunya tetap bisa dibuka lewat URL
    // tapi tidak pernah muncul di sidebar siapa pun.
    expect(nav).toContain('| "creative_penilaian"');
    expect(nav).toContain('key: "creative_penilaian"');
    expect(nav).toMatch(/menus: \["creative_penilaian"\]/);
    expect(nav).toContain('{ division: "Creative", menus: ["work", "creative_design", "creative_penilaian"] }');
  });

  it("halamannya dijaga menunya sendiri", () => {
    expect(halaman).toContain('canReachMenu(user, "creative_penilaian")');
    expect(halaman).toContain("redirect(\"/dashboard\")");
  });
});


describe("laporan ke Coordinator Area", () => {
  it("angkanya dihitung ULANG di server, tidak diterima dari layar", () => {
    // Kalau angkanya ikut dikirim dari peramban, siapa pun yang bisa memanggil
    // aksinya bisa mengarang rapor atas nama orang lain — dan laporan yang bisa
    // dikarang tidak layak jadi bahan evaluasi siapa pun.
    expect(aksiLaporan).toContain("barisUntukLaporan(");
    expect(aksiLaporan).toContain("susunLaporan(");
    expect(aksiLaporan).not.toMatch(/input\.(rekap|baris|area|skor|naskah)/);
  });

  it("tiap CA menerima wilayahnya sendiri", () => {
    // Mengirim seluruh tabel ke semua orang membuat rapor wilayah rekannya ikut
    // sampai — alat evaluasi yang bocor ke samping berhenti dipakai.
    expect(aksiLaporan).toContain("ca.areaIds.includes(b.areaId)");
  });

  it("yang mengirim dijaga di server, bukan cuma tombolnya disembunyikan", () => {
    expect(aksiLaporan).toContain("bolehKirimLaporanPenilaian(user)");
  });

  it("satu penerima gagal tidak membatalkan sisanya", () => {
    const blok = aksiLaporan.slice(aksiLaporan.indexOf("for (const ca of dituju)"));
    expect(blok).toContain("catch");
    expect(blok).toContain("continue");
  });
});

describe("tampilan Creative berdiri sendiri", () => {
  it("tidak memakai kit Human Capital", () => {
    // Diminta tegas: gaya Creative jangan disamakan dengan HC. Selama papannya
    // masih mengimpor kit HC, setiap perbaikan di HC ikut mengubah wajah
    // halaman ini tanpa ada yang memintanya.
    expect(papan).not.toContain("@/components/hcmos/");
    expect(kit).not.toContain("@/components/hcmos/");
  });

  it("hanya satu tabel rekap — Per Pemohon tidak lagi jadi tampilan terpisah", () => {
    expect(papan).not.toContain('"outlet"');
    expect(papan).toContain('value: "rekap"');
    expect(papan).toContain('value: "riwayat"');
  });

  it("kolom pertamanya Area", () => {
    const kepala = papan.slice(papan.indexOf("<thead>"), papan.indexOf("</thead>"));
    expect(kepala.indexOf("Area")).toBeGreaterThan(-1);
    expect(kepala.indexOf("Area")).toBeLessThan(kepala.indexOf("Nama"));
    expect(kepala).not.toContain("Outlet");
  });

  it("penghitung hasil cari ada DI LUAR kotaknya", () => {
    // Ditaruh di dalam sebagai lencana melayang, ruang kanannya dipesan terus —
    // dan teks pancingannya terpotong di tengah kata.
    const kotak = kit.slice(kit.indexOf("export function KotakCari"), kit.indexOf("export interface PilihanDropdown"));
    expect(kotak).not.toContain("absolute right-2.5");
    expect(kotak.indexOf("</div>")).toBeLessThan(kotak.indexOf("hitung &&"));
  });

  it("saringan label membawa warnanya, bukan cuma kata", () => {
    // Seluruh guna lampu merah-kuning-hijau adalah dilihat, bukan dibaca.
    expect(papan).toContain("WARNA_LABEL");
    expect(kit).toContain("p.warna");
  });
});
