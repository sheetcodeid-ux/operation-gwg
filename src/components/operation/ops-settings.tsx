"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Gauge, Loader2, Save, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EXPENSE_COLS, EXPENSE_LABELS } from "@/lib/ops/categories";
import { type OpsSettings } from "@/lib/ops/settings-types";
import { saveSettingsAction } from "@/lib/actions/ops-settings";

function NumField({ label, value, onChange, suffix = "%" }: { label: string; value: number; onChange: (v: number) => void; suffix?: string }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
      <span className="text-[13px] text-foreground">{label}</span>
      <span className="flex items-center gap-1">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          className="w-20 rounded-md border border-border bg-transparent px-2 py-1 text-right text-[13px] tabular-nums outline-none focus:border-primary"
        />
        <span className="text-[12px] text-muted-foreground">{suffix}</span>
      </span>
    </label>
  );
}

export function OpsSettingsForm({ initial }: { initial: OpsSettings }) {
  const router = useRouter();
  const [s, setS] = React.useState<OpsSettings>(initial);
  const [pending, start] = React.useTransition();

  function save() {
    start(async () => {
      const res = await saveSettingsAction(s);
      if (res?.error) toast.error(res.error);
      else { toast.success("Pengaturan tersimpan — indikator Dashboard diperbarui."); router.refresh(); }
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Beban thresholds */}
        <Card className="p-5 lg:col-span-1">
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground"><AlertTriangle className="size-4 text-muted-foreground" /> Threshold Beban (% omset)</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Bar beban melebihi batas → merah (Juknis 6.1)</p>
          <div className="mt-3 space-y-1.5">
            {EXPENSE_COLS.map((c) => (
              <NumField key={c} label={EXPENSE_LABELS[c]} value={s.expenseThresholds[c]} onChange={(v) => setS((p) => ({ ...p, expenseThresholds: { ...p.expenseThresholds, [c]: v } }))} />
            ))}
          </div>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          {/* Margin bands */}
          <Card className="p-5">
            <p className="flex items-center gap-2 text-sm font-semibold text-foreground"><Gauge className="size-4 text-muted-foreground" /> Threshold Distribusi Margin</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Klasifikasi kesehatan margin cabang (Juknis 6.2)</p>
            <div className="mt-3 grid gap-1.5 sm:grid-cols-3">
              <NumField label="Sehat ≥" value={s.marginBands.sehat} onChange={(v) => setS((p) => ({ ...p, marginBands: { ...p.marginBands, sehat: v } }))} />
              <NumField label="Cukup ≥" value={s.marginBands.cukup} onChange={(v) => setS((p) => ({ ...p, marginBands: { ...p.marginBands, cukup: v } }))} />
              <NumField label="Kritis <" value={s.marginBands.kritis} onChange={(v) => setS((p) => ({ ...p, marginBands: { ...p.marginBands, kritis: v } }))} />
            </div>
          </Card>

          {/* Purchase limits */}
          <Card className="p-5">
            <p className="flex items-center gap-2 text-sm font-semibold text-foreground"><ShoppingCart className="size-4 text-muted-foreground" /> Batas Pembelian vs Omset</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Dipakai kartu Rencana Pengeluaran (Juknis 2.11 / 6.3)</p>
            <div className="mt-3 grid gap-1.5 sm:grid-cols-3">
              <NumField label="Warehouse maks" value={s.purchaseLimits.warehouse} onChange={(v) => setS((p) => ({ ...p, purchaseLimits: { ...p.purchaseLimits, warehouse: v } }))} />
              <NumField label="Non-WH maks" value={s.purchaseLimits.nonWarehouse} onChange={(v) => setS((p) => ({ ...p, purchaseLimits: { ...p.purchaseLimits, nonWarehouse: v } }))} />
              <NumField label="Rasio Total maks" value={s.purchaseLimits.total} onChange={(v) => setS((p) => ({ ...p, purchaseLimits: { ...p.purchaseLimits, total: v } }))} />
            </div>
          </Card>

          <div className="flex justify-end">
            <Button onClick={save} disabled={pending} className="gap-1.5">{pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Simpan Pengaturan</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
