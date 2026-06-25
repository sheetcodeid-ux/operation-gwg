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
import { ArrowUpDown, ChevronLeft, ChevronRight, Rows2, Rows3, Search, SlidersHorizontal } from "lucide-react";
import { Input } from "./input";
import { Popover } from "./popover";
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
  const [dense, setDense] = React.useState(false);

  // Restore persisted preferences (post-hydration to avoid SSR mismatch).
  React.useEffect(() => {
    if (!tableId || typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(`tbl:${tableId}`);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved.visibility) setColumnVisibility(saved.visibility);
        if (typeof saved.dense === "boolean") setDense(saved.dense);
      }
    } catch {}
  }, [tableId]);

  React.useEffect(() => {
    if (!tableId || typeof window === "undefined") return;
    localStorage.setItem(`tbl:${tableId}`, JSON.stringify({ visibility: columnVisibility, dense }));
  }, [tableId, columnVisibility, dense]);

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

  const cellPad = dense ? "px-3 py-1.5" : "px-3 py-2.5";
  const hideableColumns = table.getAllLeafColumns().filter((c) => typeof c.columnDef.header === "string" && c.columnDef.header !== "");

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder={searchPlaceholder}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          {toolbar}
          <button
            onClick={() => setDense((d) => !d)}
            title={dense ? "Comfortable" : "Compact"}
            className="grid size-9 place-items-center rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {dense ? <Rows3 className="size-4" /> : <Rows2 className="size-4" />}
          </button>
          {hideableColumns.length > 0 && (
            <Popover
              contentClassName="w-52"
              trigger={({ toggle }) => (
                <button
                  onClick={toggle}
                  title="Columns"
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <SlidersHorizontal className="size-4" /> Columns
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
        <table className="w-full text-sm">
          <thead className={cn(stickyHeader && "sticky top-0 z-10")}>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-border bg-muted/80 backdrop-blur supports-[backdrop-filter]:bg-muted/60">
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
                <tr key={row.id} className="border-b border-border/60 last:border-0 transition-colors hover:bg-muted/40">
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

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {table.getFilteredRowModel().rows.length} record{table.getFilteredRowModel().rows.length === 1 ? "" : "s"}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="grid size-7 place-items-center rounded-md hover:bg-muted disabled:opacity-40"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="tabular-nums">
            {table.getState().pagination.pageIndex + 1} / {table.getPageCount() || 1}
          </span>
          <button
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="grid size-7 place-items-center rounded-md hover:bg-muted disabled:opacity-40"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
