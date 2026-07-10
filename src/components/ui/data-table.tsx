"use client";

import * as React from "react";
import {
  type ColumnDef,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowUpDown, Download, Search, SlidersHorizontal } from "lucide-react";
import { Input } from "./input";
import { Popover } from "./popover";
import { downloadCsv, toCsv } from "@/lib/csv";
import { cn } from "@/lib/utils";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  searchPlaceholder?: string;
  toolbar?: React.ReactNode;
  pageSize?: number;
  /** Stable id to persist column visibility + density to localStorage. */
  tableId?: string;
  /** Sticky header on vertical scroll (default true). */
  stickyHeader?: boolean;
  maxHeight?: string;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchPlaceholder = "Search…",
  toolbar,
  pageSize = 10,
  tableId,
  stickyHeader = true,
  maxHeight = "62vh",
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = React.useState("");
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});

  // Restore persisted preferences (post-hydration to avoid SSR mismatch).
  React.useEffect(() => {
    if (!tableId || typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(`tbl:${tableId}`);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved.visibility) setColumnVisibility(saved.visibility);
      }
    } catch {}
  }, [tableId]);

  React.useEffect(() => {
    if (!tableId || typeof window === "undefined") return;
    localStorage.setItem(`tbl:${tableId}`, JSON.stringify({ visibility: columnVisibility }));
  }, [tableId, columnVisibility]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter, columnVisibility },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  });

  const cellPad = "px-3 py-2"; // always compact
  const hideableColumns = table.getAllLeafColumns().filter((c) => typeof c.columnDef.header === "string" && c.columnDef.header !== "");

  // Export the CURRENT view (all filtered+sorted rows across every page),
  // visible data columns only (string headers with an accessor).
  function exportCsv() {
    const cols = table
      .getVisibleLeafColumns()
      .filter((c) => typeof c.columnDef.header === "string" && c.columnDef.header !== "" && c.accessorFn);
    const headers = cols.map((c) => c.columnDef.header as string);
    const rows = table.getSortedRowModel().rows.map((row) =>
      cols.map((c) => {
        const v = row.getValue(c.id);
        if (v == null) return "";
        if (Array.isArray(v)) return v.join("; ");
        if (typeof v === "object") return JSON.stringify(v);
        return v as string | number | boolean;
      }),
    );
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`${tableId ?? "export"}-${stamp}`, toCsv(headers, rows));
  }

  const total = table.getFilteredRowModel().rows.length;
  const pageIndex = table.getState().pagination.pageIndex;
  const curPageSize = table.getState().pagination.pageSize;
  const pageCount = table.getPageCount() || 1;
  const from = total ? pageIndex * curPageSize + 1 : 0;
  const to = pageIndex * curPageSize + table.getRowModel().rows.length;

  // Keep the active page button in view within the scrollable (≈5-wide) strip.
  const pagerRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    pagerRef.current?.querySelector('[aria-current="true"]')?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [pageIndex]);

  return (
    <div className="space-y-3">
      {/* One row: filters swipe horizontally on small screens (instead of
          crushing to tiny chevrons); search + columns collapse to icons. */}
      <div className="flex items-center gap-2">
        {/* Filters — horizontal scroller (portal dropdowns escape the clip). */}
        {toolbar && <div className="no-scrollbar -mx-0.5 flex min-w-0 flex-1 items-center gap-2 overflow-x-auto px-0.5 py-0.5">{toolbar}</div>}

        <div className={cn("flex shrink-0 items-center gap-2", !toolbar && "ml-auto")}>
          <button
            onClick={exportCsv}
            title="Export to Excel (CSV)"
            className="grid size-9 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Download className="size-4" />
          </button>
          {/* Search: inline field on ≥sm; a search icon that opens a field on mobile. */}
          <div className="relative hidden w-52 sm:block lg:w-60">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={globalFilter} onChange={(e) => setGlobalFilter(e.target.value)} placeholder={searchPlaceholder} className="pl-9" />
          </div>
          <div className="sm:hidden">
            <Popover
              portal
              align="end"
              contentClassName="w-[min(20rem,calc(100vw-1.5rem))]"
              trigger={({ toggle, open }) => (
                <button
                  onClick={toggle}
                  aria-expanded={open}
                  title="Cari"
                  className={cn(
                    "grid size-9 shrink-0 place-items-center rounded-lg border border-border transition-colors hover:bg-muted hover:text-foreground",
                    globalFilter ? "border-primary text-primary" : "text-muted-foreground",
                  )}
                >
                  <Search className="size-4" />
                </button>
              )}
            >
              <div className="relative p-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
                <input
                  autoFocus
                  value={globalFilter}
                  onChange={(e) => setGlobalFilter(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="h-9 w-full rounded-lg bg-transparent pl-9 pr-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                />
              </div>
            </Popover>
          </div>

          {hideableColumns.length > 0 && (
            <Popover
              align="end"
              contentClassName="w-52"
              trigger={({ toggle }) => (
                <button
                  onClick={toggle}
                  title="Columns"
                  className="inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-border px-2.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground sm:px-3"
                >
                  <SlidersHorizontal className="size-4" /> <span className="hidden sm:inline">Columns</span>
                </button>
              )}
            >
              <p className="px-2 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Toggle columns
              </p>
              {hideableColumns.map((col) => (
                <label key={col.id} className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm hover:bg-muted">
                  <input
                    type="checkbox"
                    checked={col.getIsVisible()}
                    onChange={(e) => col.toggleVisibility(e.target.checked)}
                    className="size-4 accent-primary"
                  />
                  <span className="text-foreground/90">{col.columnDef.header as string}</span>
                </label>
              ))}
            </Popover>
          )}
        </div>
      </div>

      <div className="overflow-auto rounded-xl border border-border" style={stickyHeader ? { maxHeight } : undefined}>
        {/* min-w: on phones the table overflows and swipes horizontally instead
            of crushing every column to fit. */}
        <table className="w-full min-w-[44rem] text-sm">
          <thead className={cn(stickyHeader && "sticky top-0 z-10")}>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="whitespace-nowrap border-b border-border bg-muted/70 backdrop-blur supports-[backdrop-filter]:bg-muted/60">
                {hg.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  return (
                    <th key={header.id} className={cn("text-left text-xs font-medium text-muted-foreground", cellPad)}>
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          onClick={header.column.getToggleSortingHandler()}
                          className="inline-flex items-center gap-1 hover:text-foreground"
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          <ArrowUpDown className="size-3 opacity-60" />
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={table.getAllLeafColumns().length} className="px-3 py-10 text-center text-muted-foreground">
                  No results.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="border-b border-border/60 last:border-0 transition-colors hover:bg-foreground/20">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className={cn("text-foreground/90", cellPad)}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {from} to {to} of {total} results
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
          >
            Previous
          </button>
          <div ref={pagerRef} className="no-scrollbar flex max-w-[13.5rem] items-center gap-1 overflow-x-auto scroll-smooth">
            {Array.from({ length: pageCount }, (_, idx) => idx).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => table.setPageIndex(n)}
                aria-current={n === pageIndex}
                className={cn(
                  "grid size-9 shrink-0 place-items-center rounded-lg text-sm font-medium tabular-nums transition-colors",
                  n === pageIndex
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                {n + 1}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
