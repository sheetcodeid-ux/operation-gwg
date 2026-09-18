import { MessageSquareWarning, Store } from "lucide-react";
import { ConciergeBell, SprayCan } from "lucide-react";
import type { Metadata } from "next";
import { requireSessionUser } from "@/lib/auth";
import { areaName, getAreas, getOutlet, outletRanking, userName } from "@/lib/data/store";
import { PageHeader } from "@/components/ui/page-header";
import { StatTile } from "@/components/ui/stat";
import { OutletsExplorer, type OutletRow } from "@/components/outlets/outlets-explorer";
import { SyncOutletsButton } from "@/components/outlets/sync-outlets";

export const metadata: Metadata = { title: "Outlets" };

export default async function OutletsPage() {
  const user = await requireSessionUser();
  const ranking = outletRanking(user);

  const rows: OutletRow[] = ranking.map((r) => ({
    id: r.outlet.id,
    name: r.outlet.name,
    code: r.outlet.code,
    city: r.outlet.city,
    areaId: r.outlet.areaId,
    area: areaName(r.outlet.areaId),
    supervisor: userName(getOutlet(r.outlet.id)?.supervisorId ?? ""),
    hospitality: r.hospitality,
    hygiene: r.hygiene,
    complaints: r.complaints,
    composite: r.composite,
  }));

  const areaIds = new Set(rows.map((r) => r.areaId));
  const areas = getAreas()
    .filter((a) => areaIds.has(a.id))
    .map((a) => ({ id: a.id, name: a.name }));

  // Rata-rata hanya dari outlet yang BENAR-BENAR punya skornya. Outlet yang
  // belum diaudit tidak ikut sebagai nol — itu akan menyeret rata-rata seluruh
  // perusahaan turun karena pekerjaan audit yang belum selesai, bukan karena
  // ada yang memburuk. Null bila tak satu pun outlet punya skornya.
  const rata = (xs: (number | null)[]): number | null => {
    const ada = xs.filter((x): x is number => x !== null);
    return ada.length ? Math.round(ada.reduce((a, b) => a + b, 0) / ada.length) : null;
  };
  const avgHosp = rata(rows.map((r) => r.hospitality));
  const avgHyg = rata(rows.map((r) => r.hygiene));
  const openComplaints = rows.reduce((a, b) => a + b.complaints, 0);

  return (
    <div className="w-full">
      <PageHeader
        icon={Store}
        title="Outlets"
        description={`${rows.length} outlets within your scope`}
        actions={user.role === "super_admin" ? <SyncOutletsButton /> : undefined}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={Store} label="Total Outlets" value={rows.length} tone="brand" />
        {/* `StatTile.value` bertipe ReactNode, jadi `null` akan merender kartu
            KOSONG tanpa satu kata pun. Kartu kosong menyuruh yang membacanya
            menebak; kalimatnya menyuruhnya menunggu data. */}
        <StatTile icon={ConciergeBell} label="Avg Hospitality" value={avgHosp ?? "Belum ada data"} tone="cyan" />
        <StatTile icon={SprayCan} label="Avg Hygiene" value={avgHyg ?? "Belum ada data"} tone="success" />
        <StatTile icon={MessageSquareWarning} label="Open Complaints" value={openComplaints} tone="warning" />
      </div>

      <div className="mt-4">
        <OutletsExplorer rows={rows} areas={areas} />
      </div>
    </div>
  );
}
