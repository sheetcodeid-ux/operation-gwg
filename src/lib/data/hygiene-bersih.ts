import "server-only";

import { db, dbEnabled } from "./db";
import { isR2Key, r2Delete, r2KeyOf, r2Enabled, r2List } from "@/lib/storage/r2";

/**
 * Pembersih foto Hygiene.
 *
 * Satu audit membawa 18–24 foto, dan ada puluhan audit per hari dari 58 outlet.
 * Dalam sebulan itu berarti ribuan berkas dan beberapa gigabyte. Fotonya
 * dibutuhkan SELAMA bulan berjalan — untuk tindak lanjut temuan — tapi setelah
 * bulannya tutup, yang dipakai hanyalah NILAINYA. Menyimpan gambarnya
 * selamanya cuma menumpuk biaya tanpa ada yang membukanya lagi.
 *
 * Yang dihapus hanya berkas gambarnya. `hygiene_score`, `ratings`, `findings`,
 * dan `is_clean` ada di kolom terpisah dan tidak pernah disentuh — rekap,
 * grafik, dan riwayat nilai tetap utuh seperti sebelumnya.
 *
 * Tiga hal yang membuat ini aman dijalankan tanpa ditunggui:
 *
 *  1. Bulan berjalan TIDAK PERNAH disentuh, apa pun setelannya.
 *  2. Foto yang masih dirujuk TINDAK LANJUT dilewati, berapa pun umurnya.
 *     Tindak lanjut adalah perkara yang masih berjalan; buktinya tidak boleh
 *     hilang hanya karena bulannya berganti.
 *  3. Berkasnya dihapus DULU, baru rujukannya dikosongkan, satu baris demi satu
 *     baris. Kalau prosesnya terputus di tengah, yang tersisa paling buruk
 *     adalah berkas yatim — dan itu justru yang disapu bagian kedua di bawah.
 *     Urutan sebaliknya akan meninggalkan gambar yang tidak bisa ditemukan
 *     siapa pun lagi.
 */

const BUCKET = "hygiene-photos";

export interface HasilBersih {
  /** Bulan tertua yang DIPERTAHANKAN (YYYY-MM) — apa pun sebelum ini dibersihkan. */
  batasBulan: string;
  barisDibersihkan: number;
  r2Dihapus: number;
  supabaseDihapus: number;
  yatimDihapus: number;
  dilewatiTindakLanjut: number;
  gagal: number;
  /** false = anggaran waktu habis; jalan berikutnya melanjutkan dari sini. */
  selesai: boolean;
  kering: boolean;
}

interface BarisFoto {
  id: string;
  photos: { id?: string; path?: string }[] | null;
}

/** Awal bulan berjalan menurut WIB, dalam bentuk YYYY-MM-01. */
export function batasBulan(simpanBulan: number, sekarang = new Date()): string {
  const wib = new Date(sekarang.getTime() + 7 * 3_600_000);
  const d = new Date(Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth() - Math.max(0, simpanBulan - 1), 1));
  return d.toISOString().slice(0, 10);
}

/** Kunci penyimpanan dari satu entri foto — bentuknya berbeda antar modul. */
const kunciFoto = (f: { id?: string; path?: string }): string => f?.id ?? f?.path ?? "";

/** Hapus satu berkas di penyimpanan mana pun ia berada. */
async function hapusBerkas(kunci: string): Promise<"r2" | "supabase" | "gagal"> {
  try {
    if (isR2Key(kunci)) {
      if (!r2Enabled()) return "gagal";
      await r2Delete(r2KeyOf(kunci));
      return "r2";
    }
    const { error } = await db().storage.from(BUCKET).remove([kunci]);
    return error ? "gagal" : "supabase";
  } catch {
    return "gagal";
  }
}

/** Semua kunci foto yang masih dipegang tindak lanjut — tidak boleh dihapus. */
async function kunciTindakLanjut(): Promise<Set<string>> {
  const set = new Set<string>();
  const { data } = await db().from("hygiene_followups").select("photo");
  for (const r of (data ?? []) as { photo: { path?: string; id?: string } | null }[]) {
    const k = r.photo ? kunciFoto(r.photo) : "";
    if (k) set.add(k);
  }
  return set;
}

export async function bersihkanFotoHygiene(opts?: {
  /** Berapa bulan terakhir yang dipertahankan. 1 = hanya bulan berjalan. */
  simpanBulan?: number;
  anggaranMs?: number;
  /** Hitung saja, jangan hapus apa pun. */
  kering?: boolean;
  /** Ikut menyapu berkas yang tidak dirujuk baris mana pun. */
  sapuYatim?: boolean;
}): Promise<HasilBersih> {
  const simpanBulan = opts?.simpanBulan ?? 1;
  const anggaranMs = opts?.anggaranMs ?? 45_000;
  const kering = opts?.kering ?? false;
  const mulai = Date.now();
  const sisaWaktu = () => anggaranMs - (Date.now() - mulai);

  const batas = batasBulan(simpanBulan);
  const hasil: HasilBersih = {
    batasBulan: batas.slice(0, 7),
    barisDibersihkan: 0,
    r2Dihapus: 0,
    supabaseDihapus: 0,
    yatimDihapus: 0,
    dilewatiTindakLanjut: 0,
    gagal: 0,
    selesai: true,
    kering,
  };
  if (!dbEnabled) return hasil;

  const dilindungi = await kunciTindakLanjut();

  // ── Bagian 1: foto milik bulan-bulan yang sudah tutup ────────────────────
  const { data } = await db()
    .from("hygiene")
    .select("id,photos")
    .lt("date", batas)
    .order("date")
    .limit(400);

  for (const baris of (data ?? []) as BarisFoto[]) {
    if (sisaWaktu() < 3_000) { hasil.selesai = false; break; }
    const foto = Array.isArray(baris.photos) ? baris.photos : [];
    if (foto.length === 0) continue;

    const tersisa: typeof foto = [];
    for (const f of foto) {
      const kunci = kunciFoto(f);
      if (!kunci) continue;
      if (dilindungi.has(kunci)) {
        hasil.dilewatiTindakLanjut += 1;
        tersisa.push(f); // masih jadi bukti perkara berjalan
        continue;
      }
      if (kering) {
        if (isR2Key(kunci)) hasil.r2Dihapus += 1; else hasil.supabaseDihapus += 1;
        continue;
      }
      const di = await hapusBerkas(kunci);
      if (di === "r2") hasil.r2Dihapus += 1;
      else if (di === "supabase") hasil.supabaseDihapus += 1;
      else { hasil.gagal += 1; tersisa.push(f); } // gagal → rujukannya dipertahankan
    }

    if (!kering) {
      // Baru setelah berkasnya benar-benar hilang, rujukannya dikosongkan.
      await db().from("hygiene").update({ photos: tersisa }).eq("id", baris.id);
    }
    hasil.barisDibersihkan += 1;
  }

  // ── Bagian 2: berkas yatim — terunggah, tapi tidak dirujuk siapa pun ─────
  if (opts?.sapuYatim && sisaWaktu() > 5_000) {
    const dirujuk = await semuaKunciDirujuk();
    await sapuYatimSupabase(hasil, dirujuk, sisaWaktu, kering);
    if (sisaWaktu() > 5_000) await sapuYatimR2(hasil, dirujuk, sisaWaktu, kering);
  }

  return hasil;
}

/** Setiap kunci foto yang masih dipegang SIAPA PUN — audit maupun tindak lanjut. */
async function semuaKunciDirujuk(): Promise<Set<string>> {
  const set = await kunciTindakLanjut();
  // Halaman demi halaman: tabelnya ribuan baris dan tiap baris membawa ~20 foto.
  for (let dari = 0; ; dari += 500) {
    const { data } = await db().from("hygiene").select("photos").range(dari, dari + 499).order("id");
    const rows = (data ?? []) as { photos: { id?: string; path?: string }[] | null }[];
    for (const r of rows) for (const f of r.photos ?? []) {
      const k = kunciFoto(f);
      if (k) set.add(k);
    }
    if (rows.length < 500) break;
  }
  return set;
}

async function sapuYatimSupabase(
  hasil: HasilBersih,
  dirujuk: Set<string>,
  sisaWaktu: () => number,
  kering: boolean,
): Promise<void> {
  const { data: folder } = await db().storage.from(BUCKET).list("", { limit: 1000 });
  for (const f of folder ?? []) {
    if (sisaWaktu() < 4_000) { hasil.selesai = false; return; }
    // Berkas tersimpan sebagai `<folder pengguna>/<nama berkas>`.
    const { data: isi } = await db().storage.from(BUCKET).list(f.name, { limit: 1000 });
    const yatim = (isi ?? []).map((o) => `${f.name}/${o.name}`).filter((k) => !dirujuk.has(k));
    if (yatim.length === 0) continue;
    if (kering) { hasil.yatimDihapus += yatim.length; continue; }
    const { error } = await db().storage.from(BUCKET).remove(yatim);
    if (error) hasil.gagal += yatim.length;
    else hasil.yatimDihapus += yatim.length;
  }
}

async function sapuYatimR2(
  hasil: HasilBersih,
  dirujuk: Set<string>,
  sisaWaktu: () => number,
  kering: boolean,
): Promise<void> {
  if (!r2Enabled()) return;
  let lanjutan = "";
  do {
    if (sisaWaktu() < 4_000) { hasil.selesai = false; return; }
    const halaman = await r2List("hygiene/", lanjutan);
    for (const o of halaman.keys) {
      // Kunci di R2 disimpan dengan awalan `r2:` di basis data.
      if (dirujuk.has(`r2:${o.key}`)) continue;
      if (sisaWaktu() < 3_000) { hasil.selesai = false; return; }
      if (kering) { hasil.yatimDihapus += 1; continue; }
      await r2Delete(o.key);
      hasil.yatimDihapus += 1;
    }
    lanjutan = halaman.lanjutan;
  } while (lanjutan);
}
