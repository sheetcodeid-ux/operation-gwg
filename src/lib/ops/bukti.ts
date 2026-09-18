/**
 * ROOT CAUSE EVIDENCE, CONFIDENCE, DAN ACTION ELIGIBILITY.
 *
 * ┌─ TIGA STATUS, DAN KETIGANYA BERBEDA ─────────────────────────────────────┐
 * │                                                                          │
 * │   SUPPORTED      angkanya ADA, sumbernya sah, dan ia MENDUKUNG dugaannya │
 * │   NOT_SUPPORTED  angkanya ADA, sumbernya sah, dan ia MEMBANTAH dugaannya │
 * │   UNKNOWN        angkanya TIDAK ADA, tidak sah, atau tidak bisa dihitung │
 * │                                                                          │
 * │ `NOT_SUPPORTED` BUKAN `UNKNOWN`. "Traffic tidak turun" adalah jawaban;   │
 * │ "traffic tidak diketahui" bukan. Menggabungkan keduanya menghapus        │
 * │ satu-satunya pembedaan yang membuat Root Cause berguna — dan yang        │
 * │ membacanya akan mengirim orang memperbaiki sesuatu yang tidak pernah     │
 * │ diperiksa.                                                               │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ SIGNAL BUKAN ROOT CAUSE (M-01) ─────────────────────────────────────────┐
 * │                                                                          │
 * │ Tidak ada satu fungsi pun di berkas ini yang menerima Signal dan         │
 * │ mengembalikan sebab. Signal menyatakan sebuah KPI melanggar ambangnya —  │
 * │ ia memicu penyelidikan, bukan menyimpulkannya. Yang menghubungkan        │
 * │ keduanya cuma `adaSignal` di `kelayakanTindakan`, dan di sana perannya   │
 * │ justru KEBALIKANNYA: Signal yang sebabnya belum terbukti membuat         │
 * │ tindakan TIDAK layak, bukan layak.                                       │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ CONFIDENCE TIDAK PERNAH MENGUBAH STATUS ────────────────────────────────┐
 * │                                                                          │
 * │ `UNKNOWN` + `HIGH` tetap `UNKNOWN`. Confidence menerangkan seberapa      │
 * │ yakin kita pada bukti yang ADA; ia tidak pernah mengisi bukti yang tidak │
 * │ ada. Itu sebabnya `kelayakanTindakan` memeriksa status LEBIH DULU.       │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ TIDAK ADA SATU AMBANG PUN DI BERKAS INI ────────────────────────────────┐
 * │                                                                          │
 * │ Keputusan #14 — berapa persen kelengkapan yang cukup — MASIH TERBUKA     │
 * │ (AD-14), jadi menuliskan 95 di sini berarti mengarang keputusan bisnis.  │
 * │ Confidence karena itu cuma memakai dua batas skala itu sendiri: 0        │
 * │ (tidak ada apa-apa) dan 100 (minggunya penuh). Keduanya bukan pilihan;   │
 * │ keduanya ujung dari persentase.                                          │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * MURNI — tanpa basis data, tanpa `server-only`.
 */

import { type Terukur } from "./mingguan";

/* ───────────────────────────── status bukti ───────────────────────────── */

export type StatusBukti = "SUPPORTED" | "NOT_SUPPORTED" | "UNKNOWN";

/** Domain bukti yang bisa dijawab arsitektur hari ini. */
export type DomainBukti =
  | "sales"
  | "target"
  | "traffic"
  | "rata_transaksi"
  | "biaya"
  | "biaya_rinci";

/**
 * Kenapa sebuah domain `UNKNOWN`.
 *
 * Wajib ikut ditampilkan. "Tidak diketahui" tanpa sebab tidak bisa
 * ditindaklanjuti siapa pun.
 */
export type AlasanBukti =
  | "data_tidak_tersedia"
  | "sumber_tidak_sah"
  | "penyebut_tidak_sah"
  | "tanpa_pembanding"
  | "tanpa_target"
  | "belum_dirinci"
  | "tanpa_aturan";

export interface Bukti {
  domain: DomainBukti;
  status: StatusBukti;
  /** Dari mana angkanya dibaca — ikut dicatat supaya bisa ditelusuri. */
  sumber: string;
  /** Terisi HANYA ketika `status === "UNKNOWN"`. */
  alasan: AlasanBukti | null;
}

const bukti = (domain: DomainBukti, status: StatusBukti, sumber: string, alasan: AlasanBukti | null = null): Bukti => ({
  domain,
  status,
  sumber,
  alasan: status === "UNKNOWN" ? (alasan ?? "data_tidak_tersedia") : null,
});

/* ───────────────────────── bukti per domain ───────────────────────── */

/**
 * SALES — dugaannya "penjualan turun".
 *
 * Terbukti bila minggu ini benar-benar lebih rendah dari minggu sebelumnya.
 * Terbantah bila sama atau lebih tinggi. Tidak diketahui bila salah satunya
 * tidak ada — dan itu keadaan yang lazim hari ini, karena Agustus 2026 cuma
 * punya satu minggu di `esb_net_mingguan`.
 */
export function buktiSales(kini: Terukur, lalu: Terukur): Bukti {
  const sumber = "esb_net_mingguan.net";
  if (!kini.diketahui) {
    return bukti("sales", "UNKNOWN", sumber, kini.alasan === "sumber_tidak_sah" ? "sumber_tidak_sah" : "data_tidak_tersedia");
  }
  if (!lalu.diketahui) return bukti("sales", "UNKNOWN", sumber, "tanpa_pembanding");
  return bukti("sales", kini.nilai < lalu.nilai ? "SUPPORTED" : "NOT_SUPPORTED", sumber);
}

/**
 * TARGET — dugaannya "realisasi di bawah target bulanan".
 *
 * Perhatikan yang dibandingkan REALISASI BULANAN dengan TARGET BULANAN. Tidak
 * ada versi mingguannya, dan tidak boleh ada: membandingkan penjualan satu
 * minggu dengan target sebulan selalu menghasilkan "gagal" untuk setiap outlet
 * setiap minggu — angka yang tidak pernah salah dan tidak pernah berguna.
 */
export function buktiTarget(realisasiBulanan: Terukur, targetBulanan: Terukur): Bukti {
  const sumber = "targetBulananOutlet() + esb_net_mingguan (agregat bulan)";
  if (!targetBulanan.diketahui) return bukti("target", "UNKNOWN", sumber, "tanpa_target");
  if (!realisasiBulanan.diketahui) return bukti("target", "UNKNOWN", sumber, "data_tidak_tersedia");
  if (targetBulanan.nilai <= 0) return bukti("target", "UNKNOWN", sumber, "penyebut_tidak_sah");
  return bukti("target", realisasiBulanan.nilai < targetBulanan.nilai ? "SUPPORTED" : "NOT_SUPPORTED", sumber);
}

/**
 * TRAFFIC — pertanyaannya "pax dan bills tersedia?".
 *
 * Sengaja berbeda bentuk dari `buktiSales`: yang ditanyakan Gate N untuk domain
 * ini adalah KETERSEDIAAN, bukan pembuktian arah. Jadi `SUPPORTED` berarti
 * kedua angkanya ada dan bisa dipakai, bukan berarti traffic turun.
 *
 * `pax = 0` adalah pengukuran dan tetap `SUPPORTED`. `pax = null` tidak.
 */
export function buktiTraffic(pax: Terukur, bills: Terukur): Bukti {
  const sumber = "esb_net_mingguan.pax, esb_net_mingguan.bills";
  if (pax.diketahui && bills.diketahui) return bukti("traffic", "SUPPORTED", sumber);
  const alasan = !pax.diketahui && pax.alasan === "sumber_tidak_sah" ? "sumber_tidak_sah" : "data_tidak_tersedia";
  return bukti("traffic", "UNKNOWN", sumber, alasan);
}

/** RATA TRANSAKSI — pembilang DAN penyebut dua-duanya harus ada dan sah. */
export function buktiRataTransaksi(rata: Terukur): Bukti {
  const sumber = "esb_net_mingguan.net ÷ esb_net_mingguan.bills";
  if (rata.diketahui) return bukti("rata_transaksi", "SUPPORTED", sumber);
  const alasan: AlasanBukti =
    rata.alasan === "tanpa_struk" || rata.alasan === "penyebut_tidak_sah"
      ? "penyebut_tidak_sah"
      : rata.alasan === "sumber_tidak_sah"
        ? "sumber_tidak_sah"
        : "data_tidak_tersedia";
  return bukti("rata_transaksi", "UNKNOWN", sumber, alasan);
}

/**
 * BIAYA — outlet ini punya laporan biaya bulan itu?
 *
 * Yang ditanyakan KETERSEDIAAN, bukan arah. `SUPPORTED` berarti ada barisnya
 * dan angkanya bisa dipakai — bukan berarti biayanya boros.
 */
export function buktiBiaya(adaLaporan: boolean, sumberSah: boolean): Bukti {
  const sumber = "op_expenses (baris outlet-bulan)";
  if (!sumberSah) return bukti("biaya", "UNKNOWN", sumber, "sumber_tidak_sah");
  return adaLaporan ? bukti("biaya", "SUPPORTED", sumber) : bukti("biaya", "UNKNOWN", sumber, "data_tidak_tersedia");
}

/**
 * BIAYA RINCI — listrik, air, internet, kebersihan, platform fee, PBJT.
 *
 * Kolomnya ADA sejak migrasi `0104` dan isinya NOL DARI 174 BARIS. Jadi jawaban
 * jujurnya hari ini selalu `UNKNOWN / belum_dirinci` — bukan "biayanya nol",
 * dan bukan "outletnya efisien".
 *
 * Keputusan L-04 — apakah keenam kolom itu wajib diunggah — MASIH TERBUKA, dan
 * fungsi ini tidak mendahuluinya: ia cuma melaporkan keadaan apa adanya.
 */
export function buktiBiayaRinci(adaRincian: boolean): Bukti {
  const sumber = "op_expenses (listrik, air, internet, kebersihan, platform_fee, pbjt)";
  return adaRincian
    ? bukti("biaya_rinci", "SUPPORTED", sumber)
    : bukti("biaya_rinci", "UNKNOWN", sumber, "belum_dirinci");
}

/* ───────────────────────────── confidence ───────────────────────────── */

export type Keyakinan = "HIGH" | "MEDIUM" | "LOW";

export interface MasukanKeyakinan {
  /** Kelengkapan data minggu itu, 0–100. */
  kelengkapan: Terukur;
  /** `pax` DAN `bills` dua-duanya tersedia. */
  trafficAda: boolean;
  /** Outlet ini punya target bulanan. */
  targetAda: boolean;
  /** Angka ESB outlet-bulan ini dinyatakan sah. */
  sumberSah: boolean;
  /** Enam kolom biaya rinci sudah terisi. */
  biayaRinciAda: boolean;
}

/**
 * Seberapa yakin kita pada bukti yang ada.
 *
 * TIDAK ADA ANGKA AMBANG DI SINI, dan itu disengaja — lihat catatan kepala
 * berkas. Yang dipakai cuma dua ujung skalanya:
 *
 *   LOW     sumber tidak sah · kelengkapan tidak diketahui · kelengkapan 0
 *           · traffic tidak tersedia
 *   MEDIUM  ada keterbatasan: minggunya belum penuh, target tidak ada, atau
 *           komponen biaya rinci kosong
 *   HIGH    minggunya penuh, traffic ada, target ada, biaya rinci ada,
 *           sumbernya sah
 *
 * Hari ini `HIGH` praktis mustahil dicapai karena `biayaRinciAda` selalu salah
 * (0 dari 174 baris). Itu BUKAN bug — itu keadaan data yang dilaporkan apa
 * adanya, dan ia akan berubah sendiri begitu L-04 diputuskan dan kolomnya diisi.
 */
export function keyakinan(m: MasukanKeyakinan): Keyakinan {
  if (!m.sumberSah) return "LOW";
  if (!m.kelengkapan.diketahui) return "LOW";
  if (m.kelengkapan.nilai <= 0) return "LOW";
  if (!m.trafficAda) return "LOW";
  if (m.kelengkapan.nilai < 100 || !m.targetAda || !m.biayaRinciAda) return "MEDIUM";
  return "HIGH";
}

/** `MEDIUM` dan `HIGH` sama-sama memenuhi syarat "minimal MEDIUM". */
export const minimalMedium = (k: Keyakinan): boolean => k === "HIGH" || k === "MEDIUM";

/* ───────────────────────── action eligibility ───────────────────────── */

export type AlasanTidakLayak =
  /** Sebabnya terbukti, tapi buktinya terlalu rapuh untuk ditindaklanjuti. */
  | "low_confidence"
  /** Buktinya MEMBANTAH dugaan sebabnya. */
  | "cause_rejected"
  /** Buktinya tidak ada. */
  | "evidence_unavailable"
  /** Ada Signal, tapi sebabnya belum terbukti — selidiki dulu. */
  | "investigation_required"
  /** Root Cause belum pernah dijalankan untuk unit ini. */
  | "not_investigated";

export interface Kelayakan {
  layak: boolean;
  alasan: AlasanTidakLayak | null;
}

export interface MasukanKelayakan {
  rootCause: StatusBukti;
  keyakinan: Keyakinan;
  /** Ada Signal bulanan terbuka untuk outlet ini. */
  adaSignal: boolean;
  /** Root Cause sudah benar-benar dijalankan, bukan sekadar belum ada hasilnya. */
  sudahDiperiksa: boolean;
}

/**
 * ACTION ELIGIBLE = Root Cause SUPPORTED **dan** Confidence ≥ MEDIUM.
 *
 * Urutan pemeriksaannya mengikat, dan urutan itulah aturannya:
 *
 *   1. belum diperiksa          → `not_investigated`
 *   2. NOT_SUPPORTED            → `cause_rejected`
 *   3. UNKNOWN + ada Signal     → `investigation_required`
 *   4. UNKNOWN                  → `evidence_unavailable`
 *   5. SUPPORTED + LOW          → `low_confidence`
 *   6. SUPPORTED + ≥ MEDIUM     → LAYAK
 *
 * Nomor 2 sebelum nomor 5 disengaja: sebab yang sudah TERBANTAH tidak berubah
 * jadi layak hanya karena buktinya kuat. Dan nomor 3 sebelum nomor 4 juga:
 * Signal yang menggantung butuh penyelidikan, bukan sekadar pemberitahuan
 * bahwa datanya kurang.
 */
export function kelayakanTindakan(m: MasukanKelayakan): Kelayakan {
  if (!m.sudahDiperiksa) return { layak: false, alasan: "not_investigated" };
  if (m.rootCause === "NOT_SUPPORTED") return { layak: false, alasan: "cause_rejected" };
  if (m.rootCause === "UNKNOWN") {
    return { layak: false, alasan: m.adaSignal ? "investigation_required" : "evidence_unavailable" };
  }
  if (!minimalMedium(m.keyakinan)) return { layak: false, alasan: "low_confidence" };
  return { layak: true, alasan: null };
}

/* ───────────────────────── rangkuman satu outlet ───────────────────────── */

export interface RangkumanBukti {
  daftar: Bukti[];
  /**
   * Status Root Cause keseluruhan.
   *
   * SUPPORTED bila ada SETIDAKNYA SATU domain yang mendukung; NOT_SUPPORTED
   * bila tidak ada yang mendukung tapi ada yang membantah; UNKNOWN bila tidak
   * satu pun domain bisa menjawab.
   *
   * Sengaja tidak diberi bobot dan tidak dijumlahkan jadi skor: skor semacam
   * itu belum punya kontraknya, dan yang belum punya kontrak tidak dibuat.
   */
  rootCause: StatusBukti;
  keyakinan: Keyakinan;
  kelayakan: Kelayakan;
}

export function rangkumBukti(
  daftar: readonly Bukti[],
  tingkat: Keyakinan,
  konteks: { adaSignal: boolean; sudahDiperiksa: boolean },
): RangkumanBukti {
  const rootCause: StatusBukti = daftar.some((b) => b.status === "SUPPORTED")
    ? "SUPPORTED"
    : daftar.some((b) => b.status === "NOT_SUPPORTED")
      ? "NOT_SUPPORTED"
      : "UNKNOWN";

  return {
    daftar: [...daftar],
    rootCause,
    keyakinan: tingkat,
    kelayakan: kelayakanTindakan({ rootCause, keyakinan: tingkat, ...konteks }),
  };
}
