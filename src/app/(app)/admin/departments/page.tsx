import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, Network } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { builtInDepartments } from "@/lib/assessment/org";
import { getOrgExtra } from "@/lib/data/org";
import { NAV_MENUS } from "@/lib/nav";
import { getNavExtra } from "@/lib/data/nav";
import { PageHeader } from "@/components/ui/page-header";
import { OrgSettings } from "@/components/admin/org-settings";
import { type DeptDisplay } from "@/components/admin/dept-manager";
import { type DivisionDisplay, type MenuOption } from "@/components/admin/division-manager";

export const metadata: Metadata = { title: "Departemen & Divisi" };

export default async function DepartmentsPage() {
  const user = (await getSessionUser())!;
  if (!can(user, "manage_users")) redirect("/dashboard");

  const base = builtInDepartments();
  const extra = await getOrgExtra();

  const map = new Map<string, DeptDisplay>();
  for (const d of base) {
    map.set(d.id, {
      id: d.id,
      name: d.name,
      source: "base",
      employees: d.positions.flatMap((p) => p.employees.map((e) => ({ id: e.id, name: e.name, jabatan: p.title, source: "base" as const }))),
    });
  }
  for (const d of extra.departments) {
    if (!map.has(d.id)) map.set(d.id, { id: d.id, name: d.name, source: "extra", employees: [] });
  }
  for (const e of extra.employees) {
    let dept = map.get(e.departmentId);
    if (!dept) {
      dept = { id: e.departmentId, name: e.departmentId, source: "extra", employees: [] };
      map.set(e.departmentId, dept);
    }
    dept.employees.push({ id: e.id, name: e.name, jabatan: e.jabatan, source: "extra" });
  }
  const departments = [...map.values()];

  const navExtra = await getNavExtra();
  const divisions: DivisionDisplay[] = navExtra.divisions.map((d) => ({ id: d.id, name: d.name, icon: d.icon, menus: d.menus }));
  const menuOptions: MenuOption[] = NAV_MENUS.map((m) => ({ key: m.key, label: m.label }));

  return (
    <div className="w-full">
      <PageHeader
        icon={Network}
        title="Departemen & Divisi"
        description="Kelola struktur organisasi assessment & divisi aplikasi (sidebar)"
        actions={
          <Link
            href="/admin/users"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            <ArrowLeft className="size-4" /> User Management
          </Link>
        }
      />

      <OrgSettings departments={departments} divisions={divisions} menuOptions={menuOptions} />
    </div>
  );
}
