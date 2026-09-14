import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { barisKpi, hitungTarget } from "./hitung";
import { indikatorPosisi } from "./indikator";
import { POSISI } from "./struktur";

const cari = (posisi: string, key: string) => indikatorPosisi(posisi as never).find((i) => i.key === key)!;

describe("target pertumbuhan tidak boleh lahir dari angka minus", () => {
  const konteks = { jumlahBrand: 1, jumlahOutlet: 1, actualBulanLalu: 0, jumlahPekerjaan: null, rataTigaBulan: null, dasarPorsi: null };

  it("bulan lalu minus atau nol tidak menghasilkan target", () => {
    // Dikalikan 1,1 hasilnya tetap nol atau justru makin minus. Target minus
    // membuat capaian terbaca terbalik: makin buruk actual-nya, makin besar
    // persentasenya.
    expect(hitungTarget({ jenis: "tumbuh", pertumbuhan: 10 }, { ...konteks, actualBulanLalu: -178.5 })).toBeNull();
    expect(hitungTarget({ jenis: "tumbuh", pertumbuhan: 10 }, { ...konteks, actualBulanLalu: 0 })).toBeNull();
  });

  it("bulan lalu positif tetap menghasilkan target", () => {
    expect(hitungTarget({ jenis: "tumbuh", pertumbuhan: 10 }, { ...konteks, actualBulanLalu: 1000 })).toBe(1100);
  });
});

describe("target yang mengikuti pekerjaan yang masuk", () => {
  const pelunasan = cari("finance_accounting", "pelunasan");

  it("tidak ada pekerjaan DAN tidak ada kegagalan berarti selesai seluruhnya", () => {
    // Diputuskan pemiliknya. Target nol di tempat lain berarti "belum
    // ditetapkan"; di sini artinya "tidak ada yang perlu dikerjakan", dan
    // bulan yang bersih tidak boleh terbaca "Belum terukur".
    const b = barisKpi({ indikator: pelunasan, bobot: 50, target: 0, actual: 0 });
    expect(b.persentase).toBe(100);
    expect(b.persenActual).toBe(50);
  });

  it("satu pekerjaan yang tuntas tetap 100%, yang terlambat menurunkannya", () => {
    expect(barisKpi({ indikator: pelunasan, bobot: 50, target: 1, actual: 1 }).persentase).toBe(100);
    expect(barisKpi({ indikator: pelunasan, bobot: 50, target: 2, actual: 1 }).persentase).toBe(50);
  });

  it("targetnya benar-benar dihitung dari jumlah catatan, bukan dibiarkan kosong", () => {
    const mesin = readFileSync(join(process.cwd(), "src/lib/data/kpi.ts"), "utf8");
    expect(mesin).toContain("k.jumlahEntri(i.actual.entri)");
  });
});

describe("satuan yang dibaca orang", () => {
  it("Follower Growth dan Kecepatan & Ketepatan bersatuan persen", () => {
    expect(cari("creative_sosmed", "follower_growth").satuan).toBe("persen");
    expect(cari("creative_sosmed", "kecepatan").satuan).toBe("persen");
  });

  it("Keberhasilan Pasar bersatuan persen", () => {
    expect(cari("pdq_food", "keberhasilan_pasar").satuan).toBe("persen");
    expect(cari("pdq_beverage", "keberhasilan_pasar").satuan).toBe("persen");
  });

  it("Efisiensi Beban Operasional membawa rupiahnya", () => {
    // Capaian 92% tidak memberi tahu siapa pun berapa rupiah yang dibelanjakan,
    // dan rupiah itulah yang dibicarakan saat angkanya dipertanyakan.
    const mesin = readFileSync(join(process.cwd(), "src/lib/data/kpi.ts"), "utf8");
    expect(mesin).toContain('i.key === "efisiensi" && k.efisiensi');
    expect(mesin).toContain("k.efisiensi.ringkas.totalActual");
  });

  it("actual minus dijelaskan, tidak dibiarkan berdiri sebagai 0%", () => {
    const mesin = readFileSync(join(process.cwd(), "src/lib/data/kpi.ts"), "utf8");
    expect(mesin).toContain("Actual-nya minus");
  });
});

describe("siapa yang dinilai", () => {
  const p = (kode: string) => POSISI.find((x) => x.kode === kode)!;

  it("Finance bertambah Sri", () => {
    expect(p("finance_finance").pic).toContain("Sri");
  });

  it("Content Creator dan Sosial Media dinilai sebagai satu kesatuan", () => {
    // Tanpa perPic, halamannya tidak lagi menuntut memilih nama lebih dulu.
    expect(p("creative_content").perPic).toBeFalsy();
    expect(p("creative_sosmed").perPic).toBeFalsy();
    expect(p("creative_content").pic).toEqual(["Dhimas", "Ricky", "Seka", "Via"]);
    expect(p("creative_sosmed").pic).toEqual(["Zia", "Dita", "Marta"]);
  });
});

describe("bulan bawaan mengikuti tanggal tutup", () => {
  const mesin = readFileSync(join(process.cwd(), "src/lib/data/kpi.ts"), "utf8");

  it("sebelum tanggal 15 membuka bulan lalu, bukan bulan berjalan", () => {
    // Penilaian satu bulan baru ditutup tanggal 15 bulan berikutnya. Membuka
    // bulan berjalan pada tanggal 1–14 menyodorkan halaman yang hampir
    // seluruhnya kosong, dan yang membukanya mengira datanya hilang.
    expect(mesin).toContain("TANGGAL_TUTUP_KPI = 15");
    expect(mesin).toContain("wib.getUTCDate() >= TANGGAL_TUTUP_KPI ? bulan : bulanSebelum(bulan)");
  });
});

describe("tabel tanpa batas halaman", () => {
  const tabel = readFileSync(join(process.cwd(), "src/components/ui/data-table.tsx"), "utf8");

  it("bawaannya menampilkan seluruh baris", () => {
    expect(tabel).toContain("pageSize = 0,");
  });

  it("tidak ada lagi halaman yang dipatok di pemanggilnya", () => {
    expect(tabel).toContain("pageSize > 0");
  });
});

describe("tampilan PDF", () => {
  const pdf = readFileSync(join(process.cwd(), "src/components/kpi/laporan-pdf.tsx"), "utf8");

  it("kertas milimeter di belakang grafik dibuang", () => {
    expect(pdf).not.toContain("background-size:22px 22px");
    expect(pdf).not.toMatch(/linear-gradient\(90deg, \$\{t\.grid\}/);
  });

  it("grafik capaian dibuat lebih tinggi dan selebar halaman", () => {
    expect(pdf).toContain("const H = 380;");
    expect(pdf).toContain(".charts { display:block; }");
  });
});

describe("Sosial Media: keempat indikator kualitas diisi per brand", () => {
  const sm = (key: string) => cari("creative_sosmed", key);

  it("keempatnya diisi per brand lalu dijumlah", () => {
    // Termasuk Follower Growth — diputuskan pemiliknya. Angka tiap brand
    // dijumlahkan menjadi satu capaian posisi, sama seperti tiga indikator
    // jumlah konten di atasnya.
    for (const k of ["interaksi", "follower_growth", "views", "profile_visit"]) {
      expect(sm(k).actual, k).toEqual({ sumber: "manual_brand" });
    }
  });

  it("satuannya tidak berubah: Follower Growth tetap persen", () => {
    expect(sm("follower_growth").satuan).toBe("persen");
  });

  it("hanya ada SATU sumber per-brand, tidak ada varian yang menganggur", () => {
    // Sumber yang tidak dipakai siapa pun hanya menambah cabang yang harus
    // ikut diperiksa tiap kali mesin hitungnya disentuh.
    const daftar = readFileSync(join(process.cwd(), "src/lib/kpi/indikator.ts"), "utf8");
    expect(daftar).not.toContain("manual_brand_rata");
  });
});
