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
  PRIORITY_META,
  ROOT_CAUSE_META,
} from "@/lib/constants";
import type {
  ComplaintCategory,
  ComplaintSource,
  ComplaintStatus,
  Priority,
  RootCauseCategory,
} from "@/lib/types";
import { bulkCloseComplaintsAction, resolveComplaintAction } from "@/lib/actions/complaints";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { formatDate } from "@/lib/utils";

export interface ComplaintRow {
  id: string;
  source: ComplaintSource;
  customerName: string;
  content: string;
  outlet: string;
  category: ComplaintCategory;
  priority: Priority;
  status: ComplaintStatus;
  rootCause: RootCauseCategory | null;
  rating: number | null;
  createdAt: string;
}

const STATUSES = Object.keys(COMPLAINT_STATUS_META) as ComplaintStatus[];
const CAUSES = Object.keys(ROOT_CAUSE_META) as RootCauseCategory[];

export function ComplaintTable({ rows, canManage }: { rows: ComplaintRow[]; canManage: boolean }) {
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
        header: "Complaint",
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
        header: "Source",
        cell: ({ getValue }) => {
          const s = getValue<ComplaintSource>();
          return <Badge tone={COMPLAINT_SOURCE_META[s].tone}>{COMPLAINT_SOURCE_META[s].label}</Badge>;
        },
      },
      {
        accessorKey: "category",
        header: "Category",
        cell: ({ getValue }) => <span className="text-muted-foreground">{COMPLAINT_CATEGORY_META[getValue<ComplaintCategory>()].label}</span>,
      },
      {
        accessorKey: "priority",
        header: "Priority",
        cell: ({ getValue }) => {
          const p = getValue<Priority>();
          return <Badge tone={PRIORITY_META[p].tone}>{PRIORITY_META[p].label}</Badge>;
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ getValue }) => {
          const s = getValue<ComplaintStatus>();
          return <Badge tone={COMPLAINT_STATUS_META[s].tone} dot>{COMPLAINT_STATUS_META[s].label}</Badge>;
        },
      },
      {
        accessorKey: "createdAt",
        header: "Date",
        cell: ({ getValue }) => <span className="text-muted-foreground">{formatDate(getValue<string>())}</span>,
      },
    );
    if (canManage) {
      cols.push({
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <Button size="sm" variant="subtle" onClick={() => setSelected(row.original)}>
            <Settings2 className="size-3.5" /> Manage
          </Button>
        ),
      });
    }
    return cols;
  }, [canManage, picked, togglePick]);

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
              value={status}
              onChange={setStatus}
              className="min-w-0 shrink basis-40"
              options={[{ value: "all", label: "All status" }, ...STATUSES.map((s) => ({ value: s, label: COMPLAINT_STATUS_META[s].label }))]}
            />
          </div>
        }
      />
      {selected && <ResolveDialog key={selected.id} complaint={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

function ResolveDialog({ complaint, onClose }: { complaint: ComplaintRow; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [status, setStatus] = React.useState<ComplaintStatus>(
    complaint.status === "open" ? "ongoing" : complaint.status,
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
      <DialogContent title="Manage Complaint" description="Update status, assign root cause and record corrective action." className="max-w-lg">
        <div className="space-y-4 p-5">
          <p className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-foreground/80">
            “{complaint.content}”
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Status">
              <Combobox
                value={status}
                onChange={(v) => setStatus(v as ComplaintStatus)}
                options={STATUSES.map((s) => ({ value: s, label: COMPLAINT_STATUS_META[s].label }))}
              />
            </Field>
            <Field label="Root Cause (5M)">
              <Combobox
                value={rootCause}
                onChange={(v) => setRootCause(v as RootCauseCategory)}
                options={CAUSES.map((c) => ({ value: c, label: ROOT_CAUSE_META[c].label }))}
              />
            </Field>
          </div>
          <Field label="Corrective Action">
            <Textarea value={action} onChange={(e) => setAction(e.target.value)} placeholder="Describe the action taken…" />
          </Field>
          <Field label="Follow-up Date">
            <Input type="date" value={followUp} onChange={(e) => setFollowUp(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={pending}>
              {pending && <Loader2 className="animate-spin" />} Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
