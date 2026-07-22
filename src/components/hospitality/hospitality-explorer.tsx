"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { type ColumnDef } from "@tanstack/react-table";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteHospitalityAction } from "@/lib/actions/hospitality";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
import { DataTable } from "@/components/ui/data-table";
import { MonthFilter, monthKey, monthOptions } from "@/components/work/division-filter";
import { scoreColor } from "@/components/ui/tone";
import { useI18n } from "@/lib/i18n/provider";
import { formatDate } from "@/lib/utils";

export interface HospitalityRow {
  id: string;
  staffName: string;
  staffPosition: string;
  outletId: string;
  outlet: string;
  areaId: string;
  area: string;
  assessor: string;
  date: string;
  score: number;
}

export function HospitalityExplorer({ rows, outlets, canDelete = false, canViewScore = true, showOutletFilter = true }: { rows: HospitalityRow[]; outlets: { id: string; name: string }[]; canDelete?: boolean; canViewScore?: boolean; showOutletFilter?: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [month, setMonth] = React.useState("all");
  const [outlet, setOutlet] = React.useState("all");
  const [deleting, setDeleting] = React.useState<string | null>(null);

  async function onDelete(id: string, label: string) {
    if (typeof window !== "undefined" && !window.confirm(`Hapus assessment "${label}"? Tindakan ini permanen.`)) return;
    setDeleting(id);
    const res = await deleteHospitalityAction(id);
    if (res?.error) toast.error(res.error);
    else { toast.success("Assessment dihapus"); router.refresh(); }
    setDeleting(null);
  }
  const months = React.useMemo(() => monthOptions(rows.map((r) => r.date)), [rows]);

  const scoped = React.useMemo(
    () => rows.filter((r) => (month === "all" || monthKey(r.date) === month) && (outlet === "all" || r.outletId === outlet)),
    [rows, month, outlet],
  );

  const columns = React.useMemo<ColumnDef<HospitalityRow>[]>(
    () => [
      {
        accessorKey: "date",
        header: t("common.date"),
        cell: ({ getValue }) => <span className="whitespace-nowrap text-muted-foreground">{formatDate(getValue<string>())}</span>,
      },
      {
        accessorKey: "staffName",
        header: t("hosp.colStaff"),
        cell: ({ row }) => (
          <div className="flex items-center gap-2.5">
            <Avatar name={row.original.staffName} size={32} />
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">{row.original.staffName}</p>
              <p className="truncate text-[11px] text-muted-foreground">{row.original.staffPosition}</p>
            </div>
          </div>
        ),
      },
      { accessorKey: "outlet", header: t("common.outlet"), cell: ({ getValue }) => <span className="text-foreground/80">{getValue<string>()}</span> },
      { accessorKey: "area", header: t("hosp.colCoordinator"), cell: ({ getValue }) => <span className="text-muted-foreground">{getValue<string>()}</span> },
      { accessorKey: "assessor", header: t("hosp.supervisor"), cell: ({ getValue }) => <span className="text-foreground/80">{getValue<string>()}</span> },
      ...(canViewScore
        ? [{
            accessorKey: "score",
            header: t("common.score"),
            cell: ({ getValue }: { getValue: <T>() => T }) => {
              const s = getValue<number>();
              return (
                <span className="inline-flex items-center gap-1.5 font-semibold tabular-nums" style={{ color: scoreColor(s) }}>
                  <span className="size-2 rounded-full" style={{ background: scoreColor(s) }} />
                  {s.toFixed(1)}
                </span>
              );
            },
          } as ColumnDef<HospitalityRow>]
        : []),
      ...(canDelete
        ? [{
            id: "actions",
            header: "",
            enableSorting: false,
            cell: ({ row }: { row: { original: HospitalityRow } }) => (
              <button
                type="button"
                onClick={() => onDelete(row.original.id, row.original.staffName)}
                disabled={deleting === row.original.id}
                className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-500 disabled:opacity-50"
                title="Hapus assessment"
              >
                <Trash2 className="size-3.5" />
              </button>
            ),
          } as ColumnDef<HospitalityRow>]
        : []),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canDelete, canViewScore, deleting, t],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("hosp.assessments")}</CardTitle>
        <CardDescription>{t("hosp.visit")} · {scoped.length} {t("common.records")}</CardDescription>
      </CardHeader>
      <CardContent>
        <DataTable
          tableId="hospitality"
          columns={columns}
          data={scoped}
          showSearch={false}
          showExport={false}
          searchPlaceholder="Cari staff / coordinator…"
          toolbar={
            <div className="contents">
              <MonthFilter options={months} value={month} onChange={setMonth} className="w-40 shrink-0" />
              {showOutletFilter && (
                <Combobox
                  portal
                  value={outlet}
                  onChange={setOutlet}
                  className="w-48 shrink-0"
                  options={[{ value: "all", label: t("common.allOutlets") }, ...outlets.map((o) => ({ value: o.id, label: o.name }))]}
                  searchPlaceholder="Cari outlet…"
                />
              )}
            </div>
          }
        />
      </CardContent>
    </Card>
  );
}
