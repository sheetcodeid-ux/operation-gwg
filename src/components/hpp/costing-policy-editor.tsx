"use client";

import * as React from "react";
import { toast } from "sonner";
import { ChevronDown, Percent, RotateCcw, Save, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { saveCostingPolicyAction, deleteCostingPolicyAction } from "@/lib/actions/costing-policy";

export type PolicyRow = { scope: string; foodPct: number; bevPct: number };

/** Costing policy settings: company default + per-brand overrides for the
 *  target food-cost % (Food / Beverage). Verifier-only. Compact, collapsible,
 *  matches the app's glass-card style. */
export function CostingPolicyEditor({ initial, brands, canEdit }: { initial: PolicyRow[]; brands: string[]; canEdit: boolean }) {
  const [open, setOpen] = React.useState(false);
  const [rows, setRows] = React.useState<Record<string, PolicyRow>>(() => Object.fromEntries(initial.map((p) => [p.scope, p])));
  const [pending, start] = React.useTransition();

  const def = rows["default"] ?? { scope: "default", foodPct: 35, bevPct: 25 };
  const get = (scope: string): PolicyRow => rows[scope] ?? { scope, foodPct: def.foodPct, bevPct: def.bevPct };
  const isCustom = (scope: string) => scope !== "default" && !!rows[scope];

  const setVal = (scope: string, key: "foodPct" | "bevPct", v: number) =>
    setRows((r) => ({ ...r, [scope]: { ...get(scope), scope, [key]: v } }));

  const save = (scope: string) => {
    const row = get(scope);
    start(async () => {
      const res = await saveCostingPolicyAction({ scope, foodPct: row.foodPct, bevPct: row.bevPct });
      if (res?.error) { toast.error(res.error); return; }
      toast.success(scope === "default" ? "Kebijakan default disimpan" : `Kustom ${scope} disimpan`);
    });
  };
  const reset = (scope: string) => {
    start(async () => {
      const res = await deleteCostingPolicyAction(scope);
      if (res?.error) { toast.error(res.error); return; }
      setRows((r) => {
        const n = { ...r };
        delete n[scope];
        return n;
      });
      toast.success(`${scope} kembali ke default`);
    });
  };

  return (
    <div className="glass rounded-2xl border border-border p-4">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2 text-left">
        <SlidersHorizontal className="size-4 text-primary" />
        <span className="text-sm font-semibold text-foreground">Kebijakan Costing — Target Food Cost %</span>
        <span className="ml-1 hidden rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline">
          Default Food {def.foodPct}% · Bev {def.bevPct}%
        </span>
        <ChevronDown className={cn("ml-auto size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="mt-4 space-y-3">
          <p className="text-[11px] text-muted-foreground">
            Target food cost (COGS ÷ harga jual) yang dipakai untuk indikator sehat menu &amp; saran harga. Default = kebijakan perusahaan;
            per brand bisa di-<b>custom</b> (override). {canEdit ? "" : "Hanya Head R&D / Admin yang dapat mengubah."}
          </p>

          {/* Default */}
          <PolicyCard
            title="Default Perusahaan"
            badge="Baseline"
            row={def}
            disabled={!canEdit || pending}
            onFood={(v) => setVal("default", "foodPct", v)}
            onBev={(v) => setVal("default", "bevPct", v)}
            onSave={canEdit ? () => save("default") : undefined}
          />

          {/* Brand overrides */}
          <div className="grid gap-2 sm:grid-cols-2">
            {brands.map((b) => {
              const row = get(b);
              const custom = isCustom(b);
              return (
                <PolicyCard
                  key={b}
                  title={b}
                  badge={custom ? "Custom" : "Ikut default"}
                  badgeTone={custom ? "info" : undefined}
                  row={row}
                  disabled={!canEdit || pending}
                  onFood={(v) => setVal(b, "foodPct", v)}
                  onBev={(v) => setVal(b, "bevPct", v)}
                  onSave={canEdit ? () => save(b) : undefined}
                  onReset={canEdit && custom ? () => reset(b) : undefined}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function PolicyCard({
  title,
  badge,
  badgeTone,
  row,
  disabled,
  onFood,
  onBev,
  onSave,
  onReset,
}: {
  title: string;
  badge: string;
  badgeTone?: "info";
  row: PolicyRow;
  disabled?: boolean;
  onFood: (v: number) => void;
  onBev: (v: number) => void;
  onSave?: () => void;
  onReset?: () => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/20 p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[13px] font-semibold text-foreground">{title}</span>
        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", badgeTone === "info" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>{badge}</span>
        <div className="ml-auto flex items-center gap-1">
          {onReset && (
            <button type="button" onClick={onReset} disabled={disabled} title="Kembalikan ke default" className="grid size-7 place-items-center rounded-lg text-muted-foreground hover:bg-muted/60 hover:text-foreground disabled:opacity-40">
              <RotateCcw className="size-3.5" />
            </button>
          )}
          {onSave && (
            <Button size="sm" variant="outline" onClick={onSave} disabled={disabled}>
              <Save className="size-3.5" /> Simpan
            </Button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <PctField label="Food" value={row.foodPct} onChange={onFood} disabled={disabled} />
        <PctField label="Beverage" value={row.bevPct} onChange={onBev} disabled={disabled} />
      </div>
    </div>
  );
}

function PctField({ label, value, onChange, disabled }: { label: string; value: number; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 focus-within:ring-2 focus-within:ring-ring">
        <input
          type="number"
          min={1}
          max={90}
          step={0.5}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-9 w-full bg-transparent text-sm tabular-nums outline-none disabled:opacity-60"
        />
        <Percent className="size-3.5 shrink-0 text-muted-foreground" />
      </span>
    </label>
  );
}
