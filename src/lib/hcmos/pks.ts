/**
 * PKS Kemitraan — pelacak perjanjian kerja sama (sewa lokasi, kemitraan
 * supplier & brand).
 *
 * Berbeda dari SOP atau kebijakan, sebuah PKS punya TANGGAL BERAKHIR, dan
 * itulah yang membuatnya perlu dilacak: sewa outlet yang lewat tanggalnya
 * bukan sekadar dokumen kedaluwarsa — outletnya bisa diminta kosong. Karena
 * itu perpanjangannya diingatkan jauh-jauh hari, 90 hari sebelum jatuh tempo
 * (`MASA_BERLAKU_PERINGATAN_HARI`), bukan seminggu sebelumnya seperti kontrak
 * kerja: memperpanjang sewa menuntut perundingan, bukan tanda tangan ulang.
 */

import { sisaBerlaku, type StatusBerlaku, type StatusDokumen } from "./dokumen";

export interface PerjanjianRingkas {
  judul: string;
  pihak: string | null;
  berlakuMulai: string | null;
  berlakuSampai: string | null;
  status: StatusDokumen;
  masaBerlaku: StatusBerlaku;
}

export interface RekapPks {
  /** Perjanjian yang sedang berjalan — termasuk yang akan segera berakhir. */
  aktif: number;
  /** Bagian dari `aktif` yang jatuh tempo dalam 90 hari ke depan. */
  segeraHabis: number;
  /** Masih draf atau dalam perundingan — belum mengikat. */
  draf: number;
  /**
   * Bertanda aktif tapi tanggalnya sudah lewat.
   *
   * Ini kelompok yang paling perlu dilihat: bukan berarti perjanjiannya
   * berakhir baik-baik, melainkan tidak ada yang menutup atau memperpanjangnya
   * dan sistem masih menganggapnya berlaku.
   */
  lewat: number;
}

export function rekapPks(rows: PerjanjianRingkas[]): RekapPks {
  return rows.reduce<RekapPks>(
    (a, r) => {
      const berjalan = r.status === "aktif";
      return {
        aktif: a.aktif + (berjalan && r.masaBerlaku !== "habis" ? 1 : 0),
        segeraHabis: a.segeraHabis + (berjalan && r.masaBerlaku === "segera_habis" ? 1 : 0),
        draf: a.draf + (r.status === "draf" ? 1 : 0),
        lewat: a.lewat + (berjalan && r.masaBerlaku === "habis" ? 1 : 0),
      };
    },
    { aktif: 0, segeraHabis: 0, draf: 0, lewat: 0 },
  );
}

/**
 * Perjanjian yang perlu diurus perpanjangannya, yang paling mendesak di atas.
 *
 * Yang sudah LEWAT ikut masuk dan berada paling atas — ia lebih mendesak
 * daripada yang akan jatuh tempo, dan menyembunyikannya karena "sudah telat"
 * justru membuat satu-satunya kelompok yang benar-benar bermasalah tidak
 * pernah terlihat.
 */
export function pengingatPks<T extends PerjanjianRingkas>(rows: T[], now = new Date()): T[] {
  return rows
    .filter((r) => r.status === "aktif" && (r.masaBerlaku === "segera_habis" || r.masaBerlaku === "habis"))
    .sort((a, b) => (sisaBerlaku(a.berlakuSampai, now) ?? 0) - (sisaBerlaku(b.berlakuSampai, now) ?? 0));
}
