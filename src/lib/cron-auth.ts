import "server-only";

import { getAppConfig } from "@/lib/data/app-config";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Siapa yang boleh menjalankan rute cron.
 *
 * Ditaruh di satu tempat dengan sengaja. Aturannya pernah salah sekali —
 * User-Agent diterima begitu saja padahal isinya ditentukan pemanggil — dan
 * kalau tiap rute cron menyalin aturannya sendiri, perbaikan seperti itu hanya
 * mendarat di salah satunya. Rute cron berikutnya cukup memanggil ini.
 *
 * Urutannya disengaja: token dulu, User-Agent belakangan.
 *
 * Jalur User-Agent tidak dihapus, karena cron Vercel akan berhenti bekerja
 * kalau `CRON_SECRET` belum disetel — dan mematikan penjadwalan tanpa
 * pemberitahuan lebih berbahaya daripada lubangnya sendiri. Yang dilakukan:
 *  • begitu `CRON_SECRET` disetel di Vercel, jalur User-Agent MATI total;
 *  • selama belum disetel, jalur itu dibatasi {@link UA_LIMIT} kali per jam.
 */
const UA_LIMIT = 2;
const UA_WINDOW_MS = 60 * 60 * 1000;

export async function cronAuthorized(req: Request, kunciConfig: string, namaRute: string): Promise<boolean> {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const secret = process.env.CRON_SECRET;
  if (secret && token === secret) return true;
  if (token) {
    const dbToken = await getAppConfig(kunciConfig);
    if (dbToken && token === dbToken) return true;
  }

  const uaCocok = (req.headers.get("user-agent") ?? "").startsWith("vercel-cron");
  if (!uaCocok) return false;
  if (secret) {
    // Sudah ada cara yang benar untuk membuktikan diri, jadi tebakan lewat
    // User-Agent tidak lagi diperlukan — dan karenanya tidak lagi diterima.
    console.warn(`[cron:${namaRute}] permintaan ber-User-Agent vercel-cron ditolak: CRON_SECRET sudah disetel`);
    return false;
  }
  const rl = rateLimit(`cron:${namaRute}:ua`, UA_LIMIT, UA_WINDOW_MS);
  if (!rl.ok) {
    console.warn(`[cron:${namaRute}] jalur User-Agent melewati batas; setel CRON_SECRET di Vercel agar rute ini benar-benar terkunci`);
    return false;
  }
  return true;
}
