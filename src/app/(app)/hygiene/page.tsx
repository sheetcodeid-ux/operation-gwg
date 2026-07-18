import { CircleCheck, ClipboardCheck, SprayCan, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth";
import { areaName, listHygiene, outletName, visibleOutlets } from "@/lib/data/store";
import { can } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { StatTile } from "@/components/ui/stat";
import { NewAuditButton } from "@/components/hygiene/hygiene-form";
import { HygieneExplorer, type HygieneRow } from "@/components/hygiene/hygiene-explorer";

export const metadata: Metadata = { title: "Hygiene Monitoring" };

export default async function HygienePage() {
  const user = (await getSessionUser())!;
  const audits = listHygiene(user);
  const outlets = visibleOutlets(user).map((o) => ({ id: o.id, name: o.name }));
  const canCreate = can(user, "create_hygiene");

  const rows: HygieneRow[] = audits.map((a) => ({
    id: a.id,
    outletId: a.outletId,
    outlet: outletName(a.outletId),
    areaId: a.areaId,
    area: areaName(a.areaId),
    shift: a.shift,
    inspector: a.inspectorName,
    date: a.date,
    score: a.hygieneScore,
    isClean: a.isClean,
    findings: a.findings.length,
    photos: a.photos,
  }));

  const avg = audits.length
    ? Math.round((audits.reduce((a, b) => a + b.hygieneScore, 0) / audits.length) * 10) / 10
    : 0;
  const cleanRate = audits.length ? Math.round((audits.filter((a) => a.isClean).length / audits.length) * 100) : 0;
  const openFindings = audits.reduce((a, b) => a + b.findings.length, 0);

  return (
    <div className="w-full">
      <PageHeader
        icon={SprayCan}
        title="Hygiene Monitoring"
        description="Six-section cleanliness audits with auto-generated hygiene scores"
        actions={canCreate && outlets.length > 0 ? <NewAuditButton outlets={outlets} /> : undefined}
      />

      {canCreate && outlets.length === 0 && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <span>Belum ada outlet yang ditugaskan ke akun Anda, jadi audit belum bisa dibuat. Minta Admin menugaskan outlet Anda di <span className="font-semibold">User Management</span> (Edit akun → pilih Outlet).</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={SprayCan} label="Average Score" value={avg.toFixed(1)} tone="brand" />
        <StatTile icon={ClipboardCheck} label="Audits" value={audits.length} tone="cyan" />
        <StatTile icon={CircleCheck} label="Clean Rate" value={`${cleanRate}%`} tone="success" />
        <StatTile icon={TriangleAlert} label="Open Findings" value={openFindings} tone="amber" />
      </div>

      <div className="mt-4">
        <HygieneExplorer rows={rows} outlets={outlets} />
      </div>
    </div>
  );
}
