import { HEAD_OFFICE, HEAD_OFFICE_LABEL } from "./penilaian-request";

/**
 * Dari mana WILAYAH sebuah permintaan design ditentukan.
 *
 * Aturannya ditulis sebagai fungsi murni — tanpa menyentuh basis data — karena
 * ia menentukan siapa yang tercatat bertanggung jawab atas sebuah permintaan.
 * Aturan sepenting itu harus bisa diuji tanpa menyiapkan seluruh dataset, dan
 * harus bisa dibaca utuh dalam satu layar.
 */

export interface OutletRingkas {
  id: string;
  code: string;
  name: string;
  areaId: string;
}

/** Mencari outlet dari id aplikasi ATAU kode POS-nya. */
export type CariOutlet = (idAtauKode: string) => OutletRingkas | undefined;

export interface AsalArea {
  areaId: string;
  areaNama: string;
  outletNama: string | null;
}

/**
 * Wilayah sebuah permintaan.
 *
 * Urutannya disengaja:
 *
 * 1. **Cabang yang ditulis di permintaannya** — paling dipercaya. Seorang
 *    supervisor bisa saja meminta desain untuk cabang lain, dan yang ia tulis
 *    lebih benar daripada tebakan apa pun.
 * 2. **Cabang pemohonnya sendiri** — form design tidak selalu menanyakan
 *    cabang. Tanpa langkah ini permintaan seorang supervisor jatuh ke "tanpa
 *    outlet" padahal wilayahnya jelas tertulis di penugasannya.
 * 3. **Head Office** — Operation, Marketing, Human Capital dan divisi kantor
 *    lain memang tidak punya cabang. Itu bukan data yang kurang; itu jawabannya.
 *    Menamainya "tanpa outlet" membuat Coordinator Area mencari-cari cabang
 *    yang tidak pernah ada.
 */
export function asalArea(input: {
  outletId: string | null;
  pemohonOutletIds: string[];
  cariOutlet: CariOutlet;
  namaArea: (areaId: string) => string | undefined;
}): AsalArea {
  const langsung = input.outletId ? input.cariOutlet(input.outletId) : undefined;
  const lewatPemohon = langsung ? undefined : input.pemohonOutletIds.map(input.cariOutlet).find(Boolean);
  const outlet = langsung ?? lewatPemohon;

  if (!outlet || !outlet.areaId) {
    return { areaId: HEAD_OFFICE, areaNama: HEAD_OFFICE_LABEL, outletNama: outlet?.name ?? null };
  }
  return {
    areaId: outlet.areaId,
    areaNama: input.namaArea(outlet.areaId) ?? "Area tanpa nama",
    outletNama: outlet.name,
  };
}

/**
 * Wilayah yang dipegang seseorang — dipakai membatasi apa yang dilihat
 * Coordinator Area, dan memilih laporan mana yang dikirim kepadanya.
 *
 * Diambil dari penugasan CABANG-nya, bukan dari kolom `areaId` saja. Beberapa
 * Coordinator Area memegang cabang di lebih dari satu wilayah, dan `areaId`
 * hanya menyimpan satu; memakainya sendirian membuat sebagian cabang yang ia
 * pegang hilang dari layarnya.
 */
export function areaMilik(input: { outletIds: string[]; areaId?: string | null; cariOutlet: CariOutlet }): string[] {
  const dariCabang = input.outletIds.map(input.cariOutlet).filter(Boolean).map((o) => o!.areaId);
  return [...new Set([...dariCabang, ...(input.areaId ? [input.areaId] : [])].filter(Boolean))];
}
