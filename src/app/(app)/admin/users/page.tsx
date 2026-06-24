import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth";
import { areaName, getOutlets, getUsers } from "@/lib/data/store";
import { can } from "@/lib/rbac";
import type { Role } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatTile } from "@/components/ui/stat";
import { UserManager, type OutletLite, type UserRow } from "@/components/admin/user-manager";

export const metadata: Metadata = { title: "User Management" };

export default async function UsersPage() {
  const user = (await getSessionUser())!;
  if (!can(user, "manage_users")) redirect("/dashboard");

  const users = getUsers();
  const byRole = (r: Role) => users.filter((u) => u.role === r).length;

  function scopeOf(u: (typeof users)[number]) {
    if (u.role === "area_coordinator") return `${u.outletIds?.length ?? 0} outlets`;
    if (u.role === "supervisor") return `${u.outletIds?.length ?? 0} outlet`;
    if (u.role === "pic_outlet") return `${u.outletIds?.length ?? 0} outlet`;
    return "Global";
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
  }));

  const outletLite: OutletLite[] = getOutlets().map((o) => ({
    id: o.id,
    name: o.name,
    code: o.code,
    areaId: o.areaId,
    areaName: areaName(o.areaId),
  }));

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader icon={Users} title="User Management" description="Provision accounts, assign access scope, and manage passwords" />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={Users} label="Total Users" value={users.length} tone="brand" />
        <StatTile icon={Users} label="Area Coordinators" value={byRole("area_coordinator")} tone="success" />
        <StatTile icon={Users} label="Supervisors" value={byRole("supervisor")} tone="cyan" />
        <StatTile icon={Users} label="PIC Outlet" value={byRole("pic_outlet")} tone="amber" />
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Directory</CardTitle>
        </CardHeader>
        <CardContent>
          <UserManager users={userRows} outlets={outletLite} />
        </CardContent>
      </Card>
    </div>
  );
}
