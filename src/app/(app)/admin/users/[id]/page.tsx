import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, KeyRound, LayoutGrid, ShieldCheck, User as UserIcon, Briefcase } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { areaName, getOutlets, getUser } from "@/lib/data/store";
import { can } from "@/lib/rbac";
import { ROLE_LABEL } from "@/lib/constants";
import { ROLE_DIVISION, accessibleMenuKeys, navAll, setNavExtras } from "@/lib/nav";
import { getNavExtra } from "@/lib/data/nav";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { StatTile } from "@/components/ui/stat";
import { UserDetailActions } from "@/components/admin/user-detail-actions";
import { UserDetailTabs, type AccessEntry } from "@/components/admin/user-detail-tabs";
import type { OutletLite, UserRow } from "@/components/admin/user-manager";

export const metadata: Metadata = { title: "Detail Pengguna" };

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = (await getSessionUser())!;
  if (!can(admin, "manage_users")) redirect("/dashboard");

  const { id } = await params;
  const u = getUser(id);
  if (!u) notFound();

  const username = u.email.split("@")[0];
  const created = new Date(u.createdAt);
  const createdLabel = Number.isNaN(created.getTime())
    ? "—"
    : created.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

  const n = u.outletIds?.length ?? 0;
  const scope = n === 0 && !u.areaId ? "Head Office" : u.role === "area_coordinator" ? `${n} outlets` : n ? `${n} outlet` : "Head Office";

  const row: UserRow = {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    areaId: u.areaId ?? null,
    outletIds: u.outletIds ?? [],
    active: u.active,
    scope,
    createdAt: u.createdAt,
    phone: u.phone ?? null,
    country: u.country ?? null,
    avatarUrl: u.avatarUrl ?? null,
    department: u.department ?? null,
    jabatan: u.jabatan ?? null,
    grants: u.grants ?? [],
  };

  const outlets: OutletLite[] = getOutlets().map((o) => ({ id: o.id, name: o.name, code: o.code, areaId: o.areaId, areaName: areaName(o.areaId) }));

  // Menus this user can actually open (own division from role + explicit grants).
  setNavExtras(await getNavExtra());
  const home = ROLE_DIVISION[u.role];
  const orgDivision = u.department || home; // display label (org placement)
  const roleAllowed = new Set(accessibleMenuKeys(u.role));
  const grants = new Set(u.grants ?? []);
  const access: AccessEntry[] = navAll()
    .map((i) => {
      const fromRole = i.section === home && roleAllowed.has(i.key);
      const granted = grants.has(`${i.section}:${i.key}`);
      if (!fromRole && !granted) return null;
      return { section: i.section, label: i.label, source: fromRole ? "role" : "grant" } as AccessEntry;
    })
    .filter((x): x is AccessEntry => x !== null);

  return (
    <div className="w-full max-w-5xl">
      {/* header */}
      <div className="mb-5 flex items-center gap-3">
        <Link
          href="/admin/users"
          className="grid size-9 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Detail Pengguna</h1>
          <p className="text-sm text-muted-foreground">Lihat & kelola data, peran, dan hak akses pengguna</p>
        </div>
      </div>

      {/* profile banner */}
      <div className="glass overflow-hidden rounded-2xl border border-border">
        <div className="h-20 bg-gradient-to-r from-brand-500/25 via-cyan-500/15 to-transparent" />
        <div className="px-5 pb-5">
          <div className="-mt-8 flex flex-wrap items-end justify-between gap-4">
            <div className="flex items-end gap-4">
              <Avatar name={u.name} size={72} src={u.avatarUrl} className="ring-4 ring-background" />
              <div className="min-w-0 pb-1">
                <p className="text-xl font-semibold text-foreground">{u.name}</p>
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <UserIcon className="size-3.5" /> @{username}
                </p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2 pb-1">
              <Badge tone={u.active ? "success" : "danger"} dot>
                {u.active ? "Aktif" : "Nonaktif"}
              </Badge>
              <UserDetailActions user={row} outlets={outlets} />
            </div>
          </div>
        </div>
      </div>

      {/* summary tiles */}
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={Briefcase} label="Divisi" value={orgDivision} sub={u.department ? "Departemen" : "Divisi asal"} />
        <StatTile icon={ShieldCheck} label="Peran" value={ROLE_LABEL[u.role]} sub="Role akses" />
        <StatTile icon={LayoutGrid} label="Menu Akses" value={access.length} sub={`${grants.size} tambahan`} />
        <StatTile icon={KeyRound} label="Cakupan" value={scope} sub="Penugasan" />
      </div>

      <UserDetailTabs
        u={{
          username,
          name: u.name,
          email: u.email,
          roleLabel: ROLE_LABEL[u.role],
          division: home,
          createdLabel,
          phone: u.phone ?? null,
          country: u.country ?? null,
          access,
        }}
      />
    </div>
  );
}
