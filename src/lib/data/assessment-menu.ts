import "server-only";

import { getAssessmentSchedule } from "./assessment-schedule";
import { listAssignments, listRoster } from "./assessment-roster";
import { canAccessAssessment, isPrivilegedEvaluator } from "@/lib/assessment/window";
import type { UserProfile } from "@/lib/types";

/**
 * Apakah menu "Assessment" boleh terbuka untuk seseorang SAAT INI.
 *
 * Assessment adalah kegiatan berkala, bukan menu tetap. Sebelumnya setiap akun
 * `member` selalu memilikinya (`ROLE_MENUS.member = ["assessment"]`), dan karena
 * menu itu tinggal di divisi Human Capital, seorang desainer Creative melihat
 * divisi Human Capital ikut terbuka di sidebar-nya — padahal periodenya sudah
 * lewat dan ia memang bukan bagian dari HC.
 *
 * Tiga syaratnya:
 *
 * 1. Penilai inti (Head / Director / HRD / Admin) selalu boleh — merekalah yang
 *    menjalankan wawancara dan keputusan akhir, termasuk setelah periode tutup.
 * 2. Selain itu, periodenya harus sedang BERJALAN.
 * 3. Dan orangnya harus benar-benar ikut: ada di roster, atau ditunjuk sebagai
 *    atasan/rekan sejawat seseorang. Periode terbuka bukan alasan membuka menu
 *    untuk orang yang tidak dinilai dan tidak menilai siapa pun.
 */
export async function assessmentMenuOpen(user: UserProfile): Promise<boolean> {
  const akses = { role: user.role, jabatan: user.jabatan, department: user.department };
  if (isPrivilegedEvaluator(akses)) return true;

  const schedule = await cachedSchedule();
  if (!canAccessAssessment(akses, schedule)) return false;

  const [roster, assignments] = await Promise.all([listRoster(), listAssignments()]);
  return (
    roster.some((r) => r.userId === user.id && r.active) ||
    assignments.some(
      (a) =>
        a.participantUserId === user.id ||
        a.atasanUserId === user.id ||
        a.peerUserIds.includes(user.id),
    )
  );
}

/**
 * Jadwalnya dibaca di layout — artinya di SETIAP perpindahan halaman, padahal
 * isinya hanya berubah saat admin mengubah periodenya. Sama seperti konfigurasi
 * sidebar, disimpan sebentar di memori instance supaya klik menu tidak membayar
 * satu perjalanan ke database lebih dulu.
 */
const g = globalThis as typeof globalThis & {
  __GWG_ASSESSMENT_SCHEDULE__?: { at: number; value: Awaited<ReturnType<typeof getAssessmentSchedule>> };
};
const TTL_MS = 60_000;

async function cachedSchedule() {
  const memo = g.__GWG_ASSESSMENT_SCHEDULE__;
  if (memo && Date.now() - memo.at < TTL_MS) return memo.value;
  const value = await getAssessmentSchedule();
  g.__GWG_ASSESSMENT_SCHEDULE__ = { at: Date.now(), value };
  return value;
}

/** Dipanggil saat admin menyimpan jadwal baru, supaya perubahannya langsung terasa. */
export function invalidateAssessmentSchedule() {
  g.__GWG_ASSESSMENT_SCHEDULE__ = undefined;
}
