"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { CheckCircle2, ClipboardCheck, Eye, ImagePlus, Loader2, Star, Undo2, X } from "lucide-react";
import { toast } from "sonner";
import {
  COMPLAINT_CATEGORY_META,
  COMPLAINT_SOURCE_META,
  COMPLAINT_STATUS_META,
  ROOT_CAUSE_META,
} from "@/lib/constants";
import type {
  ComplaintApproval,
  ComplaintCategory,
  ComplaintSource,
  ComplaintStatus,
  RootCauseCategory,
} from "@/lib/types";
import {
  approveComplaintAction,
  returnComplaintAction,
  submitComplaintApprovalAction,
} from "@/lib/actions/complaints";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { DataTable } from "@/components/ui/data-table";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { useI18n } from "@/lib/i18n/provider";
import { formatDate } from "@/lib/utils";

export interface ComplaintRow {
  id: string;
  source: ComplaintSource;
  customerName: string;
  content: string;
  outlet: string;
  category: ComplaintCategory;
  status: ComplaintStatus;
  rootCause: RootCauseCategory | null;
  rating: number | null;
  createdAt: string;
  correctiveAction: { description: string; followUpDate?: string | null } | null;
  approval: ComplaintApproval | null;
}

const STATUSES = Object.keys(COMPLAINT_STATUS_META) as ComplaintStatus[];
const SOURCES = Object.keys(COMPLAINT_SOURCE_META) as ComplaintSource[];
const CATEGORIES = Object.keys(COMPLAINT_CATEGORY_META) as ComplaintCategory[];
const CAUSES = Object.keys(ROOT_CAUSE_META) as RootCauseCategory[];

/** The badge shown in the Status column — approval-aware. */
function StatusBadge({ row }: { row: ComplaintRow }) {
  const { td, t } = useI18n();
  if (row.approval?.stage === "pending") {
    return <Badge tone="warning" dot>{t("complaint.pendingApproval")}</Badge>;
  }
  const m = COMPLAINT_STATUS_META[row.status];
  return <Badge tone={m?.tone ?? "neutral"} dot>{td(m?.label ?? row.status)}</Badge>;
}

/** What this viewer can do with a given complaint, based on its stage. */
type RowAction = "approve" | "resolve" | "detail";
function actionFor(row: ComplaintRow, canResolve: boolean, canApprove: boolean): RowAction {
  const stage = row.approval?.stage;
  if (stage === "pending" && canApprove) return "approve";
  if (canResolve && stage !== "pending" && stage !== "approved") return "resolve";
  return "detail";
}

export function ComplaintTable({
  rows,
  canResolve = false,
  canApprove = false,
}: {
  rows: ComplaintRow[];
  canResolve?: boolean;
  canApprove?: boolean;
}) {
  const { t, td } = useI18n();
  const [status, setStatus] = React.useState("all");
  const [source, setSource] = React.useState("all");
  const [category, setCategory] = React.useState("all");
  const [selected, setSelected] = React.useState<ComplaintRow | null>(null);
  const [viewing, setViewing] = React.useState<ComplaintRow | null>(null);

  const filtered = React.useMemo(
    () =>
      rows.filter(
        (r) =>
          (status === "all" || r.status === status) &&
          (source === "all" || r.source === source) &&
          (category === "all" || r.category === category),
      ),
    [rows, status, source, category],
  );

  const columns = React.useMemo<ColumnDef<ComplaintRow>[]>(
    () => [
      {
        accessorKey: "content",
        header: t("complaint.colComplaint"),
        cell: ({ row }) => (
          <div className="max-w-xs">
            <p className="truncate font-medium text-foreground">{row.original.content}</p>
            <p className="truncate text-[11px] text-muted-foreground">
              {row.original.customerName} · {row.original.outlet}
              {row.original.rating != null && (
                <span className="ml-1 inline-flex items-center gap-0.5 text-amber-300">
                  <Star className="size-3 fill-current" />
                  {row.original.rating}
                </span>
              )}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "source",
        header: t("complaint.colSource"),
        cell: ({ getValue }) => {
          const s = getValue<ComplaintSource>();
          const m = COMPLAINT_SOURCE_META[s];
          return <Badge tone={m?.tone ?? "neutral"}>{td(m?.label ?? s)}</Badge>;
        },
      },
      {
        accessorKey: "category",
        header: t("complaint.colCategory"),
        cell: ({ getValue }) => {
          const c = getValue<ComplaintCategory>();
          return <span className="text-muted-foreground">{td(COMPLAINT_CATEGORY_META[c]?.label ?? c)}</span>;
        },
      },
      {
        accessorKey: "status",
        header: t("common.status"),
        cell: ({ row }) => <StatusBadge row={row.original} />,
      },
      {
        accessorKey: "createdAt",
        header: t("common.date"),
        cell: ({ getValue }) => <span className="text-muted-foreground">{formatDate(getValue<string>())}</span>,
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const kind = actionFor(row.original, canResolve, canApprove);
          if (kind === "approve") {
            return (
              <Button size="sm" variant="subtle" onClick={() => setSelected(row.original)}>
                <CheckCircle2 className="size-3.5" /> {t("complaint.approve")}
              </Button>
            );
          }
          if (kind === "resolve") {
            return (
              <Button size="sm" variant="subtle" onClick={() => setSelected(row.original)}>
                <ClipboardCheck className="size-3.5" /> {t("complaint.followUpAction")}
              </Button>
            );
          }
          return (
            <Button size="sm" variant="subtle" onClick={() => setViewing(row.original)}>
              <Eye className="size-3.5" /> {t("complaint.view")}
            </Button>
          );
        },
      },
    ],
    [canResolve, canApprove, t, td],
  );

  return (
    <>
      <DataTable
        tableId="complaints"
        columns={columns}
        data={filtered}
        showSearch={false}
        showExport={false}
        searchPlaceholder="Search complaints…"
        toolbar={
          <div className="contents">
            <Combobox
              portal
              searchable={false}
              value={status}
              onChange={setStatus}
              className="w-36 shrink-0"
              options={[{ value: "all", label: t("complaint.allStatus") }, ...STATUSES.map((s) => ({ value: s, label: td(COMPLAINT_STATUS_META[s].label) }))]}
            />
            <Combobox
              portal
              searchable={false}
              value={source}
              onChange={setSource}
              className="w-40 shrink-0"
              options={[{ value: "all", label: t("complaint.allSource") }, ...SOURCES.map((s) => ({ value: s, label: td(COMPLAINT_SOURCE_META[s].label) }))]}
            />
            <Combobox
              portal
              searchable={false}
              value={category}
              onChange={setCategory}
              className="w-44 shrink-0"
              options={[{ value: "all", label: t("complaint.allCategory") }, ...CATEGORIES.map((c) => ({ value: c, label: td(COMPLAINT_CATEGORY_META[c].label) }))]}
            />
          </div>
        }
      />
      {selected && (
        <WorkDialog
          key={selected.id}
          complaint={selected}
          canResolve={canResolve}
          canApprove={canApprove}
          onClose={() => setSelected(null)}
        />
      )}
      {viewing && <ComplaintDetailDialog key={viewing.id} complaint={viewing} onClose={() => setViewing(null)} />}
    </>
  );
}

/** Shows the resolution + approval record (used in the detail + approve views). */
function ResolutionSummary({ complaint }: { complaint: ComplaintRow }) {
  const { t, td } = useI18n();
  const a = complaint.approval;
  const empty = !complaint.rootCause && !complaint.correctiveAction?.description && !a;
  if (empty) return <p className="text-sm text-muted-foreground">—</p>;
  return (
    <div className="space-y-3">
      {complaint.rootCause && (
        <div>
          <p className="text-xs text-muted-foreground">{t("complaint.rootCause")}</p>
          <p className="text-sm text-foreground">{td(ROOT_CAUSE_META[complaint.rootCause]?.label ?? complaint.rootCause)}</p>
        </div>
      )}
      {complaint.correctiveAction?.description && (
        <div>
          <p className="text-xs text-muted-foreground">{t("complaint.resolutionDetail")}</p>
          <p className="whitespace-pre-line text-sm text-foreground">{complaint.correctiveAction.description}</p>
        </div>
      )}
      {a?.stage === "approved" && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
          <p className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="size-4" /> {t("complaint.approvedBy")} {a.approverName ?? "Coordinator Area"}
            {a.approvedAt && <span className="text-xs font-normal text-muted-foreground">· {formatDate(a.approvedAt)}</span>}
          </p>
          {a.note && <p className="mt-1.5 whitespace-pre-line text-sm text-foreground/90">{a.note}</p>}
          {a.photoUrl && (
            <a href={a.photoUrl} target="_blank" rel="noreferrer" className="mt-2 block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.photoUrl} alt={t("complaint.approvalPhotoView")} className="max-h-48 rounded-lg ring-1 ring-border" />
            </a>
          )}
        </div>
      )}
    </div>
  );
}

/** Read-only complaint detail — used by monitor roles (Admin / anyone without an
 *  action on this complaint) to follow its progress. */
function ComplaintDetailDialog({ complaint, onClose }: { complaint: ComplaintRow; onClose: () => void }) {
  const { t, td } = useI18n();
  const src = COMPLAINT_SOURCE_META[complaint.source];
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent title={t("complaint.detailTitle")} description={t("complaint.detailDesc")} align="center" className="max-w-lg">
        <div className="space-y-4 p-5">
          <p className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-foreground/90">“{complaint.content}”</p>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">{t("complaint.customer")}</dt>
              <dd className="text-foreground">{complaint.customerName}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{t("common.outlet")}</dt>
              <dd className="text-foreground">{complaint.outlet}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{t("complaint.colSource")}</dt>
              <dd><Badge tone={src?.tone ?? "neutral"}>{td(src?.label ?? complaint.source)}</Badge></dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{t("complaint.colCategory")}</dt>
              <dd className="text-foreground">{td(COMPLAINT_CATEGORY_META[complaint.category]?.label ?? complaint.category)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{t("common.status")}</dt>
              <dd><StatusBadge row={complaint} /></dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{t("common.date")}</dt>
              <dd className="text-foreground">{formatDate(complaint.createdAt)}</dd>
            </div>
            {complaint.rating != null && (
              <div>
                <dt className="text-xs text-muted-foreground">{t("complaint.rating")}</dt>
                <dd className="inline-flex items-center gap-1 text-amber-500"><Star className="size-3.5 fill-current" />{complaint.rating}</dd>
              </div>
            )}
          </dl>
          <div className="border-t border-border pt-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("complaint.resolutionDetail")}</p>
            <ResolutionSummary complaint={complaint} />
            {complaint.approval?.stage === "pending" && (
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
                <Loader2 className="size-4 shrink-0" /> {t("complaint.waitingCA")}
              </div>
            )}
          </div>
          <div className="flex justify-end">
            <Button variant="ghost" onClick={onClose}>{t("common.close")}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Action dialog — Supervisor follow-up (resolve) or Coordinator Area approval. */
function WorkDialog({
  complaint,
  canResolve,
  canApprove,
  onClose,
}: {
  complaint: ComplaintRow;
  canResolve: boolean;
  canApprove: boolean;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const isApproval = complaint.approval?.stage === "pending" && canApprove;

  const title = isApproval ? t("complaint.approvalTitle") : t("complaint.resolveTitle");
  const desc = isApproval ? t("complaint.approvalDesc") : t("complaint.resolveDesc");

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent title={title} description={desc} align="center" className="max-w-lg">
        <div className="space-y-4 p-5">
          <p className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-foreground/80">“{complaint.content}”</p>
          {isApproval ? (
            <ApprovalPanel complaint={complaint} onClose={onClose} />
          ) : canResolve ? (
            <ResolveForm complaint={complaint} onClose={onClose} />
          ) : (
            <>
              <ResolutionSummary complaint={complaint} />
              <div className="flex justify-end">
                <Button variant="ghost" onClick={onClose}>{t("common.close")}</Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Supervisor records the follow-up and submits it to the Coordinator Area. */
function ResolveForm({ complaint, onClose }: { complaint: ComplaintRow; onClose: () => void }) {
  const { t, td } = useI18n();
  const router = useRouter();
  const [busy, startTransition] = React.useTransition();
  const [rootCause, setRootCause] = React.useState<RootCauseCategory>(complaint.rootCause ?? "man");
  const [action, setAction] = React.useState(complaint.correctiveAction?.description ?? "");
  const [followUp, setFollowUp] = React.useState("");

  function submit() {
    if (!action.trim()) {
      toast.error(t("complaint.correctivePh"));
      return;
    }
    startTransition(async () => {
      const res = await submitComplaintApprovalAction({
        id: complaint.id,
        rootCause,
        actionDescription: action,
        followUpDate: followUp || undefined,
      });
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success(t("complaint.submittedForApproval"));
      onClose();
      router.refresh();
    });
  }

  return (
    <>
      <Field label={t("complaint.rootCause")}>
        <Combobox
          portal
          searchable={false}
          matchTriggerWidth
          value={rootCause}
          onChange={(v) => setRootCause(v as RootCauseCategory)}
          options={CAUSES.map((c) => ({ value: c, label: td(ROOT_CAUSE_META[c].label) }))}
        />
      </Field>
      <Field label={t("complaint.corrective")}>
        <Textarea value={action} onChange={(e) => setAction(e.target.value)} placeholder={t("complaint.correctivePh")} />
      </Field>
      <Field label={t("complaint.followUp")}>
        <DatePicker value={followUp} onChange={setFollowUp} />
      </Field>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose} disabled={busy}>{t("common.cancel")}</Button>
        <Button onClick={submit} disabled={busy}>
          {busy && <Loader2 className="animate-spin" />} {t("complaint.submitApproval")}
        </Button>
      </div>
    </>
  );
}

/** Coordinator Area approves (optional photo + note) or returns for revision. */
function ApprovalPanel({ complaint, onClose }: { complaint: ComplaintRow; onClose: () => void }) {
  const { t } = useI18n();
  const router = useRouter();
  const [busy, startTransition] = React.useTransition();
  const [note, setNote] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function approve() {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", complaint.id);
      fd.set("note", note);
      if (file) fd.set("photo", file);
      const res = await approveComplaintAction(fd);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success(t("complaint.approve"));
      onClose();
      router.refresh();
    });
  }

  function returnForRevision() {
    startTransition(async () => {
      const res = await returnComplaintAction({ id: complaint.id, note });
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success(t("complaint.return"));
      onClose();
      router.refresh();
    });
  }

  return (
    <>
      <div className="rounded-lg border border-border bg-muted/20 p-3">
        <ResolutionSummary complaint={complaint} />
      </div>

      <Field label={t("complaint.approvalNote")}>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("complaint.approvalNotePh")} />
      </Field>

      <div>
        <p className="mb-1.5 text-sm font-medium text-foreground">{t("complaint.approvalPhoto")}</p>
        {preview ? (
          <div className="relative inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="preview" className="max-h-44 rounded-lg ring-1 ring-border" />
            <button
              type="button"
              onClick={() => setFile(null)}
              className="absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-full bg-black/60 text-white hover:bg-black/80"
              aria-label="Hapus foto"
            >
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border py-4 text-sm text-muted-foreground hover:bg-muted/40">
            <ImagePlus className="size-4" /> {t("complaint.approvalPhoto")}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={returnForRevision} disabled={busy}>
          <Undo2 className="size-3.5" /> {t("complaint.return")}
        </Button>
        <Button onClick={approve} disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : <CheckCircle2 className="size-3.5" />} {t("complaint.approve")}
        </Button>
      </div>
    </>
  );
}
