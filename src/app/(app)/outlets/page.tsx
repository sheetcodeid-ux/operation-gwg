import { Store } from "lucide-react";
import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth";
import { areaName, outletRanking, userName } from "@/lib/data/store";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ScoreRing } from "@/components/ui/score-ring";
import { getOutlet } from "@/lib/data/store";

export const metadata: Metadata = { title: "Outlets" };

export default async function OutletsPage() {
  const user = (await getSessionUser())!;
  const rows = outletRanking(user);

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader icon={Store} title="Outlets" description={`${rows.length} outlets within your scope`} />

      <Card>
        <CardHeader>
          <CardTitle>Outlet Directory</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2.5">Outlet</th>
                  <th className="px-3 py-2.5">Area</th>
                  <th className="px-3 py-2.5">Supervisor</th>
                  <th className="px-3 py-2.5 text-center">Hospitality</th>
                  <th className="px-3 py-2.5 text-center">Hygiene</th>
                  <th className="px-3 py-2.5 text-center">Open</th>
                  <th className="px-3 py-2.5 text-center">Score</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const supervisorId = getOutlet(r.outlet.id)?.supervisorId ?? "";
                  return (
                    <tr key={r.outlet.id} className="border-b border-border/60 last:border-0 hover:bg-muted/30">
                      <td className="px-3 py-2.5">
                        <p className="font-medium text-foreground">{r.outlet.name}</p>
                        <p className="text-[11px] text-muted-foreground">{r.outlet.code} · {r.outlet.city}</p>
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">{areaName(r.outlet.areaId)}</td>
                      <td className="px-3 py-2.5 text-foreground/80">{userName(supervisorId)}</td>
                      <td className="px-3 py-2.5 text-center tabular-nums text-foreground">{r.hospitality.toFixed(0)}</td>
                      <td className="px-3 py-2.5 text-center tabular-nums text-foreground">{r.hygiene.toFixed(0)}</td>
                      <td className="px-3 py-2.5 text-center">
                        {r.complaints > 0 ? <Badge tone="warning">{r.complaints}</Badge> : <span className="text-muted-foreground/60">—</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex justify-center">
                          <ScoreRing value={r.composite} size={36} stroke={4} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
