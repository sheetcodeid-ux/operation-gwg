import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth";
import { coordinatorReportRows } from "@/lib/data/store";
import { can } from "@/lib/rbac";
import { ROLE_LABEL } from "@/lib/constants";
import { ReportBand } from "@/components/reports/report-band";
import { ReportDocument } from "@/components/reports/report-document";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Coordinator Report" };

export default async function CoordinatorReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = (await getSessionUser())!;
  if (!can(user, "view_reports")) redirect("/dashboard");
  const row = coordinatorReportRows(user).find((r) => r.coordinator.id === id);
  if (!row) redirect("/reports");

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <ReportBand
        eyebrow="Laporan Area Coordinator"
        title={row.coordinator.name}
        meta={[
          { label: "Role", value: ROLE_LABEL.area_coordinator },
          { label: "Outlets", value: String(row.outletIds.length) },
          { label: "Tanggal", value: formatDate(new Date()) },
        ]}
      />
      <ReportDocument outletIds={row.outletIds} />
    </div>
  );
}
