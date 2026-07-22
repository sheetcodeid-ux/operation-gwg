import { CircleCheckBig, Inbox, MessageSquareWarning, Percent } from "lucide-react";
import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth";
import { listComplaints, outletName, visibleOutlets } from "@/lib/data/store";
import { can } from "@/lib/rbac";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatTile } from "@/components/ui/stat";
import { NewComplaintButton } from "@/components/complaints/new-complaint";
import { ComplaintTable, type ComplaintRow } from "@/components/complaints/complaint-table";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Complaint Management" };

export default async function ComplaintsPage() {
  const t = await getT();
  const user = (await getSessionUser())!;
  const complaints = listComplaints(user);
  const outlets = visibleOutlets(user).map((o) => ({ id: o.id, name: o.name }));
  const canManage = can(user, "manage_complaint");

  const closed = complaints.filter((c) => c.status === "closed" || c.status === "done").length;
  const open = complaints.length - closed;
  const resolutionRate = complaints.length ? Math.round((closed / complaints.length) * 100) : 0;

  const rows: ComplaintRow[] = complaints.map((c) => ({
    id: c.id,
    source: c.source,
    customerName: c.customerName,
    content: c.content,
    outlet: outletName(c.outletId),
    category: c.category,
    priority: c.priority,
    status: c.status,
    rootCause: c.rootCause ?? null,
    rating: c.rating ?? null,
    createdAt: c.createdAt,
  }));

  return (
    <div className="w-full">
      <PageHeader
        icon={MessageSquareWarning}
        title={t("complaint.title")}
        description={t("complaint.description")}
        actions={canManage && outlets.length > 0 ? <NewComplaintButton outlets={outlets} /> : undefined}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={Inbox} label={t("complaint.total")} value={complaints.length} tone="brand" />
        <StatTile icon={MessageSquareWarning} label={t("complaint.open")} value={open} tone="warning" />
        <StatTile icon={CircleCheckBig} label={t("complaint.closed")} value={closed} tone="success" />
        <StatTile icon={Percent} label={t("complaint.resolution")} value={`${resolutionRate}%`} tone="cyan" />
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>All Complaints</CardTitle>
        </CardHeader>
        <CardContent>
          <ComplaintTable rows={rows} canManage={canManage} />
        </CardContent>
      </Card>
    </div>
  );
}
