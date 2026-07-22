"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { CircleCheckBig, Eye, Loader2, Settings2, Star } from "lucide-react";
import { toast } from "sonner";
import {
  COMPLAINT_CATEGORY_META,
  COMPLAINT_SOURCE_META,
  COMPLAINT_STATUS_META,
  ROOT_CAUSE_META,
} from "@/lib/constants";
import type {
  ComplaintCategory,
  ComplaintSource,
  ComplaintStatus,
  RootCauseCategory,
} from "@/lib/types";
import { bulkCloseComplaintsAction, resolveComplaintAction } from "@/lib/actions/complaints";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
}

const STATUSES = Object.keys(COMPLAINT_STATUS_META) as ComplaintStatus[];
const CAUSES = Object.keys(ROOT_CAUSE_META) as RootCauseCategory[];

export function ComplaintTable({ rows, canManage }: { rows: ComplaintRow[]; canManage: boolean }) {
  const { t, td } = useI18n();
  const router = useRouter();
  const [status, setStatus] = React.useState("all");
  const [selected, setSelected] = React.useState<ComplaintRow | null>(null);
  const [viewing, setViewing] = React.useState<ComplaintRow | null>(null);
  const [picked, setPicked] = React.useState<Set<string>>(new Set());
  const [bulkPending, startBulk] = React.useTransition();

  const filtered = React.useMemo(
    () => rows.filter((r) => status === "all" || r.status === status),
    [rows, status],
  );

  const togglePick = React.useCallback((id: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  function bulkClose() {
    const ids = [...picked];
    startBulk(async () => {
      const res = await bulkCloseComplaintsAction(ids);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`Closed ${res?.count ?? ids.length} complaints`);
      setPicked(new Set());
      router.refresh();
    });
  }

  const columns = React.useMemo<ColumnDef<ComplaintRow>[]>(() => {
    const cols: ColumnDef<ComplaintRow>[] = [];
    if (canManage) {
      cols.push({
        id: "select",
        header: "",
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={picked.has(row.original.id)}
            onChange={() => togglePick(row.original.id)}
            className="size-4 accent-primary"
            aria-label="Select complaint"
          />
        ),
      });
    }
    cols.push(
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
        cell: ({ getValue }) => {
          const s = getValue<ComplaintStatus>();
          const m = COMPLAINT_STATUS_META[s];
          return <Badge tone={m?.tone ?? "neutral"} dot>{td(m?.label ?? s)}</Badge>;
        },
      },
      {
        accessorKey: "createdAt",
        header: t("common.date"),
        cell: ({ getValue }) => <span className="text-muted-foreground">{formatDate(getValue<string>())}</span>,
      },
    );
    cols.push({
      id: "actions",
      header: "",
      cell: ({ row }) =>
        canManage ? (
          <Button size="sm" variant="subtle" onClick={() => setSelected(row.original)}>
            <Settings2 className="size-3.5" /> {t("complaint.manage")}
          </Button>
        ) : (
          // Supervisors monitor only: open a read-only detail view.
          <Button size="sm" variant="subtle" onClick={() => setViewing(row.original)}>
            <Eye className="size-3.5" /> {t("complaint.view")}
          </Button>
        ),
    });
    return cols;
  }, [canManage, picked, togglePick, t, td]);

  return (
    <>
      <DataTable
        tableId="complaints"
        columns={columns}
        data={filtered}
        searchPlaceholder="Search complaints…"
        toolbar={
          <div className="contents">
            {canManage && picked.size > 0 && (
              <Button size="sm" variant="subtle" onClick={bulkClose} disabled={bulkPending}>
                {bulkPending ? <Loader2 className="animate-spin" /> : <CircleCheckBig />} Close {picked.size}
              </Button>
            )}
            <Combobox
              portal
              searchable={false}
              value={status}
              onChange={setStatus}
              className="w-40 shrink-0"
              options={[{ value: "all", label: t("complaint.allStatus") }, ...STATUSES.map((s) => ({ value: s, label: td(COMPLAINT_STATUS_META[s].label) }))]}
            />
          </div>
        }
      />
      {selected && <ResolveDialog key={selected.id} complaint={selected} onClose={() => setSelected(null)} />}
      {viewing && <ComplaintDetailDialog key={viewing.id} complaint={viewing} onClose={() => setViewing(null)} />}
    </>
  );
}

/** Read-only complaint detail — used by monitor-only roles (Supervisor). */
function ComplaintDetailDialog({ complaint, onClose }: { complaint: ComplaintRow; onClose: () => void }) {
  const { t, td } = useI18n();
  const src = COMPLAINT_SOURCE_META[complaint.source];
  const st = COMPLAINT_STATUS_META[complaint.status];
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
              <dd><Badge tone={st?.tone ?? "neutral"} dot>{td(st?.label ?? complaint.status)}</Badge></dd>
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
            {complaint.rootCause && (
              <div>
                <dt className="text-xs text-muted-foreground">{t("complaint.rootCause")}</dt>
                <dd className="text-foreground">{td(ROOT_CAUSE_META[complaint.rootCause]?.label ?? complaint.rootCause)}</dd>
              </div>
            )}
          </dl>
          <div className="flex justify-end">
            <Button variant="ghost" onClick={onClose}>{t("common.close")}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ResolveDialog({ complaint, onClose }: { complaint: ComplaintRow; onClose: () => void }) {
  const { t, td } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [status, setStatus] = React.useState<ComplaintStatus>(
    complaint.status === "open" ? "in_progress" : complaint.status,
  );
  const [rootCause, setRootCause] = React.useState<RootCauseCategory>(complaint.rootCause ?? "man");
  const [action, setAction] = React.useState("");
  const [followUp, setFollowUp] = React.useState("");

  function submit() {
    startTransition(async () => {
      const res = await resolveComplaintAction({
        id: complaint.id,
        status,
        rootCause,
        actionDescription: action || undefined,
        followUpDate: followUp || undefined,
      });
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Complaint updated");
      onClose();
      router.refresh();
    });
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent title={t("complaint.manageTitle")} description={t("complaint.manageDesc")} align="center" className="max-w-lg">
        <div className="space-y-4 p-5">
          <p className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-foreground/80">
            “{complaint.content}”
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("common.status")}>
              <Combobox
                portal
                searchable={false}
                matchTriggerWidth
                value={status}
                onChange={(v) => setStatus(v as ComplaintStatus)}
                options={STATUSES.map((s) => ({ value: s, label: td(COMPLAINT_STATUS_META[s].label) }))}
              />
            </Field>
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
          </div>
          <Field label={t("complaint.corrective")}>
            <Textarea value={action} onChange={(e) => setAction(e.target.value)} placeholder={t("complaint.correctivePh")} />
          </Field>
          <Field label={t("complaint.followUp")}>
            <Input type="date" value={followUp} onChange={(e) => setFollowUp(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose} disabled={pending}>
              {t("common.cancel")}
            </Button>
            <Button onClick={submit} disabled={pending}>
              {pending && <Loader2 className="animate-spin" />} {t("common.save")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
