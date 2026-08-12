import { CircleCheck, ClipboardCheck, SprayCan, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import { requireSessionUser } from "@/lib/auth";
import { hygienePhotosByAudit } from "@/lib/data/hygiene-photos";
import { listHygiene, outletCoordinatorName, outletName, visibleOutlets } from "@/lib/data/store";
import { can } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { StatTile } from "@/components/ui/stat";
import { NewAuditButton } from "@/components/hygiene/hygiene-form";
import { HygieneExplorer, type HygieneRow } from "@/components/hygiene/hygiene-explorer";
import { getT } from "@/lib/i18n/server";
import { monthKey, monthKeyLabel, monthOptions } from "@/lib/month";
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

export default async function HygienePage({ searchParams }: { searchParams: Promise<{ bulan?: string }> }) {
  const t = await getT();
  const user = await requireSessionUser();
  const all = listHygiene(user);
  const outlets = visibleOutlets(user).map((o) => ({ id: o.id, name: o.name }));
  const canCreate = can(user, "create_hygiene");

  /**
   * Dibatasi PER BULAN di server, bukan di browser.
   *
   * Audit masuk ~60 per hari, jadi memuat seluruh riwayat berarti mengambil
   * foto dan menandatangani URL untuk ribuan audit setiap kali halaman dibuka —
   * beban yang terus bertambah tiap hari. Filternya tetap terlihat dan ada opsi
   * "Semua Bulan", jadi tidak ada data yang disembunyikan diam-diam.
   */
  const months = monthOptions(all.map((a) => a.date));
  const sp = await searchParams;
  const valid = sp.bulan === "all" || months.some((m) => m.value === sp.bulan);
  const month = valid && sp.bulan ? sp.bulan : (months[0]?.value ?? "all");
  const audits = month === "all" ? all : all.filter((a) => monthKey(a.date) === month);

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
      findingList: a.findings,
      photos: await resolvePhotos(photosById.get(a.id) ?? a.photos),
      ratings: a.ratings,
      supervisor: a.supervisorName,
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
        // Statistik di bawah dihitung untuk periode yang sedang dibuka, jadi
        // periodenya disebut supaya angkanya tidak terbaca sebagai sepanjang masa.
        description={`${t("hygiene.description")} — ${month === "all" ? "semua periode" : monthKeyLabel(month)}`}
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
        <HygieneExplorer
          rows={rows}
          outlets={outlets}
          canFollowup={user.role !== "supervisor"}
          months={months}
          month={month}
          canDelete={user.role === "super_admin"}
          showOutletFilter={user.role !== "supervisor"}
        />
      </div>
    </div>
  );
}
