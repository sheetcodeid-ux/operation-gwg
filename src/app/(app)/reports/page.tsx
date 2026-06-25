import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronRight, FileText, MapPinned, Store, UserCog } from "lucide-react";
import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth";
import { areaReportRows, coordinatorReportRows, outletReportRows } from "@/lib/data/store";
import { can } from "@/lib/rbac";
import { ROLE_LABEL } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ScoreRing } from "@/components/ui/score-ring";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage() {
  const user = (await getSessionUser())!;
  if (!can(user, "view_reports")) redirect("/dashboard");

  const outlets = outletReportRows(user);
  const coordinators = coordinatorReportRows(user);
  const areas = areaReportRows(user);

  return (
    <div className="w-full">
      <PageHeader
        icon={FileText}
        title="Reports"
        description="Summary reports per outlet, area coordinator, and region — printable to PDF"
      />

      {/* Areas (Wilayah) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPinned className="size-4 text-muted-foreground" /> By Region (Wilayah)
          </CardTitle>
          <CardDescription>{areas.length} areas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {areas.map((a) => (
              <Link
                key={a.area.id}
                href={`/reports/area/${a.area.id}`}
                className="group flex items-center gap-3 rounded-xl border border-border bg-muted/20 p-3 transition-colors hover:border-primary/40 hover:bg-muted/40"
              >
                <ScoreRing value={Math.round((a.agg.hospitality + a.agg.hygiene) / 2)} size={44} stroke={5} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{a.area.name}</p>
                  <p className="text-[11px] text-muted-foreground">{a.agg.outlets} outlets · {a.agg.complaintsOpen} open</p>
                </div>
                <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Coordinators (CA) */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCog className="size-4 text-muted-foreground" /> By Area Coordinator (CA)
          </CardTitle>
          <CardDescription>{coordinators.length} coordinators</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {coordinators.map((c) => (
              <Link
                key={c.coordinator.id}
                href={`/reports/ca/${c.coordinator.id}`}
                className="group flex items-center gap-3 rounded-xl border border-border bg-muted/20 p-3 transition-colors hover:border-primary/40 hover:bg-muted/40"
              >
                <ScoreRing value={Math.round((c.agg.hospitality + c.agg.hygiene) / 2)} size={44} stroke={5} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{c.coordinator.name}</p>
                  <p className="text-[11px] text-muted-foreground">{ROLE_LABEL.area_coordinator} · {c.agg.outlets} outlets</p>
                </div>
                <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Outlets */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="size-4 text-muted-foreground" /> By Outlet
          </CardTitle>
          <CardDescription>{outlets.length} outlets</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2.5">Outlet</th>
                  <th className="px-3 py-2.5">Region</th>
                  <th className="px-3 py-2.5 text-center">Hospitality</th>
                  <th className="px-3 py-2.5 text-center">Hygiene</th>
                  <th className="px-3 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {outlets.map((o) => (
                  <tr key={o.outlet.id} className="border-b border-border/60 last:border-0 hover:bg-muted/30">
                    <td className="px-3 py-2.5">
                      <Link href={`/reports/outlet/${o.outlet.id}`} className="font-medium text-foreground hover:text-primary hover:underline">
                        {o.outlet.name}
                      </Link>
                      <p className="text-[11px] text-muted-foreground">{o.outlet.code}</p>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">{o.areaName}</td>
                    <td className="px-3 py-2.5 text-center tabular-nums text-foreground">{o.hospitality.toFixed(0)}</td>
                    <td className="px-3 py-2.5 text-center tabular-nums text-foreground">{o.hygiene.toFixed(0)}</td>
                    <td className="px-3 py-2.5 text-right">
                      <Link href={`/reports/outlet/${o.outlet.id}`}>
                        <Badge tone="brand">Report</Badge>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
