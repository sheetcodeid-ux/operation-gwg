import { redirect } from "next/navigation";
import { CalendarRange, ConciergeBell, ListChecks, MessageSquareWarning, ScrollText, SprayCan } from "lucide-react";
import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth";
import { listComplaints, listEvents, listHospitality, listHygiene, listTasks, outletName } from "@/lib/data/store";
import { can } from "@/lib/rbac";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { fromNow } from "@/lib/utils";

export const metadata: Metadata = { title: "Audit Logs" };

interface Activity {
  at: string;
  icon: typeof ScrollText;
  text: string;
  outlet: string;
}

export default async function AuditPage() {
  const user = (await getSessionUser())!;
  if (!can(user, "view_audit_logs")) redirect("/dashboard");

  const events: Activity[] = [
    ...listHospitality(user).map((h) => ({
      at: h.date,
      icon: ConciergeBell,
      text: `Hospitality assessment for ${h.staffName} scored ${h.overallScore.toFixed(1)}`,
      outlet: outletName(h.outletId),
    })),
    ...listHygiene(user).map((h) => ({
      at: h.date,
      icon: SprayCan,
      text: `Hygiene audit recorded · score ${h.hygieneScore.toFixed(1)}`,
      outlet: outletName(h.outletId),
    })),
    ...listTasks(user).map((t) => ({
      at: t.createdAt,
      icon: ListChecks,
      text: `Task "${t.title}" set to ${t.status}`,
      outlet: outletName(t.outletId),
    })),
    ...listComplaints(user).map((c) => ({
      at: c.createdAt,
      icon: MessageSquareWarning,
      text: `Complaint logged via ${c.source.replace("_", " ")}`,
      outlet: outletName(c.outletId),
    })),
    ...listEvents(user).map((e) => ({
      at: e.createdAt,
      icon: CalendarRange,
      text: `Event "${e.name}" · ${e.status}`,
      outlet: outletName(e.outletId),
    })),
  ]
    .sort((a, b) => +new Date(b.at) - +new Date(a.at))
    .slice(0, 40);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader icon={ScrollText} title="Audit Logs" description="Recent operational activity across your scope" />

      <Card>
        <CardHeader>
          <CardTitle>Activity Feed</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative space-y-1 pl-2">
            {events.map((a, i) => {
              const Icon = a.icon;
              return (
                <div key={i} className="flex gap-3 rounded-xl px-2 py-2 hover:bg-muted/40">
                  <div className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-muted/50 ring-1 ring-border">
                    <Icon className="size-4 text-foreground/80" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground">{a.text}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {a.outlet} · {fromNow(a.at)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
