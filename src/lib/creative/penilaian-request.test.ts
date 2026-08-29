import { describe, expect, it } from "vitest";
import {
  BOBOT_BRIEF,
  BOBOT_WAKTU,
  CEKLIS_KOSONG,
  kategoriWaktu,
  labelDari,
  nilaiPermintaan,
  poinBrief,
  rekapPerOutlet,
  rekapPerPemohon,
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

describe("rekap per pemohon dan per outlet", () => {
  const baris: BarisNilai[] = [
    { pemohonId: "spv_a", pemohonNama: "Spv A", outletId: "out_1", outletNama: "Nordu Kemang", skor: 40, hari: 1, waktu: "mendadak" },
    { pemohonId: "spv_a", pemohonNama: "Spv A", outletId: "out_1", outletNama: "Nordu Kemang", skor: 40, hari: 0, waktu: "mendadak" },
    { pemohonId: "spv_b", pemohonNama: "Spv B", outletId: "out_2", outletNama: "Cattu BSD", skor: 100, hari: 10, waktu: "wajar" },
  ];

  it("labelnya dari RATA-RATA, bukan dari permintaan terakhir", () => {
    // Satu permintaan rapi tidak menghapus sepuluh yang mendadak sebelumnya.
    const r = rekapPerPemohon([...baris, { ...baris[0], skor: 100, hari: 14, waktu: "wajar" }]);
    const a = r.find((x) => x.id === "spv_a")!;
    expect(a.jumlah).toBe(3);
    expect(a.rataSkor).toBe(60);
    expect(a.label).toBe("kuning");
  });

  it("yang paling bermasalah muncul paling atas", () => {
    // Daftar yang diurut dari yang paling rapi tidak menunjukkan siapa pun
    // yang perlu dievaluasi.
    expect(rekapPerPemohon(baris)[0].id).toBe("spv_a");
  });

  it("persen mendadak dihitung, karena itu angka yang dibawa ke rapat", () => {
    const a = rekapPerPemohon(baris).find((x) => x.id === "spv_a")!;
    expect(a.mendadak).toBe(2);
    expect(a.persenMendadak).toBe(100);
    expect(a.rataHari).toBe(0.5);
  });

  it("permintaan tanpa outlet tidak dibuang, dikelompokkan sendiri", () => {
    // Dibuang, total di dashboard tidak akan pernah cocok dengan jumlah
    // permintaan yang sebenarnya masuk.
    const r = rekapPerOutlet([...baris, { ...baris[2], outletId: null, outletNama: null }]);
    expect(r.some((x) => x.nama === "Manajemen (tanpa outlet)")).toBe(true);
    expect(r.reduce((a, x) => a + x.jumlah, 0)).toBe(4);
  });

  it("yang belum pernah dinilai tidak muncul sama sekali", () => {
    // Label hijau untuk orang yang belum pernah meminta apa pun adalah pujian
    // yang tidak ia kerjakan; label merah lebih buruk lagi.
    expect(rekapPerPemohon([]).length).toBe(0);
  });
});
