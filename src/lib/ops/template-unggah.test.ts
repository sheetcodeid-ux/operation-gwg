import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { angkaExcel, angkaExcelNol } from "./angka-excel";
import { KELOMPOK, KOL_BOLEH_KOSONG, TEMPLATE, bacaBarisUnggah, barisKosong, judulKolom, kunciKembar, sidikBaris } from "./template-unggah";

/**
 * Satu pintu unggah data.
 *
 * Yang dijaga di sini tiga hal yang kalau salah TIDAK akan terlihat: angka
 * yang diam-diam jadi nol, kolom yang tidak cocok karena spasi, dan angka yang
 * masuk ke tempat yang tidak diminta.
 */

describe("membaca angka dari Excel", () => {
  it("ribuan bertitik ala Indonesia terbaca — bukan jadi nol", () => {
    expect(angkaExcel("1.234.567")).toBe(1_234_567);
    expect(angkaExcel("Rp 118.500.000")).toBe(118_500_000);
  });

  it("rumus lama mengubah angka itu jadi NOL — inilah yang diperbaiki", () => {
    // Persis rumus yang dipakai tiga halaman unggah Operation sebelum ini:
    //   Number(String(v).replace(/[^\d.-]/g, "")) || 0
    // Rp 1,2 miliar tersimpan sebagai Rp 0, tanpa pesan, tanpa kosong.
    const rumusLama = (v: unknown) => Number(String(v).replace(/[^\d.-]/g, "")) || 0;
    expect(rumusLama("1.234.567")).toBe(0);
    expect(angkaExcelNol("1.234.567")).toBe(1_234_567);
  });

  it("kosong tetap kosong, bukan nol", () => {
    // Belum dilaporkan dan nol rupiah menuntut tindakan yang berbeda.
    expect(angkaExcel("")).toBeNull();
    expect(angkaExcel(null)).toBeNull();
    expect(angkaExcelNol("")).toBe(0);
  });

  it("desimal berkoma dibaca desimal, ribuan berkoma dibaca ribuan", () => {
    expect(angkaExcel("37,5")).toBe(37.5);
    expect(angkaExcel("1,234,567")).toBe(1_234_567);
  });
});

describe("membaca baris template", () => {
  const t = TEMPLATE;

  it("judul kolom tidak harus persis — beda huruf besar dan spasi tetap cocok", () => {
    // Berkas yang beredar lewat WhatsApp sering pulang dengan "kode" atau
    // "Non  Warehouse". Menolaknya hanya karena itu membuat orang menyerah
    // lalu mengetik manual — kembali ke masalah yang sedang diperbaiki.
    const { baris } = bacaBarisUnggah(t, [{ kode: "NCSB", outlet: "Nordu Sambas", " warehouse ": "70.000.000", "Non  Warehouse": 3_500_000 }]);
    expect(baris).toHaveLength(1);
    expect(baris[0].kunci).toBe("NCSB");
    expect(baris[0].angka["Warehouse"]).toBe(70_000_000);
    expect(baris[0].angka["Non Warehouse"]).toBe(3_500_000);
  });

  it("baris tanpa kunci dilewati DAN dihitung, bukan dibuang diam-diam", () => {
    const { baris, tanpaKunci } = bacaBarisUnggah(t, [
      { Kode: "NCSB", Warehouse: 1 },
      { Kode: "", Warehouse: 999 },
      { Warehouse: 888 },
    ]);
    expect(baris).toHaveLength(1);
    expect(tanpaKunci).toBe(2);
  });

  it("sel kosong tetap null supaya tidak menimpa angka yang sudah benar", () => {
    const { baris } = bacaBarisUnggah(t, [{ Kode: "NCSB", Warehouse: "", "Non Warehouse": "" }]);
    expect(baris[0].angka["Warehouse"]).toBeNull();
  });
});

describe("susunan template", () => {
  it("hanya ada SATU template — satu unduh, satu unggah, satu baris per outlet", () => {
    // Memecahnya per jenis hanya memindahkan pekerjaan berulang: outlet yang
    // sama harus diunduh dan diunggah beberapa kali.
    expect(Array.isArray(TEMPLATE)).toBe(false);
    expect(TEMPLATE.kunci).toBe("Kode");
  });

  it("menyebutkan ke mana datanya masuk", () => {
    // Tujuannya ditulis di layar, bukan disimpan di kepala orang: yang
    // mengunggah berhak tahu angkanya muncul di mana sebelum menekan Simpan.
    expect(TEMPLATE.tujuan.length).toBeGreaterThan(0);
  });

  it("judul kolomnya tidak ada yang kembar", () => {
    // Dua kolom bernama sama membuat yang kedua menimpa yang pertama saat
    // dibaca kembali, dan tidak ada yang gagal saat itu terjadi.
    const j = judulKolom(TEMPLATE);
    expect(new Set(j).size).toBe(j.length);
  });

  it("kelompoknya menutup seluruh kolom angka, tanpa sisa", () => {
    // Kalau ada kolom angka di luar kelompok mana pun, judul kelompok di layar
    // akan bergeser dan angka terbaca di bawah judul yang salah.
    expect(KELOMPOK.flatMap((k) => k.kolom)).toEqual([...TEMPLATE.angka]);
  });

  it("Pendapatan TIDAK diminta — gross sales tidak ditimpa dari sini", () => {
    expect(TEMPLATE.angka).not.toContain("Pendapatan");
  });

  it("total Beban TIDAK diminta terpisah — dijumlahkan dari rinciannya", () => {
    // Satu angka yang bisa diketik berbeda dari rinciannya cepat atau lambat
    // akan berbeda, dan tidak ada yang memberi tahu saat itu terjadi.
    expect(TEMPLATE.angka).not.toContain("Beban");
    expect(TEMPLATE.angka).toContain("Utilitas");
    expect(TEMPLATE.angka).toContain("Laba Bersih");
  });

  it("baris yang seluruh angkanya kosong dikenali sebagai tidak dilaporkan", () => {
    // Bukan nol rupiah. Menulisnya akan menghapus angka yang sudah benar hanya
    // karena barisnya ikut terbawa di template.
    const { baris } = bacaBarisUnggah(TEMPLATE, [
      { Kode: "NCSB", Outlet: "Nordu Sambas" },
      { Kode: "CCAY", Outlet: "Cattu", Warehouse: "1.000.000" },
    ]);
    expect(barisKosong(TEMPLATE, baris[0])).toBe(true);
    expect(barisKosong(TEMPLATE, baris[1])).toBe(false);
  });
});

describe("angka yang TIDAK boleh ikut tertulis", () => {
  const aksi = readFileSync(join(process.cwd(), "src/lib/actions/unggah-data.ts"), "utf8");

  it("Gross Sales tidak pernah ditulis dari berkas unggahan", () => {
    // Diputuskan pemiliknya: gross biarkan otomatis dari ESB, yang manual tetap
    // seperti apa adanya. Menuliskan "Pendapatan" dari Excel ke sana akan
    // menimpa angka mesin dengan angka ketikan — kesalahan yang paling sulit
    // ditemukan belakangan.
    expect(aksi).not.toMatch(/\bgross\s*:/);
  });

  it("pendapatan yang sudah tersimpan dibaca dan ditulis kembali, tidak jadi nol", () => {
    // Kolomnya tidak ada di berkas. Kalau tidak dibaca dulu, setiap unggahan
    // akan menimpa pendapatan yang benar dengan nol — diam-diam.
    expect(aksi).toContain("pendapatanLama");
    expect(aksi).toContain("listPnl(periode)");
  });

  it("baris kosong tidak ditulis", () => {
    expect(aksi).toContain("barisKosong(TEMPLATE, b)");
  });

  it("laba bersih dan harga pokok memang ikut ke KPI", () => {
    expect(aksi).toContain("netProfit");
    expect(aksi).toContain("hppNominal");
  });
});

describe("pembelian jadi milik bersama, bukan milik satu PIC", () => {
  const kpi = readFileSync(join(process.cwd(), "src/lib/data/kpi.ts"), "utf8");

  it("efisiensi beban dibaca dari pembelian outlet, bukan salinan per PIC", () => {
    // Diputuskan pemiliknya: angka pembelian WH/Non-WH satu outlet sama bagi
    // Adam, Abil, dan siapa pun di PDQ. Disimpan per PIC, satu angka harus
    // diketik empat kali dan empat salinan itu bisa berbeda diam-diam.
    expect(kpi).toContain("pembelianPerOutlet(periode)");
    expect(kpi).not.toContain('from("kpi_efisiensi")');
  });
});

/* ══════════════════ PHASE 2B — kolom baru, duplikat, idempotensi ══════════════════ */

describe("template V.1: dua puluh kolom, urutannya terkunci", () => {
  it("judul kolomnya persis seperti yang diputuskan pemiliknya", () => {
    expect(judulKolom(TEMPLATE)).toEqual([
      "Kode",
      "Outlet",
      "Warehouse",
      "Non Warehouse",
      "HPP",
      "Utilitas",
      "Sewa",
      "Tenaga Kerja",
      "Potongan",
      "Manajemen Fee",
      "Pemasaran",
      "Ongkos Kirim",
      "Lainnya",
      "Listrik",
      "Air",
      "Internet",
      "Kebersihan",
      "Platform Fee",
      "PBJT",
      "Laba Bersih",
    ]);
  });

  it("Utilitas TETAP ADA — berkas lama harus tetap bisa diunggah", () => {
    // Menghapusnya membuat setiap berkas yang sudah beredar ditolak, dan
    // orang kembali mengetik manual — masalah yang justru sedang diperbaiki.
    expect(TEMPLATE.angka).toContain("Utilitas");
  });

  it("Platform Fee BUKAN Ongkos Kirim — dua kolom yang berbeda", () => {
    expect(TEMPLATE.angka).toContain("Platform Fee");
    expect(TEMPLATE.angka).toContain("Ongkos Kirim");
    expect(TEMPLATE.angka.filter((k) => k === "Platform Fee")).toHaveLength(1);
  });

  it("enam kolom baru ditandai boleh kosong; delapan kolom lama tidak", () => {
    expect(KOL_BOLEH_KOSONG).toEqual(["Listrik", "Air", "Internet", "Kebersihan", "Platform Fee", "PBJT"]);
    for (const lama of ["Utilitas", "Sewa", "Tenaga Kerja", "Lainnya", "Ongkos Kirim"]) {
      expect(KOL_BOLEH_KOSONG).not.toContain(lama);
    }
  });

  it("masih SATU sheet — tidak dipecah per jenis biaya", () => {
    expect(KELOMPOK.flatMap((k) => k.kolom)).toEqual(TEMPLATE.angka);
    expect(TEMPLATE.sheet).toBe("Data Outlet");
  });

  it("Pendapatan TETAP tidak diminta, juga sesudah kolom baru", () => {
    for (const k of TEMPLATE.angka) expect(k.toLowerCase()).not.toContain("pendapatan");
  });
});

describe("kode outlet kembar dalam satu berkas", () => {
  const b = (kunci: string) => ({ kunci, teks: {}, angka: {} });

  it("ditemukan dan disebutkan, bukan dibiarkan yang terakhir menang", () => {
    // "Yang terakhir menang" membuat separuh angkanya hilang tanpa satu pun
    // tanda, dan yang mengunggah baru sadar berbulan-bulan kemudian.
    expect(kunciKembar([b("NCSB"), b("NCKG"), b("NCSB")])).toEqual(["NCSB"]);
  });

  it("beda huruf besar tetap dianggap kode yang sama", () => {
    expect(kunciKembar([b("ncsb"), b("NCSB")])).toHaveLength(1);
  });

  it("ditampilkan seperti tertulis di berkas, supaya bisa dicari di Excel", () => {
    expect(kunciKembar([b("NcSb"), b("ncsb")])).toEqual(["NcSb"]);
  });

  it("berkas yang benar tidak melaporkan apa pun", () => {
    expect(kunciKembar([b("NCSB"), b("NCKG"), b("NCPA")])).toEqual([]);
  });

  it("baris tanpa kunci tidak dihitung kembar", () => {
    expect(kunciKembar([b(""), b(""), b("NCSB")])).toEqual([]);
  });
});

describe("sidik jari isi berkas — untuk mengenali unggahan yang sama", () => {
  const b = (kunci: string, angka: Record<string, number | null>) => ({ kunci, teks: {}, angka });

  it("isi yang sama menghasilkan sidik yang sama", () => {
    const x = [b("A", { Warehouse: 100 }), b("B", { Warehouse: 200 })];
    const y = [b("A", { Warehouse: 100 }), b("B", { Warehouse: 200 })];
    expect(sidikBaris(TEMPLATE, x)).toBe(sidikBaris(TEMPLATE, y));
  });

  it("URUTAN BARIS tidak mengubah sidiknya — Excel gemar mengubah urutan", () => {
    const naik = [b("A", { Warehouse: 100 }), b("B", { Warehouse: 200 })];
    const turun = [b("B", { Warehouse: 200 }), b("A", { Warehouse: 100 })];
    expect(sidikBaris(TEMPLATE, naik)).toBe(sidikBaris(TEMPLATE, turun));
  });

  it("satu angka berbeda mengubah sidiknya", () => {
    const x = [b("A", { Warehouse: 100 })];
    const y = [b("A", { Warehouse: 101 })];
    expect(sidikBaris(TEMPLATE, x)).not.toBe(sidikBaris(TEMPLATE, y));
  });

  it("KOSONG dan NOL menghasilkan sidik yang berbeda", () => {
    // Kalau sama, berkas yang mengosongkan sebuah kolom akan dikira unggahan
    // yang sama dengan berkas yang menuliskannya nol — dan perubahannya
    // diam-diam tidak jadi tersimpan.
    const kosong = [b("A", { Warehouse: null })];
    const nol = [b("A", { Warehouse: 0 })];
    expect(sidikBaris(TEMPLATE, kosong)).not.toBe(sidikBaris(TEMPLATE, nol));
  });
});

describe("jalur tulis Phase 2B", () => {
  const aksi = readFileSync(join(process.cwd(), "src/lib/actions/unggah-data.ts"), "utf8");

  it("kode kembar ditolak SEBELUM apa pun ditulis", () => {
    expect(aksi).toContain("const kembar = kunciKembar(input.baris);");
    expect(aksi).toContain("tidak ada yang disimpan");
  });

  it("berkas yang sama tidak ditulis dua kali", () => {
    expect(aksi).toContain("const sebelumnya = await batchSama(periode, sidik);");
    expect(aksi).toContain("sudahPernah: true");
  });

  it("unggahan dicatat SEBELUM angkanya ditulis", () => {
    // Dibalik, yang tertinggal saat gagal adalah angka tanpa asal-usul.
    expect(aksi.indexOf("catatBatch(")).toBeLessThan(aksi.indexOf("await upsertPnl("));
    expect(aksi).toContain("tandaiGagal(");
  });

  it("utilitas diturunkan dari rinciannya, tidak diketik ulang", () => {
    expect(aksi).toContain("utilitasBaris({");
    expect(aksi).toContain("rowBeban.utilitas = u.utilitas;");
  });

  it("utilitas yang sudah tersimpan dibaca supaya tidak tergilas jadi nol", () => {
    expect(aksi).toContain("const utilitasLama = new Map((await listExpenses(periode)).map");
    expect(aksi).toContain("tersimpan: utilitasLama.get(o.code) ?? null");
  });

  it("enam kolom baru: kosong tetap kosong, bukan nol", () => {
    expect(aksi).toContain("rowBeban[c] = b.angka[BEBAN_BARU_LABELS[c]] ?? null;");
  });

  it("TIDAK ada reklasifikasi historis", () => {
    // `lainnya`, `ongkos_kirim`, dan `potongan` tidak boleh dipindahkan ke
    // kolom baru mana pun — laporan keuangan yang sudah ditutup tidak ditulis
    // ulang oleh kode.
    expect(aksi).not.toMatch(/platform_fee\s*=\s*.*(lainnya|potongan|ongkos)/i);
    expect(aksi).not.toMatch(/pbjt\s*=\s*.*(lainnya|potongan|ongkos)/i);
  });
});
