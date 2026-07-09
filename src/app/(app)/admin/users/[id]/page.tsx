import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, Shield, User as UserIcon } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { getUser } from "@/lib/data/store";
import { can } from "@/lib/rbac";
import { ROLE_LABEL } from "@/lib/constants";
import { ROLE_DIVISION } from "@/lib/nav";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { UserDetailTabs } from "@/components/admin/user-detail-tabs";

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
          <p className="text-sm text-muted-foreground">Lihat data pribadi dan peran yang ditetapkan</p>
        </div>
      </div>

      {/* profile */}
      <div className="glass rounded-2xl border border-border p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar name={u.name} size={64} src={u.avatarUrl} />
            <div className="min-w-0">
              <p className="text-xl font-semibold text-foreground">{u.name}</p>
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <UserIcon className="size-3.5" /> @{username}
              </p>
            </div>
          </div>
          <Badge tone={u.active ? "success" : "danger"} dot>
            {u.active ? "Aktif" : "Nonaktif"}
          </Badge>
        </div>

        <div className="mt-5 border-t border-border pt-4">
          <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <Shield className="size-3.5" /> Peran Ditetapkan
          </p>
          <span className="mt-2 inline-block">
            <Badge tone="brand">{ROLE_LABEL[u.role]}</Badge>
          </span>
        </div>
      </div>

      <UserDetailTabs
        u={{
          username,
          name: u.name,
          email: u.email,
          roleLabel: ROLE_LABEL[u.role],
          division: ROLE_DIVISION[u.role],
          createdLabel,
          phone: u.phone ?? null,
          country: u.country ?? null,
        }}
      />
    </div>
  );
}
