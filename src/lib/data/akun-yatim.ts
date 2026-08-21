import "server-only";

import { db, dbEnabled } from "./db";

/**
 * Akun login yang tidak punya profil karyawan.
 *
 * Orang seperti ini bisa memasukkan password dengan BENAR — Supabase menerima —
 * lalu ditolak aplikasi karena profilnya tidak ketemu. Dari sisi mereka tampak
 * seperti password salah, dan tidak ada satu pun layar yang bisa menunjukkan
 * duduk persoalannya sampai daftar ini ada.
 */
export interface AkunYatim {
  email: string;
  dibuat: string | null;
  loginTerakhir: string | null;
}

export async function listAkunYatim(): Promise<AkunYatim[]> {
  if (!dbEnabled) return [];
  try {
    const { data, error } = await db().rpc("gwg_akun_yatim");
    if (error || !Array.isArray(data)) return [];
    return (data as { email: string; dibuat: string | null; login_terakhir: string | null }[]).map((r) => ({
      email: r.email,
      dibuat: r.dibuat,
      loginTerakhir: r.login_terakhir,
    }));
  } catch {
    return [];
  }
}
