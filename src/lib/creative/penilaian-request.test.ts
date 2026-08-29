import { describe, expect, it } from "vitest";
import {
  BOBOT_BRIEF,
  BOBOT_WAKTU,
  CEKLIS_KOSONG,
  HEAD_OFFICE,
  HEAD_OFFICE_LABEL,
  daftarPeriode,
  dalamPeriode,
  kategoriWaktu,
  labelDari,
  labelPeriode,
  nilaiPermintaan,
  periodeDari,
  poinBrief,
  rekapArea,
  rekapPemohon,
  selisihHari,
  type BarisNilai,
} from "./penilaian-request";

/**
 * Penilaian terhadap yang MEMINTA design.
 *
 * Permintaannya jelas: "nilai bukan karena subjective". Yang dikunci di sini
 * karena itu bukan angkanya, melainkan dari MANA angkanya datang — begitu
 * bagian yang dihitung kalah berat dari bagian yang dinilai manusia, seluruh
 * dashboard-nya berhenti bisa dipakai sebagai bahan evaluasi dan berubah jadi
 * ajang saling menilai.
 */

const penuh = { tujuanJelas: true, ukuranMedia: true, materiLengkap: true, tanggalTayang: true };

describe("yang dihitung harus lebih berat daripada yang dinilai", () => {
  it("waktu memegang mayoritas poin", () => {
    expect(BOBOT_WAKTU).toBeGreaterThan(BOBOT_BRIEF);
    expect(BOBOT_WAKTU + BOBOT_BRIEF).toBe(100);
  });

  it("brief sempurna TIDAK bisa menyelamatkan permintaan H-1", () => {
    // Inti keluhannya: mendadak itu sendiri yang membuat antrian menumpuk.
    // Kalau ceklis rapi bisa menutupinya, orang akan merapikan tulisan alih-alih
    // memajukan permintaannya — dan masalahnya tidak berubah sama sekali.
    const h1 = nilaiPermintaan("2026-08-01", "2026-08-02", penuh);
    expect(h1.waktu).toBe("mendadak");
    expect(h1.skor).toBe(40);
    expect(h1.label).toBe("merah");
  });

  it("waktu longgar dengan brief kosong tetap belum hijau", () => {
    // Sebaliknya juga tidak boleh: waktu banyak tapi brief kosong berarti
    // desainnya tetap diulang-ulang.
    const n = nilaiPermintaan("2026-08-01", "2026-08-20", CEKLIS_KOSONG);
    expect(n.waktu).toBe("wajar");
    expect(n.skor).toBe(60);
    expect(n.label).toBe("kuning");
  });

  it("terencana dan lengkap barulah hijau", () => {
    const n = nilaiPermintaan("2026-08-01", "2026-08-15", penuh);
    expect(n.skor).toBe(100);
    expect(n.label).toBe("hijau");
  });
});

describe("hitungan harinya tidak bisa diperdebatkan", () => {
  it("selisihnya per hari kalender, bukan per jam", () => {
    // Permintaan pukul 23.00 untuk besok pagi tetap H-1, bukan "0,4 hari".
    expect(selisihHari("2026-08-01T23:00:00Z", "2026-08-02T07:00:00Z")).toBe(1);
  });

  it("tanpa tanggal dibutuhkan bukan nilai bagus", () => {
    // Tidak menyebut kapan dibutuhkan justru membuat antrian tidak bisa
    // diurutkan sama sekali.
    expect(kategoriWaktu(null)).toBe("tanpa_tanggal");
    expect(nilaiPermintaan("2026-08-01", null, penuh).skor).toBe(40);
  });

  it("deadline yang sudah lewat saat diminta terhitung mendadak", () => {
    expect(kategoriWaktu(selisihHari("2026-08-05", "2026-08-03"))).toBe("mendadak");
  });

  it("batas antar-kategori tepat di angkanya", () => {
    expect(kategoriWaktu(1)).toBe("mendadak");
    expect(kategoriWaktu(2)).toBe("mepet");
    expect(kategoriWaktu(3)).toBe("mepet");
    expect(kategoriWaktu(4)).toBe("cukup");
    expect(kategoriWaktu(6)).toBe("cukup");
    expect(kategoriWaktu(7)).toBe("wajar");
  });
});

describe("ceklisnya fakta, bukan rasa", () => {
  it("tiap butir bernilai sama — tidak ada yang 'lebih penting menurut saya'", () => {
    expect(poinBrief({ ...CEKLIS_KOSONG, tujuanJelas: true })).toBe(10);
    expect(poinBrief({ ...CEKLIS_KOSONG, ukuranMedia: true })).toBe(10);
    expect(poinBrief(penuh)).toBe(BOBOT_BRIEF);
  });
});

describe("label merah/kuning/hijau", () => {
  it("ambangnya tetap dan bisa dibaca siapa pun", () => {
    expect(labelDari(100)).toBe("hijau");
    expect(labelDari(75)).toBe("hijau");
    expect(labelDari(74)).toBe("kuning");
    expect(labelDari(50)).toBe("kuning");
    expect(labelDari(49)).toBe("merah");
  });
});

describe("rekap pemohon — satu tabel, wilayahnya jadi kolom", () => {
  const baris: BarisNilai[] = [
    { pemohonId: "spv_a", pemohonNama: "Kayla", areaId: "area_1", areaNama: "Area Poetri", outletNama: "Nordu Tanjung Duren", periode: "2026-08", skor: 40, hari: 1, waktu: "mendadak" },
    { pemohonId: "spv_a", pemohonNama: "Kayla", areaId: "area_1", areaNama: "Area Poetri", outletNama: "Nordu Tanjung Duren", periode: "2026-08", skor: 40, hari: 0, waktu: "mendadak" },
    { pemohonId: "spv_b", pemohonNama: "Rian", areaId: "area_2", areaNama: "Area Wisnu", outletNama: "Cattu BSD", periode: "2026-07", skor: 100, hari: 10, waktu: "wajar" },
  ];

  it("labelnya dari RATA-RATA, bukan dari permintaan terakhir", () => {
    // Satu permintaan rapi tidak menghapus sepuluh yang mendadak sebelumnya.
    const r = rekapPemohon([...baris, { ...baris[0], skor: 100, hari: 14, waktu: "wajar" }]);
    const a = r.find((x) => x.id === "spv_a")!;
    expect(a.jumlah).toBe(3);
    expect(a.rataSkor).toBe(60);
    expect(a.label).toBe("kuning");
  });

  it("yang paling bermasalah muncul paling atas", () => {
    // Daftar yang diurut dari yang paling rapi tidak menunjukkan siapa pun
    // yang perlu dievaluasi.
    expect(rekapPemohon(baris)[0].id).toBe("spv_a");
  });

  it("persen mendadak dihitung, karena itu angka yang dibawa ke rapat", () => {
    const a = rekapPemohon(baris).find((x) => x.id === "spv_a")!;
    expect(a.mendadak).toBe(2);
    expect(a.persenMendadak).toBe(100);
    expect(a.rataHari).toBe(0.5);
  });

  it("area ikut di barisnya, tidak perlu tabel kedua", () => {
    // Dulu wilayah butuh tampilan sendiri, dan tampilan itu tidak pernah bisa
    // menjawab untuk permintaan kantor yang memang tanpa cabang.
    const a = rekapPemohon(baris).find((x) => x.id === "spv_a")!;
    expect(a.areaNama).toBe("Area Poetri");
    expect(a.outletNama).toBe("Nordu Tanjung Duren");
  });

  it("permintaan kantor punya wilayahnya sendiri, bukan 'tanpa outlet'", () => {
    // "Tanpa outlet" membuat Coordinator Area mencari cabang yang tidak pernah ada.
    const ho: BarisNilai = { ...baris[2], pemohonId: "ops_1", pemohonNama: "Operation", areaId: HEAD_OFFICE, areaNama: HEAD_OFFICE_LABEL, outletNama: null };
    expect(rekapPemohon([ho])[0].areaNama).toBe("Head Office");
  });

  it("yang belum pernah dinilai tidak muncul sama sekali", () => {
    // Label hijau untuk orang yang belum pernah meminta apa pun adalah pujian
    // yang tidak ia kerjakan; label merah lebih buruk lagi.
    expect(rekapPemohon([]).length).toBe(0);
  });

  it("pindah cabang tercatat di wilayah barunya", () => {
    // Barisnya datang terbaru dulu. Kalau yang dipakai wilayah tertua, seorang
    // supervisor yang pindah akan terus muncul di rapor area lamanya.
    const pindah = [{ ...baris[0], areaId: "area_2", areaNama: "Area Wisnu" }, baris[1]];
    expect(rekapPemohon(pindah)[0].areaNama).toBe("Area Wisnu");
  });
});

describe("rekap per area — bahan laporan ke Coordinator Area", () => {
  const baris: BarisNilai[] = [
    { pemohonId: "a", pemohonNama: "Kayla", areaId: "area_1", areaNama: "Area Poetri", outletNama: "A", periode: "2026-08", skor: 20, hari: 0, waktu: "mendadak" },
    { pemohonId: "b", pemohonNama: "Sari", areaId: "area_1", areaNama: "Area Poetri", outletNama: "B", periode: "2026-08", skor: 80, hari: 9, waktu: "wajar" },
    { pemohonId: "c", pemohonNama: "Rian", areaId: "area_2", areaNama: "Area Wisnu", outletNama: "C", periode: "2026-08", skor: 100, hari: 12, waktu: "wajar" },
  ];

  it("mengelompokkan orang di bawah wilayahnya", () => {
    const r = rekapArea(baris);
    expect(r[0].areaNama).toBe("Area Poetri");
    expect(r[0].orang.map((o) => o.nama)).toEqual(["Kayla", "Sari"]);
    expect(r[0].rataSkor).toBe(50);
  });

  it("wilayah terburuk lebih dulu — laporannya dibuka dari yang perlu ditindak", () => {
    expect(rekapArea(baris).map((a) => a.areaId)).toEqual(["area_1", "area_2"]);
  });
});

describe("saringan bulan", () => {
  const baris = [
    { periode: "2026-08", nama: "a" },
    { periode: "2026-07", nama: "b" },
    { periode: "2026-08", nama: "c" },
  ];

  it("bulannya diambil dari tanggal, bukan diurai lewat Date", () => {
    // Diurai lewat `Date`, permintaan 1 Agustus pukul 00.30 WIB berpindah ke
    // Juli di peramban yang zona waktunya UTC.
    expect(periodeDari("2026-08-01T00:30:00+07:00")).toBe("2026-08");
  });

  it("namanya bahasa Indonesia", () => {
    expect(labelPeriode("2026-08")).toBe("Agustus 2026");
    expect(labelPeriode("2026-01")).toBe("Januari 2026");
  });

  it("hanya bulan yang benar-benar punya permintaan yang bisa dipilih", () => {
    // Dua belas bulan mati membuat orang memilih bulan kosong lalu mengira
    // dashboard-nya rusak.
    expect(daftarPeriode(baris)).toEqual([
      { value: "2026-08", label: "Agustus 2026" },
      { value: "2026-07", label: "Juli 2026" },
    ]);
  });

  it("periode kosong berarti seluruh bulan, bukan nol baris", () => {
    expect(dalamPeriode(baris, "").length).toBe(3);
    expect(dalamPeriode(baris, "2026-07").length).toBe(1);
  });
});
