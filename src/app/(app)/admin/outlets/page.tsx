import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { requireSessionUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { getOutlets, getUsers } from "@/lib/data/store";
import { merekOutlet } from "@/lib/kpi/merek";
import { DaftarOwner, OutletManager, type BarisOutlet, type PilihanCoordinator } from "@/components/admin/outlet-manager";

export const metadata: Metadata = { title: "Manajemen Outlet" };

/**
 * Manajemen Outlet — pemilik dan coordinator area tiap outlet.
 *
 * Datanya dirakit di server, sama seperti User Management: yang dikirim ke
 * peramban sudah berupa baris siap tampil, bukan seluruh isi tabel pengguna
 * hanya untuk mencari siapa yang memegang outlet mana.
 */
export default async function OutletsPage() {
  const user = await requireSessionUser();
  if (!can(user, "manage_users")) redirect("/dashboard");

  // Outlet → siapa coordinator areanya. Dibalik dari `users.outlet_ids`, yang
  // memang satu-satunya tempat penugasan itu tersimpan.
  const pemegang = new Map<string, { id: string; nama: string }>();
  for (const u of getUsers()) {
    if (u.role !== "area_coordinator" || u.active === false) continue;
    for (const id of u.outletIds ?? []) pemegang.set(id, { id: u.id, nama: u.name });
  }

  const outlets: BarisOutlet[] = getOutlets()
    .map((o) => {
      const c = pemegang.get(o.id) ?? null;
      return {
        id: o.id,
        nama: o.name,
        kode: o.code,
        brand: merekOutlet(o.name)?.label ?? "",
        kota: o.city ?? "",
        aktif: o.active,
        owner: o.owner ?? null,
        coordinatorId: c?.id ?? null,
        coordinatorNama: c?.nama ?? null,
        punyaCabang: !!o.esbBranchId,
      };
    })
    .sort((a, b) => a.nama.localeCompare(b.nama, "id"));

  const coordinators: PilihanCoordinator[] = getUsers()
    .filter((u) => u.role === "area_coordinator" && u.active !== false)
    .map((u) => ({ value: u.id, label: u.name, outlet: (u.outletIds ?? []).length }))
    .sort((a, b) => a.label.localeCompare(b.label, "id"));

  const owners = [...new Set(outlets.map((o) => o.owner).filter((o): o is string => !!o))].sort((a, b) =>
    a.localeCompare(b, "id"),
  );

  return (
    <div className="w-full">
      <OutletManager outlets={outlets} coordinators={coordinators} />
      <DaftarOwner owners={owners} />
    </div>
  );
}
