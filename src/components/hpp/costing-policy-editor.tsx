"use client";

import * as React from "react";
import { toast } from "sonner";
import { ChevronDown, Percent, RotateCcw, Save, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { saveCostingPolicyAction, deleteCostingPolicyAction } from "@/lib/actions/costing-policy";

export type PolicyRow = {
  scope: string;
  foodPct: number;
  bevPct: number;
  foodMarginMin: number;
  foodMarginMax: number;
  bevMarginMin: number;
  bevMarginMax: number;
};

const DEFAULTS: Omit<PolicyRow, "scope"> = { foodPct: 35, bevPct: 25, foodMarginMin: 35, foodMarginMax: 50, bevMarginMin: 60, bevMarginMax: 100 };

/** Costing policy settings: company default + per-brand overrides. Two things
 *  are set per category — target food cost % (health) and the selling-price
 *  margin band (min–max, drives price suggestions). Verifier-only. */
export function CostingPolicyEditor({ initial, brands, canEdit }: { initial: PolicyRow[]; brands: string[]; canEdit: boolean }) {
  const [open, setOpen] = React.useState(false);
  const [rows, setRows] = React.useState<Record<string, PolicyRow>>(() => Object.fromEntries(initial.map((p) => [p.scope, p])));
  const [pending, start] = React.useTransition();

  const def = rows["default"] ?? { scope: "default", ...DEFAULTS };
  const get = (scope: string): PolicyRow => rows[scope] ?? { ...def, scope };
  const isCustom = (scope: string) => scope !== "default" && !!rows[scope];

  const setVal = (scope: string, key: keyof Omit<PolicyRow, "scope">, v: number) =>
    setRows((r) => ({ ...r, [scope]: { ...get(scope), scope, [key]: v } }));

  const save = (scope: string) => {
    const row = get(scope);
    start(async () => {
      const res = await saveCostingPolicyAction({ scope, foodPct: row.foodPct, bevPct: row.bevPct, foodMarginMin: row.foodMarginMin, foodMarginMax: row.foodMarginMax, bevMarginMin: row.bevMarginMin, bevMarginMax: row.bevMarginMax });
      if (res?.error) { toast.error(res.error); return; }
      toast.success(scope === "default" ? "Kebijakan default disimpan" : `Kustom ${scope} disimpan`);
    });
  };
  const reset = (scope: string) => {
    start(async () => {
      const res = await deleteCostingPolicyAction(scope);
      if (res?.error) { toast.error(res.error); return; }
      setRows((r) => { const n = { ...r }; delete n[scope]; return n; });
      toast.success(`${scope} kembali ke default`);
    });
  };

  return (
    <div className="glass rounded-2xl border border-border p-4">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2 text-left">
        <SlidersHorizontal className="size-4 text-primary" />
        <span className="text-sm font-semibold text-foreground">Kebijakan Costing — Food Cost &amp; Margin Harga</span>
        <span className="ml-1 hidden rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline">
          Margin Food {def.foodMarginMin}–{def.foodMarginMax}% · Bev {def.bevMarginMin}–{def.bevMarginMax}%
        </span>
        <ChevronDown className={cn("ml-auto size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="mt-4 space-y-3">
          <p className="text-[11px] text-muted-foreground">
            <b>Target food cost</b> = indikator sehat (COGS ÷ harga jual). <b>Band margin</b> = dasar saran harga jual (mulai dari margin minimum).
            Default = kebijakan perusahaan; per brand bisa di-<b>custom</b>. {canEdit ? "" : "Hanya Head R&D / Admin yang dapat mengubah."}
          </p>

          <PolicyCard title="Default Perusahaan" badge="Baseline" row={def} disabled={!canEdit || pending} onChange={(k, v) => setVal("default", k, v)} onSave={canEdit ? () => save("default") : undefined} />

          <div className="grid gap-2 lg:grid-cols-2">
            {brands.map((b) => {
              const custom = isCustom(b);
              return (
                <PolicyCard
                  key={b}
                  title={b}
                  badge={custom ? "Custom" : "Ikut default"}
                  badgeTone={custom ? "info" : undefined}
                  row={get(b)}
                  disabled={!canEdit || pending}
                  onChange={(k, v) => setVal(b, k, v)}
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
  onChange,
  onSave,
  onReset,
}: {
  title: string;
  badge: string;
  badgeTone?: "info";
  row: PolicyRow;
  disabled?: boolean;
  onChange: (key: keyof Omit<PolicyRow, "scope">, v: number) => void;
  onSave?: () => void;
  onReset?: () => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/20 p-3">
      <div className="mb-2.5 flex items-center gap-2">
        <span className="text-[13px] font-semibold text-foreground">{title}</span>
        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", badgeTone === "info" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>{badge}</span>
        <div className="ml-auto flex items-center gap-1">
          {onReset && (
            <button type="button" onClick={onReset} disabled={disabled} title="Kembalikan ke default" className="grid size-7 place-items-center rounded-lg text-muted-foreground hover:bg-muted/60 hover:text-foreground disabled:opacity-40">
              <RotateCcw className="size-3.5" />
            </button>
          )}
          {onSave && <Button size="sm" variant="outline" onClick={onSave} disabled={disabled}><Save className="size-3.5" /> Simpan</Button>}
        </div>
      </div>
      <div className="grid gap-2.5 sm:grid-cols-2">
        <CategoryBlock
          label="Makanan (Food)"
          target={row.foodPct}
          min={row.foodMarginMin}
          max={row.foodMarginMax}
          disabled={disabled}
          onTarget={(v) => onChange("foodPct", v)}
          onMin={(v) => onChange("foodMarginMin", v)}
          onMax={(v) => onChange("foodMarginMax", v)}
        />
        <CategoryBlock
          label="Minuman (Beverage)"
          target={row.bevPct}
          min={row.bevMarginMin}
          max={row.bevMarginMax}
          disabled={disabled}
          onTarget={(v) => onChange("bevPct", v)}
          onMin={(v) => onChange("bevMarginMin", v)}
          onMax={(v) => onChange("bevMarginMax", v)}
        />
      </div>
    </div>
  );
}

function CategoryBlock({ label, target, min, max, disabled, onTarget, onMin, onMax }: { label: string; target: number; min: number; max: number; disabled?: boolean; onTarget: (v: number) => void; onMin: (v: number) => void; onMax: (v: number) => void }) {
  return (
    <div className="rounded-lg border border-border/70 bg-background/40 p-2.5">
      <p className="mb-1.5 text-[11px] font-semibold text-foreground">{label}</p>
      <PctField label="Target Food Cost" value={target} onChange={onTarget} disabled={disabled} />
      <div className="mt-1.5 grid grid-cols-2 gap-2">
        <PctField label="Margin Min" value={min} onChange={onMin} disabled={disabled} />
        <PctField label="Margin Max" value={max} onChange={onMax} disabled={disabled} />
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
          max={95}
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
