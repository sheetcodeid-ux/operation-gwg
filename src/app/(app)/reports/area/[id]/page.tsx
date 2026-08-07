import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { requireSessionUser } from "@/lib/auth";
import { areaReportRows, userName } from "@/lib/data/store";
import { nowMs } from "@/lib/now";
import { can } from "@/lib/rbac";
import { ReportBand } from "@/components/reports/report-band";
import { ReportDocument } from "@/components/reports/report-document";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Region Report" };

export default async function AreaReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireSessionUser();
  if (!can(user, "view_reports")) redirect("/dashboard");
  const row = areaReportRows(user).find((r) => r.area.id === id);
  if (!row) redirect("/reports");

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <ReportBand
        eyebrow="Laporan Wilayah"
        title={row.area.name}
        meta={[
          { label: "Kode", value: row.area.code },
          { label: "Coordinator", value: userName(row.area.coordinatorId) },
          { label: "Outlets", value: String(row.outletIds.length) },
          { label: "Tanggal", value: formatDate(new Date(nowMs())) },
        ]}
      />
      <ReportDocument outletIds={row.outletIds} />
    </div>
  );
}
