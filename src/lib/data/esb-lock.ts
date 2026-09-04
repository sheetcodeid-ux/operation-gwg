import "server-only";

import { db, dbEnabled } from "./db";

/**
 * Sewa waktu untuk pekerjaan berat ESB.
 *
 * ESB melayani SATU sesi per akun. Dua penarikan yang berjalan bersamaan saling
 * merebut sesi itu, dan yang kalah tidak mendapat pesan galat yang jelas —
 * melainkan balasan yang tidak bisa diuraikan, lalu harinya dilewati diam-diam.
 * Bentuknya sudah pernah terlihat: `"ESB highlight: respons tidak terbaca"` di
 * tengah penarikan per cabang, sementara pekerjaan lain sedang jalan.
 *
 * PENGAMBILANNYA SATU PERINTAH, BUKAN BACA-LALU-TULIS. Membaca sewa lalu
 * menulisnya menyisakan celah di antara keduanya, dan celah sekecil itu persis
 * yang ditemukan dua cron yang kebetulan berangkat bersamaan. Di sini syaratnya
 * ikut di dalam UPDATE: yang mendapat barisnya satu, yang lain menerima nol.
 */

const NAMA = "esb";

/** Mengambil sewa selama `ms`. `false` berarti ada penarikan lain yang jalan. */
export async function ambilKunciEsb(ms: number): Promise<boolean> {
  if (!dbEnabled) return true; // tanpa basis data tidak ada yang perlu dijaga
  const sampai = new Date(Date.now() + ms).toISOString();
  const { data, error } = await db()
    .from("esb_lock")
    .update({ lease_until: sampai })
    .eq("name", NAMA)
    .lt("lease_until", new Date().toISOString())
    .select("name");
  if (error) return false; // tidak bisa memastikan → jangan jalan
  if ((data ?? []).length > 0) return true;

  // Nol baris biasanya berarti "ada yang sedang jalan". Tapi bisa juga berarti
  // barisnya tidak ada sama sekali — dan kalau itu terjadi, SELURUH penarikan
  // berhenti selamanya tanpa satu pun pesan: tiap pemanggilan hanya menjawab
  // "ada penarikan lain", padahal tidak ada. Dibuatkan sekali di sini supaya
  // kegagalannya paling lama satu putaran, bukan selamanya.
  const { data: ada } = await db().from("esb_lock").select("name").eq("name", NAMA).maybeSingle();
  if (!ada) await db().from("esb_lock").insert({ name: NAMA, lease_until: new Date().toISOString() });
  return false;
}

/**
 * Melepas sewa lebih awal.
 *
 * Tanpa ini sewanya tetap habis sendiri, jadi kegagalan di sini tidak pernah
 * mengunci apa pun selamanya — paling lama menunggu sampai waktunya lewat.
 */
export async function lepasKunciEsb(): Promise<void> {
  if (!dbEnabled) return;
  await db().from("esb_lock").update({ lease_until: new Date().toISOString() }).eq("name", NAMA);
}
