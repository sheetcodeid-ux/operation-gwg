import { describe, expect, it } from "vitest";
import {
  barisMingguan,
  dariNullable,
  kelengkapan,
  nilaiAtauNull,
  pertumbuhan,
  rataTransaksi,
  susunMingguan,
  takTahu,
  terukur,
  type MingguMentah,
  type SumberMingguan,
} from "./mingguan";

/**
 * TEST CONTRACT N-13 — bagian yang bisa dijawab tanpa basis data.
 *
 * Satu kalimat yang dijaga seluruh berkas ini: TIDAK ADA SATU PUN KEADAAN yang
 * mengubah "tidak diketahui" menjadi nol. Bukan pax kosong, bukan struk nol,
 * bukan minggu tanpa pembanding, bukan outlet tanpa cabang.
 */

const minggu = (p: Partial<MingguMentah> & { minggu: number }): MingguMentah => ({
  hariMinggu: 7,
  hariAda: 7,
  net: 1_000_000,
  pax: 500,
  bills: 400,
  ...p,
});

const outlet = (p: Partial<SumberMingguan> = {}): SumberMingguan => ({
  outletId: "o1",
  nama: "Nordu Contoh",
  kode: "NC01",
  area: "Area Utara",
  coordinator: "Wika",
  cabang: "18-fnb_nord",
  minggu: [minggu({ minggu: 1 }), minggu({ minggu: 2 })],
  mingguLalu: null,
  sumberSah: true,
  targetBulanan: 30_000_000,
  ...p,
});

/* ─────────────────────────── CASE 1 ─────────────────────────── */

describe("CASE 1 — weekly sales normal, pax & bills lengkap", () => {
  const b = barisMingguan(outlet({ minggu: [minggu({ minggu: 1, net: 7_000_000, pax: 500, bills: 400 })] }));

  it("sales, pax, dan bills semuanya diketahui", () => {
    expect(b.sel[0].sales).toEqual({ diketahui: true, nilai: 7_000_000 });
    expect(b.sel[0].pax).toEqual({ diketahui: true, nilai: 500 });
    expect(b.sel[0].bills).toEqual({ diketahui: true, nilai: 400 });
  });

  it("rata transaksi = net ÷ bills", () => {
    expect(b.sel[0].rataTransaksi).toEqual({ diketahui: true, nilai: 17_500 });
  });

  it("kelengkapan penuh ketika seluruh hari minggunya sudah terhitung", () => {
    expect(b.sel[0].kelengkapan).toEqual({ diketahui: true, nilai: 100 });
  });
});

/* ─────────────────────────── CASE 2 & 3 ─────────────────────────── */

describe("CASE 2 — pax NULL", () => {
  const b = barisMingguan(outlet({ minggu: [minggu({ minggu: 1, pax: null })] }));

  it("pax UNKNOWN / data_tidak_tersedia, BUKAN nol", () => {
    expect(b.sel[0].pax).toEqual({ diketahui: false, alasan: "data_tidak_tersedia" });
    expect(nilaiAtauNull(b.sel[0].pax)).toBeNull();
  });

  it("sales tetap terbaca — satu kolom kosong tidak menjatuhkan yang lain", () => {
    expect(b.sel[0].sales.diketahui).toBe(true);
  });

  it("tidak ada label NO_TRAFFIC di mana pun", () => {
    expect(JSON.stringify(b)).not.toMatch(/NO_TRAFFIC|no_traffic/);
  });
});

describe("CASE 3 — bills NULL", () => {
  const b = barisMingguan(outlet({ minggu: [minggu({ minggu: 1, bills: null })] }));

  it("bills UNKNOWN, dan rata transaksi ikut UNKNOWN", () => {
    expect(b.sel[0].bills).toEqual({ diketahui: false, alasan: "data_tidak_tersedia" });
    expect(b.sel[0].rataTransaksi.diketahui).toBe(false);
  });

  it("tidak ada label NO_TRANSACTION di mana pun", () => {
    expect(JSON.stringify(b)).not.toMatch(/NO_TRANSACTION|no_transaction/);
  });
});

/* ─────────────────────────── CASE 8 ─────────────────────────── */

describe("CASE 8 — previous week tidak ada", () => {
  it("minggu ke-1 tanpa bulan sebelumnya → growth UNKNOWN", () => {
    const b = barisMingguan(outlet({ minggu: [minggu({ minggu: 1 })], mingguLalu: null }));
    expect(b.sel[0].pertumbuhan).toEqual({ diketahui: false, alasan: "tanpa_minggu_sebelumnya" });
  });

  it("BUKAN 0% dan BUKAN +100%", () => {
    const b = barisMingguan(outlet({ minggu: [minggu({ minggu: 1 })], mingguLalu: null }));
    expect(nilaiAtauNull(b.sel[0].pertumbuhan)).toBeNull();
  });

  it("minggu ke-2 memakai minggu ke-1 sebagai pembanding", () => {
    const b = barisMingguan(
      outlet({ minggu: [minggu({ minggu: 1, net: 100 }), minggu({ minggu: 2, net: 150 })] }),
    );
    expect(b.sel[1].pertumbuhan).toEqual({ diketahui: true, nilai: 50 });
  });

  it("minggu ke-1 memakai minggu TERAKHIR bulan lalu", () => {
    const b = barisMingguan(
      outlet({
        minggu: [minggu({ minggu: 1, net: 200 })],
        mingguLalu: minggu({ minggu: 5, hariMinggu: 3, hariAda: 3, net: 100 }),
      }),
    );
    expect(b.sel[0].pertumbuhan).toEqual({ diketahui: true, nilai: 100 });
  });
});

/* ─────────────────────────── CASE 11 & 12 ─────────────────────────── */

describe("CASE 11 — bills = 0 (terukur nol, bukan null)", () => {
  const b = barisMingguan(outlet({ minggu: [minggu({ minggu: 1, bills: 0 })] }));

  it("bills DIKETAHUI bernilai nol — nol adalah pengukuran", () => {
    expect(b.sel[0].bills).toEqual({ diketahui: true, nilai: 0 });
  });

  it("rata transaksi UNKNOWN / tanpa_struk — tidak ∞, tidak 0, tidak melempar", () => {
    expect(b.sel[0].rataTransaksi).toEqual({ diketahui: false, alasan: "tanpa_struk" });
  });

  it("langsung: rataTransaksi menolak penyebut nol dan negatif", () => {
    expect(rataTransaksi(terukur(100), terukur(0))).toEqual({ diketahui: false, alasan: "tanpa_struk" });
    expect(rataTransaksi(terukur(100), terukur(-5))).toEqual({ diketahui: false, alasan: "penyebut_tidak_sah" });
    expect(nilaiAtauNull(rataTransaksi(terukur(100), terukur(0)))).toBeNull();
  });
});

describe("CASE 12 — previous week = 0", () => {
  it("growth UNKNOWN / penyebut_tidak_sah, bukan Infinity", () => {
    const b = barisMingguan(
      outlet({ minggu: [minggu({ minggu: 1, net: 500 })], mingguLalu: minggu({ minggu: 5, net: 0 }) }),
    );
    expect(b.sel[0].pertumbuhan).toEqual({ diketahui: false, alasan: "penyebut_tidak_sah" });
  });

  it("langsung: pertumbuhan tidak pernah menghasilkan angka tak terhingga", () => {
    const h = pertumbuhan(terukur(10), terukur(0));
    expect(h.diketahui).toBe(false);
    expect(Number.isFinite(nilaiAtauNull(h) ?? 0)).toBe(true);
  });

  it("penyebut negatif juga ditolak", () => {
    expect(pertumbuhan(terukur(10), terukur(-3))).toEqual({ diketahui: false, alasan: "penyebut_tidak_sah" });
  });
});

/* ─────────────────────────── CASE 13 ─────────────────────────── */

describe("CASE 13 — outlet tanpa esb_branch_id", () => {
  const b = barisMingguan(outlet({ cabang: null }));

  it("seluruh selnya UNKNOWN / tanpa_cabang — bukan Rp 0", () => {
    for (const s of b.sel) {
      expect(s.sales).toEqual({ diketahui: false, alasan: "tanpa_cabang" });
      expect(s.pax).toEqual({ diketahui: false, alasan: "tanpa_cabang" });
      expect(s.bills).toEqual({ diketahui: false, alasan: "tanpa_cabang" });
    }
  });

  it("barisnya TETAP ADA — ditandai, bukan dihilangkan dari tabel", () => {
    expect(b.outletId).toBe("o1");
    expect(b.sel).toHaveLength(2);
  });

  it("kelengkapan bulan juga tanpa_cabang, bukan 0%", () => {
    expect(b.kelengkapanBulan).toEqual({ diketahui: false, alasan: "tanpa_cabang" });
  });
});

/* ─────────────────────────── CASE 14 ─────────────────────────── */

describe("CASE 14 — outlet belum genap 3 bulan (tanpa target)", () => {
  it("target UNKNOWN / tanpa_target, BUKAN target 0", () => {
    const b = barisMingguan(outlet({ targetBulanan: null }));
    expect(b.targetBulananKonteks).toEqual({ diketahui: false, alasan: "tanpa_target" });
    expect(nilaiAtauNull(b.targetBulananKonteks)).toBeNull();
  });

  it("target yang ADA tetap dibawa apa adanya, tanpa dibagi apa pun", () => {
    const b = barisMingguan(outlet({ targetBulanan: 30_000_000 }));
    expect(b.targetBulananKonteks).toEqual({ diketahui: true, nilai: 30_000_000 });
  });
});

/* ─────────────────────────── CASE 15 ─────────────────────────── */

describe("CASE 15 — sumber tidak sah (esb_mulai / esb_abaikan)", () => {
  const b = barisMingguan(outlet({ sumberSah: false }));

  it("seluruh angkanya UNKNOWN / sumber_tidak_sah", () => {
    expect(b.sel[0].sales).toEqual({ diketahui: false, alasan: "sumber_tidak_sah" });
    expect(b.sel[0].pax).toEqual({ diketahui: false, alasan: "sumber_tidak_sah" });
  });

  it("penandanya ikut terbawa ke baris supaya bisa disebut di layar", () => {
    expect(b.sumberSah).toBe(false);
  });
});

/* ─────────────────────────── CASE 16 ─────────────────────────── */

describe("CASE 16 — minggu tak sama panjang wajib ditandai", () => {
  it("minggu ke-1 (7 hari) vs minggu terakhir bulan lalu (3 hari) → tidak sebanding", () => {
    const b = barisMingguan(
      outlet({
        minggu: [minggu({ minggu: 1, hariAda: 7, net: 700 })],
        mingguLalu: minggu({ minggu: 5, hariMinggu: 3, hariAda: 3, net: 300 }),
      }),
    );
    expect(b.sel[0].sebanding).toBe(false);
    // Angkanya TETAP dihitung — ia bukan karangan, ia cuma tidak setara.
    expect(b.sel[0].pertumbuhan).toEqual({ diketahui: true, nilai: 133.33333333333331 });
  });

  it("dua minggu penuh yang sama panjang → sebanding", () => {
    const b = barisMingguan(
      outlet({ minggu: [minggu({ minggu: 1, net: 100 }), minggu({ minggu: 2, net: 120 })] }),
    );
    expect(b.sel[1].sebanding).toBe(true);
  });
});

/* ─────────────────────────── CASE 17 ─────────────────────────── */

describe("CASE 17 — minggu berjalan baru 2 hari", () => {
  const b = barisMingguan(
    outlet({
      minggu: [minggu({ minggu: 1, hariAda: 7, net: 700 }), minggu({ minggu: 2, hariAda: 2, net: 200 })],
    }),
  );

  it("kelengkapan minggu berjalan tampil apa adanya", () => {
    expect(b.sel[1].kelengkapan).toEqual({ diketahui: true, nilai: (2 / 7) * 100 });
    expect(b.sel[1].hariAda).toBe(2);
    expect(b.sel[1].hariMinggu).toBe(7);
  });

  it("dibandingkan minggu penuh → ditandai tidak sebanding", () => {
    expect(b.sel[1].sebanding).toBe(false);
  });

  it("angkanya TIDAK dinaikkan ke tujuh hari — tidak ada ekstrapolasi", () => {
    expect(b.sel[1].sales).toEqual({ diketahui: true, nilai: 200 });
  });
});

/* ─────────────────────────── CASE 19 ─────────────────────────── */

describe("CASE 19 — kelengkapan nol (belum ada satu hari pun)", () => {
  const b = barisMingguan(
    outlet({ minggu: [minggu({ minggu: 1, hariAda: 0, net: null, pax: null, bills: null })] }),
  );

  it("seluruh metriknya UNKNOWN", () => {
    expect(b.sel[0].sales.diketahui).toBe(false);
    expect(b.sel[0].pax.diketahui).toBe(false);
    expect(b.sel[0].rataTransaksi.diketahui).toBe(false);
    expect(b.sel[0].pertumbuhan.diketahui).toBe(false);
  });

  it("kelengkapan 0% adalah angka yang diketahui — nol hari memang terukur", () => {
    expect(b.sel[0].kelengkapan).toEqual({ diketahui: true, nilai: 0 });
  });
});

/* ─────────────────── pagar umum: kosong tidak pernah jadi nol ─────────────────── */

describe("pagar — kosong tidak pernah menjadi nol", () => {
  it("dariNullable meloloskan 0 tapi menolak null dan undefined", () => {
    expect(dariNullable(0)).toEqual({ diketahui: true, nilai: 0 });
    expect(dariNullable(null)).toEqual({ diketahui: false, alasan: "data_tidak_tersedia" });
    expect(dariNullable(undefined)).toEqual({ diketahui: false, alasan: "data_tidak_tersedia" });
  });

  it("dariNullable menolak NaN dan Infinity — angka yang tidak terurai bukan angka", () => {
    expect(dariNullable(Number.NaN).diketahui).toBe(false);
    expect(dariNullable(Number.POSITIVE_INFINITY).diketahui).toBe(false);
  });

  it("bentuk Terukur tidak punya properti numerik saat tidak diketahui", () => {
    const t = takTahu("data_tidak_tersedia");
    expect(Object.prototype.hasOwnProperty.call(t, "nilai")).toBe(false);
  });

  it("kelengkapan dengan minggu nol hari tidak membagi nol", () => {
    expect(kelengkapan(0, 0)).toEqual({ diketahui: false, alasan: "data_tidak_tersedia" });
  });

  it("kelengkapan tidak pernah melebihi 100 walau hariAda melebihi panjang minggunya", () => {
    expect(kelengkapan(9, 7)).toEqual({ diketahui: true, nilai: 100 });
  });
});

describe("susunMingguan", () => {
  it("mengurutkan baris menurut nama supaya tabelnya stabil", () => {
    const b = susunMingguan([
      outlet({ outletId: "b", nama: "Zulu" }),
      outlet({ outletId: "a", nama: "Alfa" }),
    ]);
    expect(b.map((x) => x.nama)).toEqual(["Alfa", "Zulu"]);
  });

  it("kelengkapan bulan hanya menghitung minggu yang SUDAH DIMULAI", () => {
    // Minggu ke-2 belum datang: hariAda 0 dan net null. Ia tidak boleh menyeret
    // kelengkapan bulan turun — minggu yang belum datang bukan data yang hilang.
    const b = barisMingguan(
      outlet({
        minggu: [minggu({ minggu: 1, hariAda: 7 }), minggu({ minggu: 2, hariAda: 0, net: null, pax: null, bills: null })],
      }),
    );
    expect(b.kelengkapanBulan).toEqual({ diketahui: true, nilai: 100 });
  });
});
