import { redirect } from "next/navigation";
import { ConciergeBell, ListChecks, MessageSquareWarning, ScrollText, SprayCan } from "lucide-react";
import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth";
import { listComplaints, listEvents, listHospitality, listHygiene, listTasks, outletName } from "@/lib/data/store";
import { can } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { StatTile } from "@/components/ui/stat";
import { AuditFeed, type AuditItem } from "@/components/admin/audit-feed";

export const metadata: Metadata = { title: "Audit Logs" };

export default async function AuditPage() {
  const user = (await getSessionUser())!;
  if (!can(user, "view_audit_logs")) redirect("/dashboard");

  const hosp = listHospitality(user);
  const hyg = listHygiene(user);
  const tasks = listTasks(user);
  const complaints = listComplaints(user);
  const evts = listEvents(user);

  const items: AuditItem[] = [
    ...hosp.map((h) => ({
      at: h.date,
      type: "hospitality" as const,
      text: `Hospitality assessment for ${h.staffName} scored ${h.overallScore.toFixed(1)}`,
      outlet: outletName(h.outletId),
    })),
    ...hyg.map((h) => ({
      at: h.date,
      type: "hygiene" as const,
      text: `Hygiene audit recorded · score ${h.hygieneScore.toFixed(1)}`,
      outlet: outletName(h.outletId),
    })),
    ...tasks.map((t) => ({
      at: t.createdAt,
      type: "task" as const,
      text: `Task "${t.title}" set to ${t.status}`,
      outlet: t.outletId ? outletName(t.outletId) : "No branch",
    })),
    ...complaints.map((c) => ({
      at: c.createdAt,
      type: "complaint" as const,
      text: `Complaint logged via ${c.source.replace("_", " ")}`,
      outlet: outletName(c.outletId),
    })),
    ...evts.map((e) => ({
      at: e.createdAt,
      type: "event" as const,
      text: `Event "${e.name}" · ${e.status}`,
      outlet: outletName(e.outletId),
    })),
  ].sort((a, b) => +new Date(b.at) - +new Date(a.at));

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader icon={ScrollText} title="Audit Logs" description="Recent operational activity across your scope" />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={ConciergeBell} label="Assessments" value={hosp.length} tone="brand" />
        <StatTile icon={SprayCan} label="Hygiene Audits" value={hyg.length} tone="success" />
        <StatTile icon={ListChecks} label="Tasks" value={tasks.length} tone="cyan" />
        <StatTile icon={MessageSquareWarning} label="Complaints" value={complaints.length} tone="amber" />
      </div>

      <div className="mt-4">
        <AuditFeed items={items.slice(0, 80)} />
      </div>
    </div>
  );
}
