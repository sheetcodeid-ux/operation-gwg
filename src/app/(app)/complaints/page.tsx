import { CircleCheckBig, Inbox, MessageSquareWarning, Percent } from "lucide-react";
import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth";
import {
  complaintTrend,
  complaintsByCategory,
  listComplaints,
  outletName,
  visibleOutlets,
} from "@/lib/data/store";
import { can } from "@/lib/rbac";
import {
  COMPLAINT_CATEGORY_META,
  COMPLAINT_SOURCE_META,
  type Tone,
} from "@/lib/constants";
import type { ComplaintSource } from "@/lib/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatTile } from "@/components/ui/stat";
import { TONE_HEX } from "@/components/ui/tone";
import { CategoryBarChart, DonutChart, TrendAreaChart } from "@/components/charts/charts";
import { NewComplaintButton } from "@/components/complaints/new-complaint";
import { ComplaintTable, type ComplaintRow } from "@/components/complaints/complaint-table";

export const metadata: Metadata = { title: "Complaint Management" };

export default async function ComplaintsPage() {
  const user = (await getSessionUser())!;
  const complaints = listComplaints(user);
  const outlets = visibleOutlets(user).map((o) => ({ id: o.id, name: o.name }));
  const canManage = can(user, "manage_complaint");

  const closed = complaints.filter((c) => c.status === "closed" || c.status === "done").length;
  const open = complaints.length - closed;
  const resolutionRate = complaints.length ? Math.round((closed / complaints.length) * 100) : 0;

  const trend = complaintTrend(user);

  const catCounts = complaintsByCategory(user);
  const byCategory = [...catCounts.entries()]
    .map(([k, v]) => ({ label: COMPLAINT_CATEGORY_META[k as keyof typeof COMPLAINT_CATEGORY_META]?.label ?? k, value: v }))
    .sort((a, b) => b.value - a.value);

  const sourceCounts = new Map<ComplaintSource, number>();
  for (const c of complaints) sourceCounts.set(c.source, (sourceCounts.get(c.source) ?? 0) + 1);
  const bySource = [...sourceCounts.entries()].map(([k, v]) => ({
    label: COMPLAINT_SOURCE_META[k].label,
    value: v,
    color: TONE_HEX[COMPLAINT_SOURCE_META[k].tone as Tone],
  }));

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
    <div className="mx-auto max-w-7xl">
      <PageHeader
        icon={MessageSquareWarning}
        title="Complaint Management"
        description="Structured handling across all channels with root-cause analysis"
        actions={canManage && outlets.length > 0 ? <NewComplaintButton outlets={outlets} /> : undefined}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={Inbox} label="Total Complaints" value={complaints.length} tone="brand" />
        <StatTile icon={MessageSquareWarning} label="Open" value={open} tone="warning" />
        <StatTile icon={CircleCheckBig} label="Closed" value={closed} tone="success" />
        <StatTile icon={Percent} label="Resolution Rate" value={`${resolutionRate}%`} tone="cyan" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Complaint Trend</CardTitle>
            <CardDescription>Received vs. resolved · last 8 weeks</CardDescription>
          </CardHeader>
          <CardContent>
            <TrendAreaChart data={trend} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>By Source</CardTitle>
            <CardDescription>Channel distribution</CardDescription>
          </CardHeader>
          <CardContent>
            {bySource.length > 0 ? (
              <DonutChart data={bySource} />
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">No data</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>By Category</CardTitle>
          <CardDescription>Where complaints concentrate</CardDescription>
        </CardHeader>
        <CardContent>
          {byCategory.length > 0 ? (
            <CategoryBarChart data={byCategory} color={TONE_HEX.brand} />
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">No data</p>
          )}
        </CardContent>
      </Card>

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
