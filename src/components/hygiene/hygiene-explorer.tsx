"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { type ColumnDef } from "@tanstack/react-table";
import { Camera, ChevronDown, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { deleteHygieneAction } from "@/lib/actions/hygiene";
import type { Attachment } from "@/lib/types";
import { scoreColor } from "@/components/ui/tone";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
import { DataTable } from "@/components/ui/data-table";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { MonthFilter, monthKey, monthOptions } from "@/components/work/division-filter";
import { useI18n } from "@/lib/i18n/provider";
import { cn, formatDate } from "@/lib/utils";

export interface HygieneRow {
  id: string;
  outletId: string;
  outlet: string;
  areaId: string;
  area: string;
  shift: string;
  inspector: string;
  date: string;
  score: number;
  isClean: boolean;
  findings: number;
  photos: Attachment[];
}


/** Documentation gallery: photos grouped by area, collapsible, 3-per-row,
 *  with a clean framed lightbox on click (instead of the raw storage URL). */
function AuditPhotoGallery({ photos, caption }: { photos: Attachment[]; caption: string }) {
  const groups = React.useMemo(() => {
    const map = new Map<string, Attachment[]>();
    for (const p of photos) {
      const key = p.name?.trim() || "Lainnya";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return Array.from(map, ([label, items]) => ({ label, items }));
  }, [photos]);

  const [collapsed, setCollapsed] = React.useState<Record<string, boolean>>({});
  const [active, setActive] = React.useState<Attachment | null>(null);

  return (
    <div className="max-h-[72vh] space-y-2 overflow-y-auto p-4">
      {groups.map(({ label, items }) => {
        const open = !collapsed[label];
        return (
          <div key={label} className="overflow-hidden rounded-xl border border-border">
            <button
              type="button"
              onClick={() => setCollapsed((c) => ({ ...c, [label]: open }))}
              className="flex w-full items-center justify-between gap-2 bg-muted/30 px-3 py-2.5 text-left hover:bg-muted/50"
            >
              <div className="flex items-center gap-2">
                <Camera className="size-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">{label}</span>
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-muted-foreground">{items.length}</span>
              </div>
              <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
            </button>
            {open && (
              <div className="grid grid-cols-3 gap-2 p-3">
                {items.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setActive(p)}
                    className="group relative aspect-square w-full overflow-hidden rounded-lg ring-1 ring-border transition-transform hover:scale-[1.02]"
                  >
                    {/* Plain img (not next/image): photos are already compressed at
                        capture, so we skip Vercel Image Optimization entirely. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt={p.name} loading="lazy" className="absolute inset-0 size-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {active && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
          onClick={() => setActive(null)}
        >
          <button
            type="button"
            onClick={() => setActive(null)}
            className="absolute right-4 top-4 grid size-9 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            aria-label="Tutup"
          >
            <X className="size-5" />
          </button>
          <div className="flex max-h-full max-w-3xl flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
            <div className="overflow-hidden rounded-2xl bg-black ring-1 ring-white/15 shadow-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={active.url} alt={active.name} className="max-h-[78vh] w-auto object-contain" />
            </div>
            <p className="text-center text-xs text-white/70">
              <span className="font-medium text-white/90">{active.name}</span> · {caption}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export function HygieneExplorer({ rows, outlets, canDelete = false, showOutletFilter = true }: { rows: HygieneRow[]; outlets: { id: string; name: string }[]; canDelete?: boolean; showOutletFilter?: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [month, setMonth] = React.useState("all");
  const [outlet, setOutlet] = React.useState("all");
  const [deleting, setDeleting] = React.useState<string | null>(null);

  async function onDelete(id: string, label: string) {
    if (typeof window !== "undefined" && !window.confirm(`Hapus audit "${label}"? Tindakan ini permanen.`)) return;
    setDeleting(id);
    const res = await deleteHygieneAction(id);
    if (res?.error) toast.error(res.error);
    else { toast.success("Audit dihapus"); router.refresh(); }
    setDeleting(null);
  }
  const months = React.useMemo(() => monthOptions(rows.map((r) => r.date)), [rows]);

  const scoped = React.useMemo(
    () => rows.filter((r) => (month === "all" || monthKey(r.date) === month) && (outlet === "all" || r.outletId === outlet)),
    [rows, month, outlet],
  );

  const columns = React.useMemo<ColumnDef<HygieneRow>[]>(
    () => [
      {
        accessorKey: "date",
        header: t("common.date"),
        cell: ({ getValue }) => <span className="whitespace-nowrap text-muted-foreground">{formatDate(getValue<string>())}</span>,
      },
      {
        accessorKey: "outlet",
        header: t("common.outlet"),
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{row.original.outlet}</p>
            <p className="truncate text-[11px] text-muted-foreground">{row.original.area}</p>
          </div>
        ),
      },
      { accessorKey: "shift", header: t("hygiene.shift"), cell: ({ getValue }) => <span className="capitalize text-muted-foreground">{getValue<string>()}</span> },
      { accessorKey: "inspector", header: t("hygiene.colInspector"), cell: ({ getValue }) => <span className="text-muted-foreground">{getValue<string>()}</span> },
      {
        accessorKey: "findings",
        header: t("hygiene.colFindings"),
        cell: ({ getValue }) => {
          const n = getValue<number>();
          return n > 0 ? <Badge tone="warning">{n}</Badge> : <span className="text-muted-foreground">—</span>;
        },
      },
      {
        id: "photos",
        header: t("hygiene.colPhotos"),
        enableSorting: false,
        cell: ({ row }) => {
          const photos = row.original.photos;
          if (!photos?.length) return <span className="text-muted-foreground/60">—</span>;
          return (
            <Dialog>
              <DialogTrigger>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Camera className="size-3.5" /> {photos.length}
                </button>
              </DialogTrigger>
              <DialogContent title="Dokumentasi Audit" description={`${row.original.outlet} · ${formatDate(row.original.date)}`} align="center" className="max-w-2xl">
                <AuditPhotoGallery photos={photos} caption={`${row.original.outlet} · ${formatDate(row.original.date)}`} />
              </DialogContent>
            </Dialog>
          );
        },
      },
      {
        accessorKey: "isClean",
        header: t("common.status"),
        cell: ({ getValue }) => {
          const clean = getValue<boolean>();
          return (
            <Badge tone={clean ? "success" : "danger"} dot>
              {clean ? t("hygiene.clean") : t("hygiene.attention")}
            </Badge>
          );
        },
      },
      {
        accessorKey: "score",
        header: t("common.score"),
        cell: ({ getValue }) => {
          const s = getValue<number>();
          return (
            <span className="inline-flex items-center gap-1.5 font-semibold tabular-nums" style={{ color: scoreColor(s) }}>
              <span className="size-2 rounded-full" style={{ background: scoreColor(s) }} />
              {s.toFixed(1)}
            </span>
          );
        },
      },
      ...(canDelete
        ? [{
            id: "actions",
            header: "",
            enableSorting: false,
            cell: ({ row }: { row: { original: HygieneRow } }) => (
              <button
                type="button"
                onClick={() => onDelete(row.original.id, row.original.outlet)}
                disabled={deleting === row.original.id}
                className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-500 disabled:opacity-50"
                title="Hapus audit"
              >
                <Trash2 className="size-3.5" />
              </button>
            ),
          } as ColumnDef<HygieneRow>]
        : []),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canDelete, deleting, t],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("hygiene.assessments")}</CardTitle>
        <CardDescription>{scoped.length} {t("common.records")}</CardDescription>
      </CardHeader>
      <CardContent>
        <DataTable
          tableId="hygiene"
          columns={columns}
          data={scoped}
          showSearch={false}
          showExport={false}
          searchPlaceholder="Cari outlet / inspector…"
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
