import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronRight, FileText, MapPinned, Store, UserCog } from "lucide-react";
import type { Metadata } from "next";
import { requireSessionUser } from "@/lib/auth";
import { areaReportRows, coordinatorReportRows, outletReportRows, rataAudit } from "@/lib/data/store";
import { can } from "@/lib/rbac";
import { hasMenuGrant } from "@/lib/nav";
import { ROLE_LABEL } from "@/lib/constants";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ScoreRing } from "@/components/ui/score-ring";
import { StatTile } from "@/components/ui/stat";
import { ReportsOutletTable, type ReportOutletRow } from "@/components/reports/reports-outlet-table";

export const metadata: Metadata = { title: "Reports" };

const TAK_ADA = "Belum ada data";

/** Cincin mutu gabungan, atau kalimat bila belum ada satu pun audit. */
function CincinMutu({ v }: { v: number | null }) {
  if (v === null) {
    return (
      <div className="grid size-11 shrink-0 place-items-center rounded-full border border-dashed border-border px-1 text-center">
        <span className="text-[8px] leading-tight text-muted-foreground/80">{TAK_ADA}</span>
      </div>
    );
  }
  return <ScoreRing value={Math.round(v)} size={44} stroke={5} />;
}

export default async function ReportsPage() {
  const user = await requireSessionUser();
  // Role permission OR an explicit per-user grant (incl. custom divisions).
  if (!can(user, "view_reports") && !hasMenuGrant(user.grants, "reports")) redirect("/dashboard");

  const outlets = outletReportRows(user);
  const coordinators = coordinatorReportRows(user);
  const areas = areaReportRows(user);

  const outletRows: ReportOutletRow[] = outlets.map((o) => ({
    id: o.outlet.id,
    name: o.outlet.name,
    code: o.outlet.code,
    areaId: o.outlet.areaId,
    area: o.areaName,
    hospitality: o.hospitality,
    hygiene: o.hygiene,
  }));
  const areaOptions = areas.map((a) => ({ id: a.area.id, name: a.area.name }));
  // Mutu satu outlet = rata-rata skor yang ADA padanya; outlet tanpa audit sama
  // sekali tidak ikut menarik rata-rata perusahaan turun, karena yang belum
  // diperiksa bukan yang buruk.
  const mutu = (hosp: number | null, hyg: number | null) => rataAudit([hosp, hyg]);
  const avgQuality = rataAudit(outlets.map((o) => mutu(o.hospitality, o.hygiene)));

  return (
    <div className="w-full">
      <PageHeader
        icon={FileText}
        title="Reports"
        description="Summary reports per outlet, area coordinator, and region — printable to PDF"
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={Store} label="Outlets" value={outlets.length} tone="brand" />
        <StatTile icon={MapPinned} label="Regions" value={areas.length} tone="cyan" />
        <StatTile icon={UserCog} label="Coordinators" value={coordinators.length} tone="amber" />
        <StatTile icon={FileText} label="Avg Quality" value={avgQuality ?? TAK_ADA} tone="success" />
      </div>

      {/* Areas (Wilayah) */}
      <Card className="mt-4">
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
                <CincinMutu v={mutu(a.agg.hospitality, a.agg.hygiene)} />
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
                <CincinMutu v={mutu(c.agg.hospitality, c.agg.hygiene)} />
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
          <ReportsOutletTable rows={outletRows} areas={areaOptions} />
        </CardContent>
      </Card>
    </div>
  );
}
