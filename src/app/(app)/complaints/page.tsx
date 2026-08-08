import { CircleCheckBig, Inbox, MessageSquareWarning, Percent } from "lucide-react";
import type { Metadata } from "next";
import { requireSessionUser } from "@/lib/auth";
import { listComplaints, outletName, visibleOutlets } from "@/lib/data/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatTile } from "@/components/ui/stat";
import { NewComplaintButton } from "@/components/complaints/new-complaint";
import { ComplaintTable, type ComplaintRow } from "@/components/complaints/complaint-table";
import { getT } from "@/lib/i18n/server";
import {
  canApproveComplaint,
  canForwardComplaint,
  canInputComplaint,
  canResolveComplaint,
  complaintStage,
} from "@/lib/complaints-access";

export const metadata: Metadata = { title: "Complaint Management" };

export default async function ComplaintsPage() {
  const t = await getT();
  const user = await requireSessionUser();
  const complaints = listComplaints(user);
  const outlets = visibleOutlets(user).map((o) => ({ id: o.id, name: o.name }));
  // Alur komplain: MarComm/Admin memasukkan → Coordinator Area meneruskan ke
  // supervisor → supervisor memperbaiki → Coordinator Area menilai → selesai.
  // Tiap peran hanya melihat aksinya sendiri; sisanya memantau.
  const canCreate = canInputComplaint(user);
  const canResolve = canResolveComplaint(user);
  const canApprove = canApproveComplaint(user);
  const canForward = canForwardComplaint(user);

  const closed = complaints.filter((c) => c.status === "close").length;
  const open = complaints.length - closed;
  const resolutionRate = complaints.length ? Math.round((closed / complaints.length) * 100) : 0;

  const rows: ComplaintRow[] = complaints.map((c) => ({
    id: c.id,
    source: c.source,
    customerName: c.customerName,
    content: c.content,
    outlet: outletName(c.outletId),
    category: c.category,
    status: c.status,
    rootCause: c.rootCause ?? null,
    rating: c.rating ?? null,
    createdAt: c.createdAt,
    correctiveAction: c.correctiveAction
      ? { description: c.correctiveAction.description, followUpDate: c.correctiveAction.followUpDate ?? null }
      : null,
    approval: c.approval ?? null,
    assignment: c.assignment ?? null,
    stage: complaintStage(c),
    outletId: c.outletId,
    /** Komplain ini ditugaskan kepada saya — dipakai menandai "tugas saya". */
    mine: c.assignment?.assignedTo === user.id,
  }));

  // Yang menuntut tindakan: belum diteruskan (bagi CA) atau ditugaskan ke saya
  // dan belum dikirim (bagi supervisor). Angka inilah yang membuat komplain
  // tidak menggantung tanpa ada yang merasa bertanggung jawab.
  const perluDiteruskan = rows.filter((r) => r.stage === "baru").length;
  const tugasSaya = rows.filter((r) => r.mine && r.stage === "dikerjakan").length;

  return (
    <div className="w-full">
      <PageHeader
        icon={MessageSquareWarning}
        title={t("complaint.title")}
        description={t("complaint.description")}
        actions={canCreate && outlets.length > 0 ? <NewComplaintButton outlets={outlets} /> : undefined}
      />

      {/* Yang menuntut tindakan orang ini, sebelum angka apa pun — komplain yang
          menggantung karena tidak ada yang merasa ditugaskan adalah kegagalan
          paling sering pada alur seperti ini. */}
      {canForward && perluDiteruskan > 0 && (
        <div className="mb-3 flex items-start gap-2 rounded-xl border border-red-500/40 bg-red-500/5 p-3 text-[13px] leading-relaxed text-red-700 dark:text-red-300">
          <MessageSquareWarning className="mt-px size-4 shrink-0" />
          <p>
            <strong>{perluDiteruskan} komplain</strong> belum diteruskan ke supervisor. Buka barisnya lalu tekan{" "}
            <strong>Teruskan</strong> untuk menugaskan perbaikannya.
          </p>
        </div>
      )}
      {canResolve && tugasSaya > 0 && (
        <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/5 p-3 text-[13px] leading-relaxed text-amber-700 dark:text-amber-300">
          <MessageSquareWarning className="mt-px size-4 shrink-0" />
          <p>
            <strong>{tugasSaya} komplain</strong> diteruskan kepada Anda dan menunggu perbaikan.
          </p>
        </div>
      )}

      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [&>*]:min-w-[72%] [&>*]:shrink-0 [&>*]:snap-start sm:grid sm:grid-cols-2 sm:overflow-visible sm:[&>*]:min-w-0 lg:grid-cols-4">
        <StatTile icon={Inbox} label={t("complaint.total")} value={complaints.length} tone="brand" />
        <StatTile icon={MessageSquareWarning} label={t("complaint.open")} value={open} tone="warning" />
        <StatTile icon={CircleCheckBig} label={t("complaint.closed")} value={closed} tone="success" />
        <StatTile icon={Percent} label={t("complaint.resolution")} value={`${resolutionRate}%`} tone="cyan" />
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>{t("complaint.all")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ComplaintTable rows={rows} canResolve={canResolve} canApprove={canApprove} canForward={canForward} />
        </CardContent>
      </Card>
    </div>
  );
}
