import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, LayoutGrid, Network, Users } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { builtInDepartments } from "@/lib/assessment/org";
import { getOrgExtra } from "@/lib/data/org";
import { NAV_MENUS } from "@/lib/nav";
import { getNavExtra } from "@/lib/data/nav";
import { DeptManager, type DeptDisplay } from "@/components/admin/dept-manager";
import { DivisionManager, type DivisionDisplay, type MenuOption } from "@/components/admin/division-manager";

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
      <div className="mb-5 flex items-center gap-3">
        <Link
          href="/admin/users"
          className="grid size-9 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div className="flex items-center gap-2">
          <Network className="size-5 text-muted-foreground" />
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Departemen &amp; Divisi</h1>
            <p className="text-sm text-muted-foreground">Kelola struktur organisasi assessment &amp; divisi aplikasi (sidebar)</p>
          </div>
        </div>
      </div>

      {/* ── Assessment org: departments + employees ── */}
      <div className="mb-3 flex items-center gap-2">
        <Users className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold text-foreground">Struktur Assessment — Departemen &amp; Karyawan</h2>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">Dipakai di pemilihan karyawan &amp; penilaian pada halaman Assessment.</p>
      <DeptManager departments={departments} />

      {/* ── App navigation divisions ── */}
      <div className="mt-8 mb-3 flex items-center gap-2">
        <LayoutGrid className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold text-foreground">Divisi Aplikasi — Grup Menu di Sidebar</h2>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Tambah grup divisi baru di sidebar (mis. Marketing) berisi menu pilihan. Aksesnya diatur per pengguna lewat Hak Akses di User Management.
      </p>
      <DivisionManager divisions={divisions} menuOptions={menuOptions} />
    </div>
  );
}
