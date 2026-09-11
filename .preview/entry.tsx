import { createRoot } from "react-dom/client";
import { Sidebar } from "@/components/layout/sidebar";
import { SidebarProvider } from "@/components/layout/sidebar-context";
import { NavLockProvider } from "@/components/layout/nav-lock";
import { I18nProvider } from "@/lib/i18n/provider";
import { navAll, accessibleMenuKeys } from "@/lib/nav";
import { PapanKpi } from "@/components/kpi/papan-kpi";
import { PapanManajemen } from "@/components/kpi/papan-manajemen";
import { SETELAN_BAWAAN, departemenKpi, hitungManajemen } from "@/lib/kpi/manajemen";
import { hitungMinggu, korporatMinggu, mingguBulan } from "@/lib/kpi/minggu";
import type { DetailManajemen } from "@/lib/data/kpi-manajemen";
import { barisEfisiensi, barisKpi, ringkasEfisiensi, ringkasKpi } from "@/lib/kpi/hitung";
import { indikatorPosisi } from "@/lib/kpi/indikator";
import { posisiDari, posisiDepartemen, type KodePosisi } from "@/lib/kpi/struktur";
import { TENGGAT, indikatorPosisi as daftarIndikator } from "@/lib/kpi/indikator";
import type { LaporanKpi } from "@/lib/data/kpi";

const ANGKA: Record<string, [number | null, number | null, number | null]> = {
  gross_sales: [4_186_500_000, 3_942_180_000, 88], net_profit: [1_182_654_000, 1_010_400_000, 74],
  hygiene_cctv: [40, 31, 62], komplain_area: [20, 6, 80], hpp: [40, 37.4, 100],
  konten_post: [40, 31, 64], konten_reels: [40, 22, 71], konten_story: [20, 20, 88],
  design_request: [118, 104, 82], produksi_media: [66, 58, 74], interaksi: [24200, 19880, 91],
  views: [341000, 402500, 66], profile_visit: [null, null, null], kecepatan: [100, 85, 80],
  follower_growth: [1200, 940, 77],
  quality_control: [5, 4, 60], efisiensi: [100, 96, 88], keberhasilan_pasar: [1.5, null, 11],
  qc_quality: [95, 91, 88], qc_hygiene: [95, 96, 90], qc_sop: [95, 89, 84],
  qc_complaint: [20, 14, 92], qc_cctv: [40, 33, 78], qc_reporting: [100, 100, 96],
  review_customer: [15, 2, 40], riset_menu: [4, 3, 50],
  pelunasan: [5, 4, 100], management_fee: [58, 55, 96],
  hc_pemenuhan_rekrutmen: [90, 82, 88], hc_kecepatan_rekrutmen: [30, 24, 92],
  hc_kepatuhan_kontrak: [95, 91, 94], hc_kepatuhan_laporan: [90, 76, 81],
  hc_penyelesaian_onboarding: [85, 88, 90], hc_turnover: [10, 7.4, 86],
  data_integrity: [4, 4, 95], reporting_timeliness: [4, 3, 100],
  software_complaint: [5, 1, 60], problem_solver_data: [10, 8, 70],
  pos_masterdata: [5, 6, 80], pos_sla: [5, 4, 100],
  pos_refresh: [4, 3, 75], pos_uptime: [100, 83.87, 96.7],
};
const OUTLET: [string, number, number | null, number | null][] = [
  ["Cattu A. Yani", 245633267, 70000000, 3000000],
  ["Nordu Bakes Tanjung Duren", 198400000, 63800000, 3400000],
  ["Ayam Busari Depok", 132050000, 41000000, 2050000],
  ["Lesung Pipi Bogor", 96700000, 33900000, 1900000],
  ["Nordu Kemang", 174320000, null, null],
];

/** Katalog menu ESB tiruan — nama dan harga yang bentuknya seperti aslinya. */
const MENU_ESB = [
  ["WIM", "Coffee Based", 5_034_909],
  ["Leopard", "Coffee Based", 20_436_363],
  ["Bubur Ayam", "Main Course", 20_000],
  ["Butter Croissant", "Pastry", 8_412_500],
  ["Ayam Goreng Busari Paha", "Main Course", 14_900_000],
  ["Es Teh Manis", "Non Coffee", 3_240_000],
  ["Nasi Goreng Kampung", "Main Course", 6_180_000],
  ["Matcha Latte", "Non Coffee", 11_720_000],
].map(([menu, kategori, estimasi]) => ({ menu: menu as string, kategori: kategori as string, estimasi: estimasi as number }));


/** Rincian mingguan tiruan: dua minggu penuh, minggu ketiga baru tiga hari. */
function mingguContoh(baris: [string, string, number, boolean][]) {
  const mg = mingguBulan("2026-09");
  const hari = 30;
  const sumber = baris.map(([id, nama, target, manual], i) => ({
    id,
    nama,
    kode: id,
    targetBulan: target,
    actual: manual
      ? mg.map(() => null)
      : mg.map((m, j) => (j <= 2 ? (target / hari) * (j === 2 ? 3 : m.hari) * [0.94, 1.03, 0.88][i % 3] : null)),
    hariAda: mg.map((m, j) => (manual ? 0 : j <= 1 ? m.hari : j === 2 ? 3 : 0)),
    tanpaRincian: manual,
  }));
  const hasil = hitungMinggu(sumber, mg, hari);
  return { minggu: mg, baris: hasil, korporat: korporatMinggu(hasil, mg, hari), tanpaRincian: hasil.filter((b) => b.tanpaRincian).length };
}

function buat(kode: KodePosisi) {
  const daftar = indikatorPosisi(kode);
  const baris = daftar.map((i) => {
    const [t, a] = ANGKA[i.key] ?? [null, null, null];
    return barisKpi({
      indikator: i, bobot: i.bobot, target: t, actual: a,
      ...(i.key === "hpp" ? { actualNominal: 261_900_000, targetNominal: 280_256_000 } : {}),
      alasan: a === null ? (i.key === "keberhasilan_pasar" ? "Menunggu sambungan penjualan menu dari ESB." : "Belum ada capaian bulan lalu sebagai dasar target.") : undefined,
    });
  });
  const lalu = Object.fromEntries(daftar.map((i) => [i.key, { persen: ANGKA[i.key]?.[2] ?? null, actual: ANGKA[i.key]?.[1] ?? null }]));
  const eff = OUTLET.map(([nama, avg, wh, non], i) => barisEfisiensi({ outletId: `o${i}`, outletNama: nama, average: avg, actualWh: wh, actualNonWh: non }));
  const has = (k: string) => daftar.some((i) => i.key === k);
  const entri = [
    { id: "e1", jenis: "event" as const, periode: "2026-09", posisi: kode, tanggal: "2026-09-03", picNama: "Amanda", outletId: null, judul: "Promo Ramadan Nordu", deskripsi: "Aktivasi 12 cabang", nominal: null, nominalSeharusnya: null, tenggat: null, gagal: false, lampiran: [], dibuatNama: "GWG Admin" },
    { id: "e2", jenis: "quality_control" as const, periode: "2026-09", posisi: kode, tanggal: "2026-09-07", picNama: "Mustadi", outletId: "o0", judul: "Kunjungan Cattu A. Yani", deskripsi: "Suhu chiller di atas standar", nominal: null, nominalSeharusnya: null, tenggat: null, gagal: false, lampiran: [], dibuatNama: "GWG Admin" },
    { id: "e3", jenis: "temuan" as const, periode: "2026-09", posisi: kode, tanggal: "2026-09-12", picNama: "Nisa", outletId: null, judul: "Invoice warehouse tidak masuk laporan", deskripsi: "", nominal: null, nominalSeharusnya: null, tenggat: null, gagal: true, lampiran: [], dibuatNama: "GWG Admin" },
    { id: "e4", jenis: "pos_masterdata" as const, periode: "2026-09", posisi: kode, tanggal: "2026-09-04", picNama: "Evan Wijaya", outletId: null, semuaOutlet: true, kategori: "Setting Promo / Program", judul: "", deskripsi: "Promo Gajian 25%", nominal: null, nominalSeharusnya: null, tenggat: null, selesai: null, hariLewat: null, gagal: false, lampiran: [], dibuatNama: "GWG Admin" },
    { id: "e5", jenis: "pos_sla" as const, periode: "2026-09", posisi: kode, tanggal: "2026-09-08", picNama: "Evan Wijaya", outletId: "o0", semuaOutlet: false, kategori: "Update Harga", judul: "", deskripsi: "Menunggu konfirmasi harga baru", nominal: null, nominalSeharusnya: null, tenggat: null, selesai: "2026-09-11", hariLewat: 2, gagal: true, lampiran: [], dibuatNama: "GWG Admin" },
    { id: "e6", jenis: "pos_uptime" as const, periode: "2026-09", posisi: kode, tanggal: "2026-09-09", picNama: "Evan Wijaya", outletId: null, semuaOutlet: true, kategori: "Monitoring tanggal 9", judul: "", deskripsi: "", nominal: null, nominalSeharusnya: null, tenggat: null, selesai: null, hariLewat: null, gagal: false, lampiran: [], dibuatNama: "GWG Admin" },
    { id: "e7", jenis: "laporan_owner" as const, periode: "2026-09", posisi: kode, tanggal: "2026-09-08", picNama: "Fikri", outletId: null, semuaOutlet: false, kategori: "Laporan tanggal 8", judul: "", deskripsi: "Terkirim pukul 16.40", nominal: null, nominalSeharusnya: null, tenggat: null, selesai: null, hariLewat: null, gagal: false, lampiran: [], dibuatNama: "GWG Admin" },
  ].map((e) => ({ semuaOutlet: false, kategori: "", selesai: null, hariLewat: null, ...e }));

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
    ca: kode === "operational_ca" ? {
      outlet: [], belumTigaBulan: [], grossSales: 4_186_500_000, rataTiga: 3_640_000_000,
      komplain: 6, netProfit: 1_010_400_000, hpp: 37.4, hppNominal: 261_900_000, hppDasar: 700_640_000, jumlahPic: 1, bulanKosong: [], tanpaGross: [],
      minggu: mingguContoh([
        ["o0", "Nordu Coffee Sambas", 458_000_000, false],
        ["o1", "Nordu Coffee Siantan", 0, true],
        ["o2", "Ayam Goreng Busari Siantan", 0, true],
        ["o3", "Ayam Goreng Busari Serdam", 0, true],
        ["o5", "Nordu Landak", 0, true],
        ["o4", "Cattu M. Sohor", 316_700_000, false],
      ]),
      detail: [
        { outletId: "o0", outletNama: "Nordu Coffee Sambas", cabang: "b0", gross: 412_500_000, dariEsb: true, grossKetik: null, netProfit: 110_000_000, hppNominal: 149_800_000, grossManual: false, grossTangan: false, average: 398_200_000, ikut: true },
        { outletId: "o1", outletNama: "Nordu Coffee Siantan", cabang: null, gross: null, dariEsb: false, grossKetik: null, netProfit: null, hppNominal: null, grossManual: true, grossTangan: true, average: null, ikut: false },
        { outletId: "o2", outletNama: "Ayam Goreng Busari Siantan", cabang: null, gross: null, dariEsb: false, grossKetik: null, netProfit: null, hppNominal: null, grossManual: true, grossTangan: true, average: null, ikut: false },
        { outletId: "o3", outletNama: "Ayam Goreng Busari Serdam", cabang: null, gross: null, dariEsb: false, grossKetik: null, netProfit: null, hppNominal: null, grossManual: true, grossTangan: true, average: null, ikut: false },
        { outletId: "o5", outletNama: "Nordu Landak", cabang: "b5", gross: 300_896_908, dariEsb: true, grossKetik: null, netProfit: null, hppNominal: null, grossManual: true, grossTangan: false, average: null, ikut: false },
        { outletId: "o4", outletNama: "Cattu M. Sohor", cabang: "b4", gross: 288_140_000, dariEsb: true, grossKetik: null, netProfit: 74_500_000, hppNominal: 112_100_000, grossManual: false, grossTangan: false, average: 275_400_000, ikut: true },
      ],
    } : null,
  };
  return { laporan, lalu };
}

/** Contoh KPI Manajemen — angkanya sekadar bentuk, bukan data sungguhan. */
const OUTLET_MJ = [
  { id: "1", nama: "Nordu Coffee Sambas", kode: "NCSB", umur: null, bulanLalu: [412_000_000, 398_000_000, 405_000_000] as [number, number, number], actual: 421_500_000 },
  { id: "2", nama: "Cattu A. Yani", kode: "CCAY", umur: null, bulanLalu: [245_000_000, 251_000_000, 238_000_000] as [number, number, number], actual: 233_000_000 },
  { id: "3", nama: "Nordu Bakes Samarinda", kode: "NBSM", umur: 3, bulanLalu: [1_317_875_818, 982_548_182, 946_260_364] as [number, number, number], actual: 1_010_000_000 },
  { id: "4", nama: "Nordu Coffee Canggu", kode: "NCCG", umur: 2, bulanLalu: [16_526_000, 42_055_000, 30_276_000] as [number, number, number], actual: 44_000_000 },
  { id: "5", nama: "Nordu Coffee Putussibau", kode: "NCPS", umur: null, bulanLalu: [667_620_031, 640_112_000, 655_400_000] as [number, number, number], actual: 690_000_000 },
  { id: "6", nama: "Nordu Coffee Kayutangi", kode: "NCKT", umur: null, bulanLalu: [500_030_837, 512_000_000, 498_700_000] as [number, number, number], actual: 470_000_000 },
];
const DEPT_MJ = [
  departemenKpi("operational", "Operational", "Operational", [
    { kode: "operational_ca", nama: "Coordinator Area", nilai: 89.46, lalu: 86.2 },
    { kode: "operational_software", nama: "Coordinator Software", nilai: 91.2, lalu: 88.7 },
    { kode: "operational_pos", nama: "Coordinator POS", nilai: 84.3, lalu: 80.5 },
  ]),
  departemenKpi("creative", "Creative", "Creative", [
    { kode: "creative_content", nama: "Content Creator", nilai: 82.1, lalu: 79.4 },
    { kode: "creative_sosmed", nama: "Sosial Media", nilai: 76.8, lalu: 80.1 },
  ]),
  departemenKpi("finance", "Finance", "Finance", [
    { kode: "finance_accounting", nama: "Accounting", nilai: 91, lalu: 88 },
    { kode: "finance_finance", nama: "Finance", nilai: 94, lalu: 92 },
    { kode: "finance_tax", nama: "Tax", nilai: 88, lalu: 90 },
  ]),
  departemenKpi("pdq", "Product Development & Quality", "PDQ", [
    { kode: "pdq_qc", nama: "Quality Assurance & Control", nilai: 87.5, lalu: null },
    { kode: "pdq_food", nama: "Food Staff", nilai: 80, lalu: 81 },
    { kode: "pdq_beverage", nama: "Beverage Staff", nilai: 84, lalu: 82 },
    { kode: "pdq_head_food", nama: "Head Food Development", nilai: null, lalu: null },
    { kode: "pdq_head_pdq", nama: "Head Product Development & Quality", nilai: null, lalu: null },
  ]),
  departemenKpi("marcomm", "Marketing Communication", "MarComm", [{ kode: "marcomm", nama: "Marketing Communication", nilai: 78.3, lalu: 74.9 }]),
  departemenKpi("hrd", "Human Resource Development", "HRD", []),
];
const SKOR_MJ = hitungManajemen({
  a: { bulanLalu: [13_029_795_465, 14_125_168_904, 13_987_095_243], actual: 13_100_000_000 },
  outlet: OUTLET_MJ,
  labaBersih: 520_000_000,
  departemen: DEPT_MJ,
});
const DETAIL_MJ: DetailManajemen = {
  periode: "2026-09",
  omzetLalu: [13_029_795_465, 14_125_168_904, 13_987_095_243],
  bulanA: ["2026-06", "2026-07", "2026-08"],
  labaBersih: 520_000_000,
  ebitda: SKOR_MJ.b.baris
    .filter((b) => b.ikut)
    .map((b, i) => {
      const laba = i === 1 ? null : b.actual * (0.2 + i * 0.05);
      return {
        outletId: b.id,
        nama: b.nama,
        kode: b.kode,
        sales: b.actual,
        labaBersih: laba,
        labaLalu: i === 2 ? null : b.bulanLalu[2] * (0.18 + i * 0.06),
        margin: laba === null ? null : (laba / b.actual) * 100,
      };
    }),
  harian: Array.from({ length: 30 }, (_, i) => {
    const t = i + 1;
    const pola = 380_000_000 + Math.sin(t / 3) * 90_000_000 + (t % 7 === 0 ? 120_000_000 : 0);
    return { tanggal: t, ini: t <= 21 ? Math.round(pola) : null, lalu: Math.round(pola * 0.93 + (t % 5) * 8_000_000) };
  }),
  // Rincian mingguan: minggu 1-2 penuh, minggu 3 baru tiga hari.
  minggu: (() => {
    const mg = mingguBulan("2026-09");
    const hari = 30;
    const sumber = SKOR_MJ.b.baris.map((b, i) => {
      const tanpaRincian = i % 7 === 3;
      const rata = b.target / mg.length;
      const goyang = [0.92, 1.05, 0.78, 0.99, 1.12][i % 5];
      return {
        id: b.id,
        nama: b.nama,
        kode: b.kode,
        targetBulan: b.target,
        actual: tanpaRincian
          ? mg.map(() => null)
          : mg.map((m, j) => (j === 0 ? rata * goyang : j === 1 ? rata * (goyang + 0.06) : j === 2 ? rata * 0.4 : null)),
        hariAda: mg.map((m, j) => (tanpaRincian ? 0 : j === 0 || j === 1 ? m.hari : j === 2 ? 3 : 0)),
        tanpaRincian,
      };
    });
    const baris = hitungMinggu(sumber, mg, hari);
    return { minggu: mg, baris, korporat: korporatMinggu(baris, mg, hari), tanpaRincian: baris.filter((b) => b.tanpaRincian).length };
  })(),
  lalu: {
    a: { persen: 96.2, actual: 12_824_068_510 },
    b: { persen: 94.1, actual: 631_000_000 },
    c: { persen: 78.5, actual: 23.5 },
    d: { persen: 84.4, actual: 84.4 },
  },
  setelan: SETELAN_BAWAAN,
  skor: SKOR_MJ,
};

const kode = (location.hash.replace("#", "") || "operational_ca") as KodePosisi;
if (kode === "sidebar") {
  // Sidebar seperti yang dilihat super admin: seluruh divisi tampil, urutannya
  // persis urutan tulis `DIVISION_MENUS`.
  createRoot(document.getElementById("root")!).render(
    <I18nProvider initialLang="id">
      <SidebarProvider>
        <NavLockProvider>
          <div className="h-screen w-64 border-r border-border bg-card">
            <Sidebar items={navAll()} allowedKeys={accessibleMenuKeys("super_admin")} homeDivision="Operation" isAdmin />
          </div>
        </NavLockProvider>
      </SidebarProvider>
    </I18nProvider>,
  );
  throw new Error("__stop__");
}
if (kode === "manajemen") {
  createRoot(document.getElementById("root")!).render(<PapanManajemen detail={DETAIL_MJ} bolehAtur />);
  throw new Error("__stop__");
}

const p = posisiDari(kode)!;
const { laporan, lalu } = buat(kode);
// PIC terpilih supaya form isiannya terlihat (di aplikasi ini datang dari basis data).
if (laporan.ca) laporan.pic = "Deo";

createRoot(document.getElementById("root")!).render(
  <PapanKpi
    laporan={laporan}
    lalu={lalu}
    namaPosisi={p.nama}
    namaDepartemen={p.departemen}
    pic={p.pic}
    picOpsi={(p.pic.length ? p.pic : ["Deo", "Roby", "Aldi", "Wika"]).map((n) => ({ value: n, label: n }))}
    perPic={!!p.perPic}
    indikator={daftarIndikator(kode)}
    outlets={OUTLET.map(([nama], i) => ({ id: `o${i}`, nama }))}
    tenggatHari={TENGGAT[kode] ?? [15]}
    posisiOpsi={posisiDepartemen(p.departemen).map((x) => ({ value: x.kode, label: x.nama }))}
    bolehAtur
    bolehAngkaOutlet
    menuEsb={MENU_ESB}
  />,
);
