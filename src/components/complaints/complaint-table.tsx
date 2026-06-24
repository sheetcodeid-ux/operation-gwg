"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { Loader2, Settings2, Star } from "lucide-react";
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
import { resolveComplaintAction } from "@/lib/actions/complaints";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
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
  const [status, setStatus] = React.useState("all");
  const [selected, setSelected] = React.useState<ComplaintRow | null>(null);

  const filtered = React.useMemo(
    () => rows.filter((r) => status === "all" || r.status === status),
    [rows, status],
  );

  const columns = React.useMemo<ColumnDef<ComplaintRow>[]>(() => {
    const cols: ColumnDef<ComplaintRow>[] = [
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
    ];
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
  }, [canManage]);

  return (
    <>
      <DataTable
        columns={columns}
        data={filtered}
        searchPlaceholder="Search complaints…"
        toolbar={
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-36">
            <option value="all">All status</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {COMPLAINT_STATUS_META[s].label}
              </option>
            ))}
          </Select>
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
              <Select value={status} onChange={(e) => setStatus(e.target.value as ComplaintStatus)}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {COMPLAINT_STATUS_META[s].label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Root Cause (5M)">
              <Select value={rootCause} onChange={(e) => setRootCause(e.target.value as RootCauseCategory)}>
                {CAUSES.map((c) => (
                  <option key={c} value={c}>
                    {ROOT_CAUSE_META[c].label}
                  </option>
                ))}
              </Select>
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
