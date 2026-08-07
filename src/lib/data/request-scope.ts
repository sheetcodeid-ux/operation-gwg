import "server-only";

import { getUsers, visibleOutlets } from "./store";
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

/**
 * Apakah `user` boleh membuka satu pengajuan tertentu.
 *
 * Dipakai jalur yang menerima id dari luar (hapus, detail), supaya menebak id
 * pengajuan orang lain tidak membocorkan apa pun.
 */
export function canSeeRequest(user: UserProfile, req: { requesterId: string; department: string }): boolean {
  const scope = requestScopeFor(user);
  if (scope.requesterIds) return scope.requesterIds.includes(req.requesterId);
  if (scope.department) return req.department === scope.department;
  return true; // HQ
}
