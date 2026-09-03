import { createRoot } from "react-dom/client";
import { PapanKpi } from "@/components/kpi/papan-kpi";
import { barisEfisiensi, barisKpi, ringkasEfisiensi, ringkasKpi } from "@/lib/kpi/hitung";
import { indikatorPosisi } from "@/lib/kpi/indikator";
import { DEPARTEMEN, posisiDari, posisiDepartemen, type KodePosisi } from "@/lib/kpi/struktur";
import { TENGGAT, indikatorPosisi as daftarIndikator } from "@/lib/kpi/indikator";
import type { LaporanKpi } from "@/lib/data/kpi";

const ANGKA: Record<string, [number | null, number | null, number | null]> = {
  konten_post: [40, 31, 64], konten_reels: [40, 22, 71], konten_story: [20, 20, 88],
  design_request: [118, 104, 82], produksi_media: [66, 58, 74], interaksi: [24200, 19880, 91],
  views: [341000, 402500, 66], profile_visit: [null, null, null], kecepatan: [100, 85, 80],
  follower_growth: [1200, 940, 77],
  quality_control: [5, 4, 60], efisiensi: [100, 96, 88], keberhasilan_pasar: [1.5, null, 11],
  review_customer: [15, 2, 40], riset_menu: [4, 3, 50],
  pelunasan: [5, 4, 100], management_fee: [58, 55, 96],
};
const OUTLET: [string, number, number | null, number | null][] = [
  ["Cattu A. Yani", 245633267, 70000000, 3000000],
  ["Nordu Bakes Tanjung Duren", 198400000, 63800000, 3400000],
  ["Ayam Busari Depok", 132050000, 41000000, 2050000],
  ["Lesung Pipi Bogor", 96700000, 33900000, 1900000],
  ["Nordu Kemang", 174320000, null, null],
];

function buat(kode: KodePosisi) {
  const daftar = indikatorPosisi(kode);
  const baris = daftar.map((i) => {
    const [t, a] = ANGKA[i.key] ?? [null, null, null];
    return barisKpi({
      indikator: i, bobot: i.bobot, target: t, actual: a,
      alasan: a === null ? (i.key === "keberhasilan_pasar" ? "Menunggu sambungan penjualan menu dari ESB." : "Belum ada capaian bulan lalu sebagai dasar target.") : undefined,
    });
  });
  const lalu = Object.fromEntries(daftar.map((i) => [i.key, ANGKA[i.key]?.[2] ?? null]));
  const eff = OUTLET.map(([nama, avg, wh, non], i) => barisEfisiensi({ outletId: `o${i}`, outletNama: nama, average: avg, actualWh: wh, actualNonWh: non }));
  const has = (k: string) => daftar.some((i) => i.key === k);
  const entri = [
    { id: "e1", jenis: "event" as const, periode: "2026-09", posisi: kode, tanggal: "2026-09-03", picNama: "Amanda", outletId: null, judul: "Promo Ramadan Nordu", deskripsi: "Aktivasi 12 cabang", nominal: null, nominalSeharusnya: null, tenggat: null, gagal: false, lampiran: [], dibuatNama: "GWG Admin" },
    { id: "e2", jenis: "quality_control" as const, periode: "2026-09", posisi: kode, tanggal: "2026-09-07", picNama: "Mustadi", outletId: "o0", judul: "Kunjungan Cattu A. Yani", deskripsi: "Suhu chiller di atas standar", nominal: null, nominalSeharusnya: null, tenggat: null, gagal: false, lampiran: [], dibuatNama: "GWG Admin" },
    { id: "e3", jenis: "temuan" as const, periode: "2026-09", posisi: kode, tanggal: "2026-09-12", picNama: "Nisa", outletId: null, judul: "Invoice warehouse tidak masuk laporan", deskripsi: "", nominal: null, nominalSeharusnya: null, tenggat: null, gagal: true, lampiran: [], dibuatNama: "GWG Admin" },
  ];

  const laporan: LaporanKpi = {
    posisi: kode, periode: "2026-09", baris, ringkas: ringkasKpi(baris), dikunci: false,
    efisiensi: has("efisiensi") ? { baris: eff, ringkas: ringkasEfisiensi(eff) } : null,
    pasar: has("keberhasilan_pasar") ? {
      baris: [
        { menu: "WIM", penjualan: 5034909, bagian: 0.0371 },
        { menu: "Leopard", penjualan: 20436363, bagian: 0.1508 },
        { menu: "Bubur Ayam", penjualan: 20000, bagian: 0.0001 },
      ], omset: 13552933416, total: 25491272, bagianTotal: 0.1881,
    } : null,
    fee: has("management_fee") ? [
      { outletId: "o0", outletNama: "Cattu A. Yani", netSales: 179341681, feeSeharusnya: 8967084, sesuai: true },
      { outletId: "o1", outletNama: "Nordu Bakes Tanjung Duren", netSales: 198400000, feeSeharusnya: 9920000, sesuai: true },
      { outletId: "o2", outletNama: "Ayam Busari Depok", netSales: 132050000, feeSeharusnya: 6602500, sesuai: false },
    ] : null,
    entri,
  };
  return { laporan, lalu };
}

const kode = (location.hash.replace("#", "") || "creative_content") as KodePosisi;
const p = posisiDari(kode)!;
const { laporan, lalu } = buat(kode);

createRoot(document.getElementById("root")!).render(
  <PapanKpi
    laporan={laporan}
    lalu={lalu}
    namaPosisi={p.nama}
    departemen={p.departemen}
    pic={p.pic}
    indikator={daftarIndikator(kode)}
    outlets={OUTLET.map(([nama], i) => ({ id: `o${i}`, nama }))}
    tenggatHari={TENGGAT[kode] ?? [15]}
    departemenOpsi={DEPARTEMEN.filter((d) => d.posisi.length > 0).map((d) => ({ value: d.kode, label: d.nama }))}
    posisiOpsi={posisiDepartemen(p.departemen).map((x) => ({ value: x.kode, label: x.nama }))}
    bolehAtur
  />,
);
