import { areaName, getUsers, listDeptTasks, outletName, userName, visibleOutlets } from "@/lib/data/store";
import { allDepartments, setOrgExtras } from "@/lib/assessment/org";
import { getOrgExtra } from "@/lib/data/org";
import { getNavExtra } from "@/lib/data/nav";
import { categoriesByDivision } from "@/lib/data/task-categories";
import { hasGlobalScope } from "@/lib/rbac";
import type { UserProfile } from "@/lib/types";
import type { WorkRow } from "./work-table";

export type DivisionMembers = Record<string, { id: string; name: string; jabatan?: string | null }[]>;

/** Enriched task rows shared by the Work Tracker table, Kanban and Calendar
 *  views — DEPARTMENT-SCOPED (each team sees only its own tasks; Super Admin
 *  sees all). */
/** Ringkasan cakupan untuk kolom tabel: satu cabang tampil namanya, banyak
 *  cabang tampil jumlahnya, brand tampil daftar brand-nya. */
function scopeLabel(t: { outletId: string | null; outletIds?: string[]; brands?: string[] }): string {
  if (t.brands?.length) return t.brands.join(", ");
  const ids = t.outletIds?.length ? t.outletIds : t.outletId ? [t.outletId] : [];
  if (ids.length === 0) return "No branch";
  if (ids.length === 1) return outletName(ids[0]);
  return `${ids.length} cabang`;
}

export function buildWorkRows(user: UserProfile): WorkRow[] {
  const avatarById = new Map(getUsers().map((u) => [u.id, u.avatarUrl ?? null]));
  return listDeptTasks(user).map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    category: t.category,
    priority: t.priority,
    status: t.status,
    division: t.division,
    outletId: t.outletId ?? "",
    outlet: scopeLabel(t),
    outletIds: t.outletIds ?? [],
    brands: t.brands ?? [],
    area: t.areaId ? areaName(t.areaId) : "—",
    picIds: t.picIds,
    pic: t.picIds.length ? t.picIds.map(userName).join(", ") : "—",
    picAvatarUrl: t.picIds.length ? avatarById.get(t.picIds[0]) ?? null : null,
    startDate: t.startDate,
    dueDate: t.dueDate,
    progress: t.progress,
  }));
}

/**
 * Daftar departemen yang bisa dipilih untuk tugas.
 *
 * Tiga sumber, dan sumber KETIGA yang paling menentukan:
 *
 *  1. struktur org bawaan (assessment) + yang ditambahkan admin,
 *  2. divisi sidebar buatan sendiri,
 *  3. departemen yang benar-benar tercatat pada akun aktif.
 *
 * Yang ketiga dulu tidak ada, dan akibatnya bukan sekadar "satu nama hilang
 * dari dropdown". Tim System Support — empat orang aktif — tidak tercantum di
 * struktur bawaan, jadi seluruh timnya lenyap dari Work Tracker: anggotanya
 * tidak bisa dipilih sebagai PIC, dan tiap anggotanya yang membuka Work Tracker
 * dilempar ke departemen ORANG LAIN (yang pertama menurut abjad, Finance
 * Accounting Tax) lengkap dengan papan kosong yang membingungkan.
 *
 * Tempat orang benar-benar terdaftar adalah kebenaran tentang tim mana yang
 * ada. Struktur yang ditulis tangan hanya melengkapinya, tidak membatasinya.
 */
export async function departmentList(): Promise<string[]> {
  setOrgExtras(await getOrgExtra());
  const nav = await getNavExtra();
  const dariAkun = getUsers()
    .filter((u) => u.active)
    .map((u) => (u.department ?? "").trim())
    .filter(Boolean);
  return [...new Set([...allDepartments().map((d) => d.name), ...nav.divisions.map((d) => d.name), ...dariAkun])];
}

/** Coordinator-aware outlets + department members for the New Task sheet.
 *  Tasks are organised by department (Finance, Creative, …); PIC candidates are
 *  the active members of the chosen department. */
export async function buildTaskSheetData(user: UserProfile) {
  const all = visibleOutlets(user);
  const allIds = new Set(all.map((o) => o.id));
  const coordinators = getUsers().filter(
    (u) => u.role === "area_coordinator" && (u.outletIds ?? []).some((id) => allIds.has(id)),
  );
  const coordByOutlet = new Map<string, string>();
  for (const c of coordinators) for (const oid of c.outletIds ?? []) coordByOutlet.set(oid, c.id);

  const divisions = await departmentList();
  const activeUsers = getUsers().filter((u) => u.active);
  const members: DivisionMembers = {};
  for (const d of divisions) {
    members[d] = activeUsers.filter((u) => u.department === d).map((u) => ({ id: u.id, name: u.name, jabatan: u.jabatan ?? null }));
  }

  const isAdmin = hasGlobalScope(user.role);
  // A member creates tasks only for their OWN department (no division picker);
  // Super Admin may still target any department.
  //
  // Departemen orangnya dipakai apa adanya. Dulu ia harus lolos `divisions`
  // dulu, dan yang tidak lolos diganti `divisions[0]` — bukan "tidak ada
  // departemen", melainkan departemen tim lain. Itu menampilkan papan tugas
  // Finance kepada orang System Support, dan tidak ada satu pun di layar yang
  // memberi tahu bahwa yang ia lihat bukan timnya.
  const userDepartment = (user.department ?? "").trim() || divisions[0] || "";
  const defaultDivision = userDepartment;

  // Category options per department (custom list, or defaults when none defined).
  const categories = await categoriesByDivision(divisions);

  return {
    outlets: all.map((o) => ({ id: o.id, name: o.name, coordinatorId: coordByOutlet.get(o.id) ?? null })),
    coordinators: coordinators.map((c) => ({ id: c.id, name: c.name })),
    members,
    divisions,
    defaultDivision,
    isAdmin,
    userDepartment,
    categories,
  };
}
