import { MessageSquareWarning, Store } from "lucide-react";
import { ConciergeBell, SprayCan } from "lucide-react";
import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth";
import { areaName, getAreas, getOutlet, outletRanking, userName } from "@/lib/data/store";
import { PageHeader } from "@/components/ui/page-header";
import { StatTile } from "@/components/ui/stat";
import { OutletsExplorer, type OutletRow } from "@/components/outlets/outlets-explorer";
import { SyncOutletsButton } from "@/components/outlets/sync-outlets";

export const metadata: Metadata = { title: "Outlets" };

export default async function OutletsPage() {
  const user = (await getSessionUser())!;
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

  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);
  const avgHosp = avg(rows.map((r) => r.hospitality));
  const avgHyg = avg(rows.map((r) => r.hygiene));
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
        <StatTile icon={ConciergeBell} label="Avg Hospitality" value={avgHosp} tone="cyan" />
        <StatTile icon={SprayCan} label="Avg Hygiene" value={avgHyg} tone="success" />
        <StatTile icon={MessageSquareWarning} label="Open Complaints" value={openComplaints} tone="warning" />
      </div>

      <div className="mt-4">
        <OutletsExplorer rows={rows} areas={areas} />
      </div>
    </div>
  );
}
