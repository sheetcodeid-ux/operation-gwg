import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { requireSessionUser } from "@/lib/auth";
import { areaName, getOutlets, getUsers } from "@/lib/data/store";
import { can } from "@/lib/rbac";
import { getNavExtra } from "@/lib/data/nav";
import { getOrgExtra } from "@/lib/data/org";
import { getUserDepartments } from "@/lib/data/user-departments";
import { allDepartments, setOrgExtras } from "@/lib/assessment/org";
import { assignableDivisions, groupsFor, kunciEntri, setNavExtras, visibleMenusOf, type NavExtra } from "@/lib/nav";
import type { DivisionGroups } from "@/components/admin/group-manager";
import { listAkunYatim } from "@/lib/data/akun-yatim";
import { AkunYatimKartu } from "@/components/admin/akun-yatim";
import { UserManager, type OrgDept, type OutletLite, type UserRow } from "@/components/admin/user-manager";

export const metadata: Metadata = { title: "User Management" };

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ add?: string; name?: string; div?: string }> }) {
  const user = await requireSessionUser();
  if (!can(user, "manage_users")) redirect("/dashboard");

  const sp = await searchParams;
  const initialPrefill = sp.add ? { name: sp.name ?? "", division: sp.div ?? "" } : undefined;

  const users = getUsers();

  function scopeOf(u: (typeof users)[number]) {
    const n = u.outletIds?.length ?? 0;
    if (n === 0 && !u.areaId) return "Head Office";
    if (u.role === "area_coordinator") return `${n} outlets`;
    return n ? `${n} outlet` : "Head Office";
  }

  const userRows: UserRow[] = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    areaId: u.areaId ?? null,
    outletIds: u.outletIds ?? [],
    active: u.active,
    scope: scopeOf(u),
    createdAt: u.createdAt,
    phone: u.phone ?? null,
    country: u.country ?? null,
    avatarUrl: u.avatarUrl ?? null,
    department: u.department ?? null,
    jabatan: u.jabatan ?? null,
    grants: u.grants ?? [],
  }));

  const outletLite: OutletLite[] = getOutlets().map((o) => ({
    id: o.id,
    name: o.name,
    code: o.code,
    areaId: o.areaId,
    areaName: areaName(o.areaId),
  }));

  const navExtra: NavExtra = await getNavExtra();

  // Susunan "bidang kerja" tiap divisi untuk penyusun sidebar.
  setNavExtras(navExtra);
  const sidebarGroups: DivisionGroups[] = assignableDivisions().map((d) => ({
    division: d.name,
    menus: visibleMenusOf(d.name),
    // Penyusun sidebar di User Management hanya mengurus KUNCI menu. Baris
    // berbentuk panjang (beberapa tautan berbagi satu izin, mis. SOP tiap
    // pilar) diciutkan ke kuncinya — yang bisa diatur admin memang izinnya,
    // bukan tautannya satu per satu.
    groups: groupsFor(d.name).map((g) => ({
      name: g.name,
      icon: g.icon,
      menus: [...new Set(g.menus.map(kunciEntri))],
    })),
    isDefault: !(navExtra.groups ?? []).some((g) => g.division === d.name),
  }));

  // Admin-managed department → jabatan taxonomy (drives the Add User comboboxes).
  const orgDepts: OrgDept[] = (await getUserDepartments()).map((d) => ({ id: d.id, name: d.name, jabatan: d.jabatan }));

  // Selectable org departments/divisions = managed department taxonomy +
  // assessment departments (built-in + admin-added) + custom sidebar divisions.
  setOrgExtras(await getOrgExtra());
  const departmentOptions = [
    ...new Set([
      ...orgDepts.map((d) => d.name),
      ...allDepartments().map((d) => d.name),
      ...navExtra.divisions.map((d) => d.name),
    ]),
  ];

  // Akun login yang tidak punya profil — pertanyaan "kenapa dia tidak bisa
  // masuk" bermuara ke halaman ini, jadi jawabannya harus ada di halaman ini.
  const yatim = await listAkunYatim();

  return (
    <div className="w-full">
      <AkunYatimKartu rows={yatim} />
      <UserManager
        users={userRows}
        outlets={outletLite}
        navExtra={navExtra}
        sidebarGroups={sidebarGroups}
        departmentOptions={departmentOptions}
        orgDepts={orgDepts}
        initialPrefill={initialPrefill}
      />
    </div>
  );
}
