import "server-only";

import { getUsers, visibleOutlets } from "./store";
import { canReachMenu } from "@/lib/nav";
import { hasGlobalScope } from "@/lib/rbac";
import type { ListRequestOpts } from "./hc-requests";
import type { UserProfile } from "@/lib/types";

/**
 * Siapa saja yang pengajuannya boleh dilihat seorang pengguna.
 *
 * Sebelumnya semua halaman Pengajuan menyaring dengan `department`. Itu bocor
 * parah untuk supervisor: KELIMA PULUH supervisor memakai department yang sama
 * ("Supervisor"), jadi supervisor Singkawang ikut melihat pengajuan Ketapang,
 * Mempawah, Banjarmasin, dan seterusnya. Department memang membedakan tim
 * kantor (Creative, HC, Finance), tapi sama sekali tidak membedakan cabang.
 *
 * Aturannya sekarang mengikuti jangkauan orangnya, bukan label departemennya:
 *
 *  • Super Admin dan peran HQ  → seluruh pengajuan.
 *  • Supervisor                → hanya pengajuannya sendiri; ia memegang satu
 *                                cabang dan tidak membawahi pengaju lain.
 *  • Koordinator Area          → miliknya sendiri + supervisor di outlet yang
 *                                memang jadi tanggung jawabnya.
 *  • Peran kantor lainnya      → rekan satu departemen, seperti sebelumnya.
 */
export function requestScopeFor(user: UserProfile): ListRequestOpts {
  if (hasGlobalScope(user.role)) return {};

  if (user.role === "supervisor") return { requesterIds: [user.id] };

  if (user.role === "area_coordinator") {
    const outletIds = new Set(visibleOutlets(user).map((o) => o.id));
    const supervisors = getUsers()
      .filter((u) => u.role === "supervisor" && (u.outletIds ?? []).some((id) => outletIds.has(id)))
      .map((u) => u.id);
    return { requesterIds: [user.id, ...supervisors] };
  }

  return { department: user.department ?? "—" };
}

/** Tim yang meninjau satu jenis pengajuan — Creative untuk design, HC sisanya. */
function isReviewer(user: UserProfile, kind: string | undefined): boolean {
  if (kind === "design") return canReachMenu(user, "creative_design");
  if (kind === "pelatihan") return canReachMenu(user, "hc_training") || canReachMenu(user, "fin_training");
  if (kind === "rekrutmen") return canReachMenu(user, "hc_reqreview");
  return false;
}

/**
 * Apakah `user` boleh membuka satu pengajuan tertentu.
 *
 * Dipakai jalur yang menerima id dari luar (hapus, detail, teruskan ke obrolan),
 * supaya menebak id pengajuan orang lain tidak membocorkan apa pun.
 *
 * `department` pada pengajuan adalah departemen PENGAJU, bukan yang mengerjakan.
 * Menyaring dengan itu saja pernah membuat PIC Creative ditolak saat hendak
 * membahas pengajuan design yang SEDANG IA KERJAKAN sendiri: ia melihatnya di
 * Antrian Design (yang menyaring per jenis), tapi ditolak di Pesan (yang
 * menyaring per departemen) — dua jalur dengan aturan berbeda untuk satu
 * pengajuan yang sama.
 *
 * Tiga jalur pertama di bawah menutup celah itu tanpa melonggarkan cakupan
 * siapa pun: pengaju, orang yang ditugaskan, dan tim peninjau jenis tersebut
 * memang sudah bisa melihat pengajuannya lewat halaman masing-masing.
 */
export function canSeeRequest(
  user: UserProfile,
  req: { requesterId: string; department: string; assigneeId?: string | null; kind?: string },
): boolean {
  if (req.requesterId === user.id) return true;
  if (req.assigneeId && req.assigneeId === user.id) return true;
  if (isReviewer(user, req.kind)) return true;

  const scope = requestScopeFor(user);
  if (scope.requesterIds) return scope.requesterIds.includes(req.requesterId);
  if (scope.department) return req.department === scope.department;
  return true; // HQ
}
