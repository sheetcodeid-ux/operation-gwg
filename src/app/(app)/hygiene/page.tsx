import { CircleCheck, ClipboardCheck, SprayCan, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth";
import { areaName, listHygiene, outletName, visibleOutlets } from "@/lib/data/store";
import { can } from "@/lib/rbac";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/page-header";
import { ScoreRing } from "@/components/ui/score-ring";
import { StatTile } from "@/components/ui/stat";
import { NewAuditButton } from "@/components/hygiene/hygiene-form";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Hygiene Monitoring" };

export default async function HygienePage() {
  const user = (await getSessionUser())!;
  const audits = listHygiene(user);
  const outlets = visibleOutlets(user).map((o) => ({ id: o.id, name: o.name }));
  const canCreate = can(user, "create_hygiene");

  const avg = audits.length
    ? Math.round((audits.reduce((a, b) => a + b.hygieneScore, 0) / audits.length) * 10) / 10
    : 0;
  const cleanRate = audits.length ? Math.round((audits.filter((a) => a.isClean).length / audits.length) * 100) : 0;
  const openFindings = audits.reduce((a, b) => a + b.findings.length, 0);

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        icon={SprayCan}
        title="Hygiene Monitoring"
        description="Six-section cleanliness audits with auto-generated hygiene scores"
        actions={canCreate && outlets.length > 0 ? <NewAuditButton outlets={outlets} /> : undefined}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={SprayCan} label="Average Score" value={avg.toFixed(1)} tone="brand" />
        <StatTile icon={ClipboardCheck} label="Audits" value={audits.length} tone="cyan" />
        <StatTile icon={CircleCheck} label="Clean Rate" value={`${cleanRate}%`} tone="success" />
        <StatTile icon={TriangleAlert} label="Open Findings" value={openFindings} tone="amber" />
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Recent Audits</CardTitle>
          <CardDescription>Latest inspections across your outlets</CardDescription>
        </CardHeader>
        <CardContent>
          {audits.length === 0 ? (
            <EmptyState
              icon={SprayCan}
              title="No audits recorded"
              description={canCreate ? "Run your first hygiene audit to generate a score." : "Hygiene audits will appear here."}
            />
          ) : (
            <div className="space-y-1">
              {audits.slice(0, 20).map((a) => (
                <div key={a.id} className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-muted/40">
                  <ScoreRing value={a.hygieneScore} size={44} stroke={5} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{outletName(a.outletId)}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {areaName(a.areaId)} · {a.shift} shift · {a.inspectorName} · {formatDate(a.date)}
                    </p>
                    {a.findings.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {a.findings.slice(0, 3).map((f, i) => (
                          <span key={i} className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-200/90">
                            {f}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <Badge tone={a.isClean ? "success" : "danger"} dot>
                    {a.isClean ? "Clean" : "Attention"}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
