import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth";
import { getOutletDetail, getOutlets } from "@/lib/data/store";
import { nowMs } from "@/lib/now";
import { canAccessOutlet } from "@/lib/rbac";
import { COMPLAINT_STATUS_META, TASK_STATUS_META } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReportBand } from "@/components/reports/report-band";
import { ReportDocument } from "@/components/reports/report-document";
import { formatDate } from "@/lib/utils";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const d = getOutletDetail(id);
  return { title: d ? `${d.outlet.name} — Report` : "Outlet Report" };
}

export default async function OutletReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = (await getSessionUser())!;
  if (!canAccessOutlet(user, id, getOutlets())) redirect("/reports");
  const d = getOutletDetail(id);
  if (!d) notFound();

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <ReportBand
        eyebrow="Laporan Outlet"
        title={d.outlet.name}
        meta={[
          { label: "Kode", value: d.outlet.code },
          { label: "Wilayah", value: d.areaName },
          { label: "Coordinator", value: d.coordinatorName },
          { label: "Tanggal", value: formatDate(new Date(nowMs())) },
        ]}
      />

      <ReportDocument outletIds={[d.outlet.id]} />

      <Card className="print-break">
        <CardHeader>
          <CardTitle>Rincian Tugas</CardTitle>
        </CardHeader>
        <CardContent>
          <ReportTable
            head={["Task", "Priority", "Status", "Progress", "Due Date"]}
            rows={d.tasks.slice(0, 15).map((t) => [
              t.title,
              t.priority,
              <Badge key="s" tone={TASK_STATUS_META[t.status].tone} dot>{TASK_STATUS_META[t.status].label}</Badge>,
              `${t.progress}%`,
              formatDate(t.dueDate),
            ])}
            empty="No tasks"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rincian Komplain</CardTitle>
        </CardHeader>
        <CardContent>
          <ReportTable
            head={["Complaint", "Customer", "Status", "Date"]}
            rows={d.complaints.slice(0, 15).map((c) => [
              c.content,
              c.customerName,
              <Badge key="s" tone={COMPLAINT_STATUS_META[c.status].tone} dot>{COMPLAINT_STATUS_META[c.status].label}</Badge>,
              formatDate(c.createdAt),
            ])}
            empty="No complaints"
          />
        </CardContent>
      </Card>
    </div>
  );
}

function ReportTable({
  head,
  rows,
  empty,
}: {
  head: string[];
  rows: React.ReactNode[][];
  empty: string;
}) {
  if (rows.length === 0) return <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>;
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[36rem] text-sm">
        <thead>
          <tr className="whitespace-nowrap border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
            {head.map((h) => (
              <th key={h} className="px-3 py-2.5">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, i) => (
            <tr key={i} className="border-b border-border/60 last:border-0">
              {cells.map((c, j) => (
                <td key={j} className="px-3 py-2.5 text-foreground/90">{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
