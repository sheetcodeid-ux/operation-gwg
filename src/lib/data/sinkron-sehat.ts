import "server-only";

import { db, dbEnabled } from "./db";

/**
 * Kesehatan penarikan otomatis — supaya yang mogok KELIHATAN.
 *
 * Selama ini tidak ada yang seperti ini, dan akibatnya nyata: katalog menu ESB
 * berhenti terisi selama dua belas hari tanpa satu pun tanda, karena pg_cron
 * hanya mencatat bahwa permintaan HTTP terkirim — bukan hasilnya. Yang
 * menemukan akhirnya orang, saat angkanya sudah terlanjur dipakai.
 *
 * YANG DIUKUR "KAPAN TERAKHIR TUNTAS", BUKAN "APAKAH JALAN TERAKHIR SUKSES".
 * Kegagalan sesekali memang wajar pada integrasi ESB dan sembuh sendiri pada
 * jalan berikutnya; yang berbahaya justru pekerjaan yang masih dijalankan tiap
 * hari tapi tidak pernah lagi sampai selesai. Diperiksa dari jalan terakhirnya
 * saja, keadaan itu tidak pernah terlihat.
 */

/** Satu penarikan yang dipantau, beserta seberapa sering ia seharusnya tuntas. */
interface Dikenal {
  label: string;
  /** Batas wajar sejak terakhir tuntas, dalam jam. */
  jedaWajarJam: number;
}

const DIKENAL: Record<string, Dikenal> = {
  menu: { label: "Katalog Menu ESB", jedaWajarJam: 24 },
  "net-bulanan": { label: "Net Sales Bulanan", jedaWajarJam: 6 },
  "net-mingguan": { label: "Net Sales Mingguan", jedaWajarJam: 12 },
  seasonal: { label: "Musiman Harian", jedaWajarJam: 24 },
  "seasonal:cabang": { label: "Musiman per Cabang", jedaWajarJam: 72 },
  "sales:daily": { label: "Omset Harian", jedaWajarJam: 12 },
  "sales:today": { label: "Omset Hari Ini", jedaWajarJam: 12 },
  "fresh:all": { label: "Fraud — Cancel/Void", jedaWajarJam: 12 },
  "fresh:delete": { label: "Fraud — Order Dihapus", jedaWajarJam: 12 },
  "backfill:all": { label: "Fraud — Riwayat Cancel/Void", jedaWajarJam: 72 },
  "backfill:delete": { label: "Fraud — Riwayat Dihapus", jedaWajarJam: 72 },
};

/** Penarikan yang belum dikenal tetap dicatat — daftar di atas cuma namanya. */
const BAWAAN: Dikenal = { label: "", jedaWajarJam: 24 };

export type StatusSinkron = "sehat" | "tertunda" | "bermasalah" | "belum pernah";

export interface BarisSehat {
  job: string;
  label: string;
  terakhirCoba: string | null;
  terakhirSukses: string | null;
  terakhirTuntas: string | null;
  gagalBeruntun: number;
  pesan: string | null;
  jedaWajarJam: number;
  status: StatusSinkron;
  /** Berapa jam sejak terakhir tuntas; null bila belum pernah tuntas. */
  umurJam: number | null;
}

/**
 * Bagaimana satu hasil dibaca: gagal, dan apakah pekerjaannya tuntas.
 *
 * Bentuk hasilnya berbeda-beda antar-penarikan, jadi yang dicari tanda-tanda
 * yang memang dipakai semuanya. `menunggu` sengaja TIDAK dihitung gagal — itu
 * keadaan wajar saat ESB masih membangun ekspornya — tapi juga tidak dihitung
 * tuntas, supaya penarikan yang menunggu selamanya tetap ketahuan.
 */
export function bacaHasil(nilai: unknown): { gagal: boolean; tuntas: boolean; pesan: string | null } {
  if (nilai === null || typeof nilai !== "object") return { gagal: false, tuntas: true, pesan: null };
  const o = nilai as Record<string, unknown>;
  const pesan = typeof o.error === "string" && o.error.trim() !== "" ? o.error.trim() : null;
  if (pesan) return { gagal: true, tuntas: false, pesan };
  if (o.menunggu === true) return { gagal: false, tuntas: false, pesan: null };
  if (typeof o.complete === "boolean") return { gagal: false, tuntas: o.complete, pesan: null };
  if (typeof o.sisa === "number") return { gagal: false, tuntas: o.sisa === 0, pesan: null };
  if (typeof o.remaining === "number") return { gagal: false, tuntas: o.remaining === 0, pesan: null };
  return { gagal: false, tuntas: true, pesan: null };
}

interface Row {
  job: string;
  terakhir_coba: string | null;
  terakhir_sukses: string | null;
  terakhir_tuntas: string | null;
  gagal_beruntun: number | string | null;
  pesan: string | null;
}

/**
 * Catat hasil satu jalannya cron.
 *
 * TIDAK PERNAH MELEMPAR GALAT. Pencatatan kesehatan yang menggagalkan
 * penarikan yang sedang dipantaunya adalah alat yang merusak apa yang ia
 * jaga — dan kegagalannya justru akan terbaca sebagai penarikan yang rusak.
 */
export async function catatHasilSinkron(results: Record<string, unknown>): Promise<void> {
  if (!dbEnabled) return;
  const kunci = Object.keys(results);
  if (kunci.length === 0) return;

  try {
    const { data } = await db().from("sinkron_sehat").select("*").in("job", kunci);
    const lama = new Map((data ?? []).map((r) => [(r as Row).job, r as Row]));
    const kini = new Date().toISOString();

    const payload = kunci.map((job) => {
      const { gagal, tuntas, pesan } = bacaHasil(results[job]);
      const l = lama.get(job);
      return {
        job,
        terakhir_coba: kini,
        terakhir_sukses: gagal ? (l?.terakhir_sukses ?? null) : kini,
        terakhir_tuntas: tuntas ? kini : (l?.terakhir_tuntas ?? null),
        gagal_beruntun: gagal ? (Number(l?.gagal_beruntun) || 0) + 1 : 0,
        // Pesan kegagalan TERAKHIR dipertahankan sampai benar-benar tuntas.
        // Dihapus begitu satu jalan lolos tanpa galat, penyebab macet yang
        // sesekali lolos akan hilang justru saat ia paling dibutuhkan.
        pesan: gagal ? pesan : tuntas ? null : (l?.pesan ?? null),
        hasil: results[job] ?? null,
      };
    });

    await db().from("sinkron_sehat").upsert(payload);
  } catch {
    // Sengaja dibiarkan: lihat penjelasan di atas.
  }
}

const jam = (dari: string | null): number | null =>
  dari ? (Date.now() - Date.parse(dari)) / 3_600_000 : null;

/** Status satu baris — aturannya satu tempat, dipakai halaman dan peringatan. */
export function statusBaris(b: Omit<BarisSehat, "status" | "umurJam" | "label">): StatusSinkron {
  if (!b.terakhirCoba) return "belum pernah";
  const umur = jam(b.terakhirTuntas);
  if (umur === null) return b.gagalBeruntun >= 3 ? "bermasalah" : "tertunda";
  if (b.gagalBeruntun >= 3 || umur > b.jedaWajarJam * 3) return "bermasalah";
  if (umur > b.jedaWajarJam) return "tertunda";
  return "sehat";
}

/** Seluruh penarikan yang pernah tercatat, terburuk di atas. */
export async function statusSinkron(): Promise<BarisSehat[]> {
  if (!dbEnabled) return [];
  const { data } = await db().from("sinkron_sehat").select("*").order("job");
  const urut: Record<StatusSinkron, number> = { bermasalah: 0, "belum pernah": 1, tertunda: 2, sehat: 3 };

  return ((data ?? []) as Row[])
    .map((r) => {
      const kenal = DIKENAL[r.job] ?? BAWAAN;
      const dasar = {
        job: r.job,
        terakhirCoba: r.terakhir_coba,
        terakhirSukses: r.terakhir_sukses,
        terakhirTuntas: r.terakhir_tuntas,
        gagalBeruntun: Number(r.gagal_beruntun) || 0,
        pesan: r.pesan,
        jedaWajarJam: kenal.jedaWajarJam,
      };
      return {
        ...dasar,
        label: kenal.label || r.job,
        status: statusBaris(dasar),
        umurJam: jam(r.terakhir_tuntas),
      };
    })
    .sort((a, b) => urut[a.status] - urut[b.status] || a.label.localeCompare(b.label, "id"));
}
