"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Download, FileUp, Loader2, Save, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EXPENSE_COLS, EXPENSE_LABELS, expenseTotal, type ExpenseCol, type ExpenseRow } from "@/lib/ops/categories";
import { saveExpensesAction } from "@/lib/actions/ops-finance";
import { cn } from "@/lib/utils";

const rp = (n: number) => "Rp" + Math.round(n || 0).toLocaleString("id-ID");
const monthLabel = (m: string) => {
  const [y, mo] = m.split("-").map(Number);
  return new Date(y, mo - 1, 1).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
};
const shiftMonth = (m: string, by: number) => {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(y, mo - 1 + by, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export function OpsBeban({ month, rows: initial }: { month: string; rows: ExpenseRow[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const [rows, setRows] = React.useState<ExpenseRow[]>(initial);
  const [q, setQ] = React.useState("");
  const [dirty, setDirty] = React.useState(false);
  const [pending, start] = React.useTransition();
  const fileRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => { setRows(initial); setDirty(false); }, [initial]);

  const goMonth = (m: string) => router.push(`${pathname}?month=${m}`);

  function setCell(code: string, col: ExpenseCol, v: number) {
    setRows((rs) => rs.map((r) => (r.outletCode === code ? { ...r, [col]: v } : r)));
    setDirty(true);
  }

  function save() {
    start(async () => {
      const res = await saveExpensesAction(month, rows);
      if (res?.error) toast.error(res.error);
      else { toast.success(`Tersimpan ${res?.count ?? 0} outlet untuk ${monthLabel(month)}.`); setDirty(false); router.refresh(); }
    });
  }

  async function downloadTemplate() {
    const XLSX = await import("xlsx");
    const data = rows.map((r) => {
      const o: Record<string, string | number> = { Kode: r.outletCode, Outlet: r.outletName };
      for (const c of EXPENSE_COLS) o[EXPENSE_LABELS[c]] = r[c];
      return o;
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Beban");
    XLSX.writeFile(wb, `beban-operasional-${month}.xlsx`);
  }

  async function onExcel(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const XLSX = await import("xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
      const byCode = new Map(rows.map((r) => [r.outletCode, { ...r }]));
      const labelToCol = new Map(EXPENSE_COLS.map((c) => [EXPENSE_LABELS[c].toLowerCase(), c]));
      let hit = 0;
      for (const raw of json) {
        const code = String(raw["Kode"] ?? raw["kode"] ?? "").trim();
        const row = byCode.get(code);
        if (!row) continue;
        hit++;
        for (const [k, v] of Object.entries(raw)) {
          const col = labelToCol.get(k.trim().toLowerCase());
          if (col) row[col] = Number(String(v).replace(/[^\d.-]/g, "")) || 0;
        }
      }
      if (hit === 0) { toast.error("Tidak ada baris cocok (cek kolom 'Kode'). Pakai template."); return; }
      setRows([...byCode.values()]);
      setDirty(true);
      toast.success(`${hit} outlet dibaca dari Excel — tinjau lalu klik Simpan.`);
    } catch {
      toast.error("Gagal membaca file. Pastikan format .xlsx dari template.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const filtered = rows.filter((r) => r.outletName.toLowerCase().includes(q.toLowerCase()) || r.outletCode.toLowerCase().includes(q.toLowerCase()));
  const grand: Record<ExpenseCol, number> = Object.fromEntries(EXPENSE_COLS.map((c) => [c, rows.reduce((a, r) => a + (r[c] || 0), 0)])) as Record<ExpenseCol, number>;
  const grandTotal = rows.reduce((a, r) => a + expenseTotal(r), 0);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-xl border border-border bg-card p-1">
          <button onClick={() => goMonth(shiftMonth(month, -1))} className="grid size-8 place-items-center rounded-lg hover:bg-muted"><ChevronLeft className="size-4" /></button>
          <span className="px-2 text-sm font-medium text-foreground">{monthLabel(month)}</span>
          <button onClick={() => goMonth(shiftMonth(month, 1))} className="grid size-8 place-items-center rounded-lg hover:bg-muted"><ChevronRight className="size-4" /></button>
        </div>
        <div className="relative min-w-40 max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari outlet…" className="w-full rounded-lg border border-border bg-transparent py-2 pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground" />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-1.5"><Download className="size-3.5" /> Template Excel</Button>
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} className="gap-1.5"><FileUp className="size-3.5" /> Import Excel</Button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={onExcel} className="hidden" />
          <Button size="sm" onClick={save} disabled={pending || !dirty} className="gap-1.5">{pending ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />} Simpan</Button>
        </div>
      </div>

      {/* Editable table */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[64rem] border-collapse text-sm">
          <thead>
            <tr className="bg-muted/60 text-xs text-muted-foreground">
              <th className="sticky left-0 z-10 bg-muted/60 px-3 py-3 text-left font-medium">Outlet</th>
              {EXPENSE_COLS.map((c) => <th key={c} className="px-2 py-3 text-right font-medium">{EXPENSE_LABELS[c]}</th>)}
              <th className="px-3 py-3 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.outletCode} className="border-t border-border/60 hover:bg-foreground/5">
                <td className="sticky left-0 z-10 bg-card px-3 py-2">
                  <p className="truncate font-medium text-foreground">{r.outletName}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{r.outletCode}</p>
                </td>
                {EXPENSE_COLS.map((c) => (
                  <td key={c} className="px-1 py-1">
                    <input
                      type="number"
                      value={r[c] || ""}
                      onChange={(e) => setCell(r.outletCode, c, Number(e.target.value) || 0)}
                      className="w-28 rounded-md border border-transparent bg-transparent px-2 py-1.5 text-right text-[13px] tabular-nums outline-none hover:border-border focus:border-primary focus:bg-muted/30"
                      placeholder="0"
                    />
                  </td>
                ))}
                <td className="px-3 py-2 text-right text-[13px] font-semibold tabular-nums text-foreground">{rp(expenseTotal(r))}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border bg-muted/40 text-[13px] font-semibold text-foreground">
              <td className="sticky left-0 z-10 bg-muted/40 px-3 py-2.5">Total ({rows.length} outlet)</td>
              {EXPENSE_COLS.map((c) => <td key={c} className="px-2 py-2.5 text-right tabular-nums">{rp(grand[c])}</td>)}
              <td className="px-3 py-2.5 text-right tabular-nums">{rp(grandTotal)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p className={cn("text-[12px]", dirty ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>
        {dirty ? "Ada perubahan belum disimpan — klik Simpan." : "Angka nominal Rupiah per bulan. Data ini mengisi kartu Beban Operasional & Laba Bersih di Dashboard."}
      </p>
    </div>
  );
}
