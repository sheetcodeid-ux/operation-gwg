import { CircleCheck, ClipboardCheck, SprayCan, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth";
import { hygienePhotosByAudit } from "@/lib/data/hygiene-photos";
import { listHygiene, outletCoordinatorName, outletName, visibleOutlets } from "@/lib/data/store";
import { can } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { StatTile } from "@/components/ui/stat";
import { NewAuditButton } from "@/components/hygiene/hygiene-form";
import { HygieneExplorer, type HygieneRow } from "@/components/hygiene/hygiene-explorer";
import { getT } from "@/lib/i18n/server";
import { isR2Key, presignGet, r2Enabled, r2KeyOf } from "@/lib/storage/r2";
import type { Attachment } from "@/lib/types";

/** Turn stored R2 keys into short-lived viewable URLs (bucket stays private). */
async function resolvePhotos(photos: Attachment[]): Promise<Attachment[]> {
  if (!r2Enabled() || !photos.some((p) => isR2Key(p.id))) return photos;
  return Promise.all(
    photos.map(async (p) => (isR2Key(p.id) ? { ...p, url: await presignGet(r2KeyOf(p.id)) } : p)),
  );
}

export const metadata: Metadata = { title: "Hygiene Monitoring" };

export default async function HygienePage() {
  const t = await getT();
  const user = (await getSessionUser())!;
  const audits = listHygiene(user);
  const outlets = visibleOutlets(user).map((o) => ({ id: o.id, name: o.name }));
  const canCreate = can(user, "create_hygiene");

  // Photos are the heaviest column in `hygiene` and are only rendered here, so
  // they are left out of the shared in-memory cache and fetched per page.
  const photosById = await hygienePhotosByAudit(audits.map((a) => a.id));

  const rows: HygieneRow[] = await Promise.all(
    audits.map(async (a) => ({
      id: a.id,
      outletId: a.outletId,
      outlet: outletName(a.outletId),
      areaId: a.areaId,
      area: outletCoordinatorName(a.outletId),
      shift: a.shift,
      inspector: a.inspectorName,
      date: a.date,
      score: a.hygieneScore,
      isClean: a.isClean,
      findings: a.findings.length,
      photos: await resolvePhotos(photosById.get(a.id) ?? a.photos),
    })),
  );

  const avg = audits.length
    ? Math.round((audits.reduce((a, b) => a + b.hygieneScore, 0) / audits.length) * 10) / 10
    : 0;
  const cleanRate = audits.length ? Math.round((audits.filter((a) => a.isClean).length / audits.length) * 100) : 0;
  const openFindings = audits.reduce((a, b) => a + b.findings.length, 0);

  return (
    <div className="w-full">
      <PageHeader
        icon={SprayCan}
        title={t("hygiene.title")}
        description={t("hygiene.description")}
        actions={canCreate && outlets.length > 0 ? <NewAuditButton outlets={outlets} /> : undefined}
      />

      {canCreate && outlets.length === 0 && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <span>{t("hygiene.noOutlet")}</span>
        </div>
      )}

      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [&>*]:min-w-[72%] [&>*]:shrink-0 [&>*]:snap-start sm:grid sm:grid-cols-2 sm:overflow-visible sm:[&>*]:min-w-0 lg:grid-cols-4">
        <StatTile icon={SprayCan} label={t("hygiene.avgScore")} value={avg.toFixed(1)} tone="brand" />
        <StatTile icon={ClipboardCheck} label={t("hygiene.audits")} value={audits.length} tone="cyan" />
        <StatTile icon={CircleCheck} label={t("hygiene.cleanRate")} value={`${cleanRate}%`} tone="success" />
        <StatTile icon={TriangleAlert} label={t("hygiene.openFindings")} value={openFindings} tone="amber" />
      </div>

      <div className="mt-4">
        <HygieneExplorer rows={rows} outlets={outlets} canDelete={user.role === "super_admin"} showOutletFilter={user.role !== "supervisor"} />
      </div>
    </div>
  );
}
