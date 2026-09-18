"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown, Eye, Search } from "lucide-react";
import type { RankedOutletRow } from "@/lib/data/store";
import { Badge } from "@/components/ui/badge";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;

type SortKey = "outlet" | "coordinator" | "hospitality" | "hygiene" | "complaints" | "composite";

const STRING_KEYS: SortKey[] = ["outlet", "coordinator"];

/**
 * Satu sel skor. `null` berarti outlet ini belum punya bukti auditnya.
 *
 * Ditulis apa adanya, bukan "0.0": nol adalah hasil penilaian, dan outlet yang
 * belum pernah dinilai tidak boleh terbaca sebagai outlet yang nilainya nol.
 */
function Skor({ v }: { v: number | null }) {
  if (v === null) {
    return (
      <span
        title="Outlet ini belum punya catatan audit untuk periode ini. Belum dinilai — bukan bernilai nol."
        className="cursor-help text-[11px] font-normal italic text-muted-foreground/70"
      >
        Belum ada data
      </span>
    );
  }
  return <>{v.toFixed(1)}</>;
}

export function OutletRankingTable({ rows }: { rows: RankedOutletRow[] }) {
  const [sort, setSort] = React.useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "composite", dir: "desc" });
  const [query, setQuery] = React.useState("");
  const [page, setPage] = React.useState(1);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.outlet.name.toLowerCase().includes(q) ||
        r.outlet.code.toLowerCase().includes(q) ||
        r.area.toLowerCase().includes(q) ||
        r.coordinator.toLowerCase().includes(q),
    );
  }, [rows, query]);

  const sorted = React.useMemo(() => {
    const s = [...filtered];
    const { key, dir } = sort;
    const mul = dir === "asc" ? 1 : -1;
    s.sort((a, b) => {
      if (STRING_KEYS.includes(key)) {
        const av = key === "outlet" ? a.outlet.name : a.coordinator;
        const bv = key === "outlet" ? b.outlet.name : b.coordinator;
        return av.localeCompare(bv) * mul;
      }
      // Yang belum berskor selalu di BELAKANG, apa pun arah urutannya.
      // Membandingkannya sebagai angka menuntut nilai pengganti, dan setiap
      // nilai pengganti adalah skor palsu.
      const av = a[key] as number | null;
      const bv = b[key] as number | null;
      if (av === null && bv === null) return a.outlet.name.localeCompare(b.outlet.name, "id");
      if (av === null) return 1;
      if (bv === null) return -1;
      return (av - bv) * mul;
    });
    return s;
  }, [filtered, sort]);

  const total = sorted.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const start = (current - 1) * PAGE_SIZE;
  const pageRows = sorted.slice(start, start + PAGE_SIZE);

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: STRING_KEYS.includes(key) ? "asc" : "desc" },
    );
    setPage(1);
  }

  function changeOrder(v: string) {
    setSort({ key: "composite", dir: v === "low" ? "asc" : "desc" });
    setPage(1);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="relative min-w-24 max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search outlet…"
            className="pl-9"
          />
        </div>
        <Combobox
          portal
          searchable={false}
          className="w-40 shrink-0"
          options={[
            { value: "high", label: "Tertinggi" },
            { value: "low", label: "Terendah" },
          ]}
          value={sort.key === "composite" && sort.dir === "asc" ? "low" : "high"}
          onChange={changeOrder}
          searchPlaceholder="Urutan…"
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[56rem] table-fixed border-collapse text-sm">
          <thead>
            <tr className="whitespace-nowrap bg-muted/60 text-xs text-muted-foreground">
              <SortableTh label="Outlet" sortKey="outlet" sort={sort} onSort={toggleSort} className="w-[24%] text-left" />
              <SortableTh label="Coordinator Area" sortKey="coordinator" sort={sort} onSort={toggleSort} className="w-[16%] text-left" />
              <SortableTh label="Hospitality" sortKey="hospitality" sort={sort} onSort={toggleSort} className="w-[11%] text-center" align="center" />
              <SortableTh label="Hygiene" sortKey="hygiene" sort={sort} onSort={toggleSort} className="w-[11%] text-center" align="center" />
              <SortableTh label="Complaints" sortKey="complaints" sort={sort} onSort={toggleSort} className="w-[12%] text-center" align="center" />
              <SortableTh label="Composite Score" sortKey="composite" sort={sort} onSort={toggleSort} className="w-[14%] text-center" align="center" />
              <th className="w-[12%] px-4 py-3 text-center font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  No outlets match your search.
                </td>
              </tr>
            ) : (
              pageRows.map((row, i) => (
                <tr key={row.outlet.id} className="border-t border-border/60 transition-colors hover:bg-foreground/20">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold tabular-nums text-muted-foreground ring-1 ring-border">
                        {start + i + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">{row.outlet.name}</p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {row.area} · {row.outlet.code}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="truncate px-4 py-3 text-muted-foreground">{row.coordinator}</td>
                  <td className="px-4 py-3 text-center tabular-nums text-foreground/90">
                    <Skor v={row.hospitality} />
                  </td>
                  <td className="px-4 py-3 text-center tabular-nums text-foreground/90">
                    <Skor v={row.hygiene} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge tone={row.complaints > 0 ? "danger" : "success"}>{row.complaints}</Badge>
                  </td>
                  <td className="px-4 py-3 text-center text-base font-semibold tabular-nums text-foreground">
                    <Skor v={row.composite} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-center">
                      <Link
                        href={`/outlets/${row.outlet.id}`}
                        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        <Eye className="size-3.5" />
                        View
                      </Link>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {total ? start + 1 : 0} to {start + pageRows.length} of {total} results
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={current === 1}
            onClick={() => setPage(current - 1)}
            className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
          >
            Previous
          </button>
          <div className="no-scrollbar flex max-w-[13.5rem] items-center gap-1 overflow-x-auto scroll-smooth">
            {Array.from({ length: pageCount }, (_, idx) => idx + 1).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setPage(n)}
                aria-current={n === current}
                className={cn(
                  "grid size-9 shrink-0 place-items-center rounded-lg text-sm font-medium tabular-nums transition-colors",
                  n === current
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                {n}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={current === pageCount}
            onClick={() => setPage(current + 1)}
            className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

function SortableTh({
  label,
  sortKey,
  sort,
  onSort,
  className,
  align = "left",
}: {
  label: string;
  sortKey: SortKey;
  sort: { key: SortKey; dir: "asc" | "desc" };
  onSort: (k: SortKey) => void;
  className?: string;
  align?: "left" | "center";
}) {
  const active = sort.key === sortKey;
  const Icon = active ? (sort.dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <th className={cn("px-4 py-3 font-medium", className)}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          "inline-flex items-center gap-1 transition-colors hover:text-foreground",
          align === "center" && "justify-center",
          active && "text-foreground",
        )}
      >
        {label}
        <Icon className={cn("size-3.5", active ? "opacity-100" : "opacity-40")} />
      </button>
    </th>
  );
}
