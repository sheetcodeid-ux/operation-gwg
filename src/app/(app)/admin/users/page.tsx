import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth";
import { areaName, getOutlets, getUsers } from "@/lib/data/store";
import { can } from "@/lib/rbac";
import { getNavExtra } from "@/lib/data/nav";
import type { NavExtra } from "@/lib/nav";
import { UserManager, type OutletLite, type UserRow } from "@/components/admin/user-manager";

export const metadata: Metadata = { title: "User Management" };

export default async function UsersPage() {
  const user = (await getSessionUser())!;
  if (!can(user, "manage_users")) redirect("/dashboard");

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

  return (
    <div className="w-full">
      <UserManager users={userRows} outlets={outletLite} navExtra={navExtra} />
    </div>
  );
}
