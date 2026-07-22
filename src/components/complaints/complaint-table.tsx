"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { CircleCheckBig, Loader2, Settings2, Star } from "lucide-react";
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
    if (canManage) {
      cols.push({
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <Button size="sm" variant="subtle" onClick={() => setSelected(row.original)}>
            <Settings2 className="size-3.5" /> {t("complaint.manage")}
          </Button>
        ),
      });
    }
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
    </>
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
