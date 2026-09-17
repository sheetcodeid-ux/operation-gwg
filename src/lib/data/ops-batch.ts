import "server-only";

import { db, dbEnabled } from "./db";

/**
 * JEJAK UNGGAHAN FINANSIAL — siapa mengunggah apa, kapan, dan apakah sudah pernah.
 *
 * Sebelum ini satu-satunya jejak sebuah unggahan adalah `updated_at`. Tidak ada
 * cara tahu berkas mana yang menulis angka mana, dan mengunggah ulang berkas
 * yang sama diam-diam menulis ulang seluruh barisnya. Hasilnya kebetulan sama,
 * jadi tidak ada yang tahu — sampai suatu hari berkasnya BUKAN yang sama dan
 * tidak ada yang bisa menunjukkan apa yang berubah.
 *
 * IDEMPOTENSI DIJAGA BASIS DATA, BUKAN KODE. `financial_upload_batch_sidik_unik`
 * menolak sidik yang sama untuk bulan yang sama. Pemeriksaan di bawah hanya
 * supaya pesannya enak dibaca; kalau dua orang menekan Simpan pada detik yang
 * sama, yang kedua tetap ditolak oleh index-nya, bukan lolos.
 */

export interface Batch {
  id: number;
  periode: string;
  sidik: string;
  jumlahBaris: number;
  jumlahOutlet: number;
  status: "tersimpan" | "diulang" | "gagal";
  olehNama: string;
  catatan: string | null;
  dibuatPada: string;
}

const baris = (r: Record<string, unknown>): Batch => ({
  id: Number(r.id),
  periode: String(r.periode),
  sidik: String(r.sidik),
  jumlahBaris: Number(r.jumlah_baris) || 0,
  jumlahOutlet: Number(r.jumlah_outlet) || 0,
  status: String(r.status) as Batch["status"],
  olehNama: String(r.oleh_nama ?? ""),
  catatan: r.catatan === null || r.catatan === undefined ? null : String(r.catatan),
  dibuatPada: String(r.dibuat_pada),
});

/** Unggahan tersimpan dengan sidik yang sama pada bulan itu — kalau ada. */
export async function batchSama(periode: string, sidik: string): Promise<Batch | null> {
  if (!dbEnabled) return null;
  const { data, error } = await db()
    .from("financial_upload_batch")
    .select("*")
    .eq("periode", periode)
    .eq("sidik", sidik)
    .eq("status", "tersimpan")
    .limit(1);
  if (error) throw new Error(`gagal memeriksa unggahan sebelumnya: ${error.message}`);
  const r = (data ?? [])[0] as Record<string, unknown> | undefined;
  return r ? baris(r) : null;
}

export interface BatchBaru {
  periode: string;
  sidik: string;
  jumlahBaris: number;
  jumlahOutlet: number;
  olehId: string | null;
  olehNama: string;
  catatan?: string | null;
}

/**
 * Catat unggahan, lalu kembalikan id-nya.
 *
 * DICATAT LEBIH DULU, SEBELUM satu baris angka pun ditulis. Urutannya penting:
 * kalau penulisan angkanya gagal di tengah, yang tertinggal adalah catatan
 * unggahan tanpa angka — kelihatan, bisa diperiksa. Kalau dibalik, yang
 * tertinggal adalah angka tanpa asal-usul.
 */
export async function catatBatch(b: BatchBaru): Promise<number | null> {
  if (!dbEnabled) return null;
  const { data, error } = await db()
    .from("financial_upload_batch")
    .insert({
      periode: b.periode,
      sidik: b.sidik,
      jumlah_baris: b.jumlahBaris,
      jumlah_outlet: b.jumlahOutlet,
      status: "tersimpan",
      oleh_id: b.olehId,
      oleh_nama: b.olehNama,
      catatan: b.catatan ?? null,
    })
    .select("id")
    .single();
  if (error) {
    // Index unik yang menolak — berarti berkas yang sama sudah masuk.
    if (/duplicate key|unik/i.test(error.message)) return null;
    throw new Error(`gagal mencatat unggahan: ${error.message}`);
  }
  return Number((data as Record<string, unknown>).id);
}

/** Tandai unggahan yang gagal di tengah jalan, supaya tidak terbaca berhasil. */
export async function tandaiGagal(id: number, sebab: string): Promise<void> {
  if (!dbEnabled) return;
  await db().from("financial_upload_batch").update({ status: "gagal", catatan: sebab.slice(0, 500) }).eq("id", id);
}

/** Riwayat unggahan satu bulan, terbaru dulu. */
export async function riwayatBatch(periode: string, batas = 10): Promise<Batch[]> {
  if (!dbEnabled) return [];
  const { data, error } = await db()
    .from("financial_upload_batch")
    .select("*")
    .eq("periode", periode)
    .order("dibuat_pada", { ascending: false })
    .limit(batas);
  if (error) throw new Error(`gagal membaca riwayat unggahan: ${error.message}`);
  return ((data ?? []) as Record<string, unknown>[]).map(baris);
}
