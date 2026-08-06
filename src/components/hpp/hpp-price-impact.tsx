"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, BellOff, CheckCircle2, ChevronDown, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { bulkClearAlertsAction, clearIngredientAlertAction } from "@/lib/actions/hpp-ingredients";
import type { AffectedMenu, HppPriceAlerts } from "@/lib/data/hpp-alerts";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/hpp/motion";
import { cn } from "@/lib/utils";

const rp = (n: number) => "Rp " + Math.round(n || 0).toLocaleString("id-ID");
const pct = (n: number) => `${n >= 0 ? "+" : ""}${(n * 100).toFixed(1)}%`;

const TONE_TEXT: Record<string, string> = {
  good: "text-emerald-600 dark:text-emerald-400",
  warn: "text-amber-600 dark:text-amber-400",
  bad: "text-red-600 dark:text-red-400",
};
const TONE_PILL: Record<string, string> = {
  good: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
  warn: "bg-amber-500/12 text-amber-600 dark:text-amber-400",
  bad: "bg-red-500/12 text-red-600 dark:text-red-400",
};

/**
 * Lampiran no.11 makalah HPP: "Update HPP jika bahan naik >5% — dilakukan untuk
 * semua menu terkait". Panel ini menutup lingkarannya: bukan sekadar menandai
 * bahan yang naik, tapi menghitung ulang HPP tiap menu yang memakainya dengan
 * harga terbaru, lalu menampilkan selisihnya supaya tim tahu menu mana yang
 * harus ditinjau (dan mana yang berubah jadi over cost).
 */
export function HppPriceImpact({ alerts, canEdit }: { alerts: HppPriceAlerts; canEdit: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(true);

  const { ingredients, menus } = alerts;
  if (ingredients.length === 0) return null;

  const overCost = menus.filter((m) => m.status.tone === "bad").length;
  const naik = menus.filter((m) => m.selisih > 0).length;

  async function clearOne(id: string, name: string) {
    setBusy(id);
    const res = await clearIngredientAlertAction(id);
    setBusy(null);
    if ("error" in res && res.error) return toast.error(res.error);
    toast.success(`${name} ditandai sudah ditinjau`);
    router.refresh();
  }

  async function clearAll() {
    setBusy("all");
    const res = await bulkClearAlertsAction(ingredients.map((i) => i.id));
    setBusy(null);
    if ("error" in res && res.error) return toast.error(res.error);
    toast.success(`${ingredients.length} bahan ditandai sudah ditinjau`);
    router.refresh();
  }

  return (
    <Reveal className="glass overflow-hidden rounded-2xl border border-amber-500/30">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-3 bg-amber-500/10 p-4 text-left transition-colors hover:bg-amber-500/15"
      >
        <TrendingUp className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">
            {ingredients.length} bahan naik &gt;5% · {menus.length} menu perlu update HPP
          </p>
          <p className="mt-0.5 text-xs text-amber-700/80 dark:text-amber-300/80">
            {naik} menu HPP-nya naik
            {overCost > 0 && ` · ${overCost} menu jadi over cost`} — hitung ulang di Kalkulator HPP, lalu tandai sudah
            ditinjau.
          </p>
        </div>
        <ChevronDown
          className={cn("mt-0.5 size-4 shrink-0 text-amber-600 transition-transform dark:text-amber-400", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="space-y-4 border-t border-amber-500/20 p-4">
          {/* Bahan pemicu */}
          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bahan pemicu</p>
              {canEdit && ingredients.length > 1 && (
                <Button variant="ghost" size="sm" onClick={clearAll} disabled={busy !== null}>
                  <BellOff className="size-3.5" /> Tandai semua ditinjau
                </Button>
              )}
            </div>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {ingredients.map((i) => {
                const used = menus.filter((m) => m.triggers.includes(i.name)).length;
                return (
                  <div key={i.id} className="rounded-xl border border-border bg-card/60 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{i.name}</p>
                        <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                          {i.prevPrice != null ? rp(i.prevPrice) : "—"} <ArrowRight className="inline size-3" /> {rp(i.buyPrice)}
                          <span className="text-muted-foreground/70"> / {i.buyQty} {i.buyUnit}</span>
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-red-500/12 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-red-600 dark:text-red-400">
                        {pct(i.risePct)}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <p className="text-[11px] text-muted-foreground">{used} menu terdampak</p>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => clearOne(i.id, i.name)}
                          disabled={busy !== null}
                          className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                        >
                          <CheckCircle2 className="size-3" /> {busy === i.id ? "..." : "Sudah ditinjau"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Dampak ke HPP menu */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Dampak ke HPP menu</p>
            {menus.length === 0 ? (
              <p className="rounded-xl border border-border bg-card/60 p-3 text-xs text-muted-foreground">
                Belum ada menu tersimpan yang memakai bahan ini — HPP tidak berubah.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="border-b border-border bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2.5 font-medium">Menu</th>
                      <th className="px-3 py-2.5 text-right font-medium">HPP lama</th>
                      <th className="px-3 py-2.5 text-right font-medium">HPP baru</th>
                      <th className="px-3 py-2.5 text-right font-medium">Selisih</th>
                      <th className="px-3 py-2.5 text-right font-medium">HPP %</th>
                      <th className="px-3 py-2.5 font-medium">Status</th>
                      <th className="px-3 py-2.5 font-medium">Pemicu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {menus.map((m) => (
                      <MenuRow key={m.id} m={m} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </Reveal>
  );
}

function MenuRow({ m }: { m: AffectedMenu }) {
  const naik = m.selisih > 0;
  return (
    <tr className="border-b border-border/60 last:border-0 hover:bg-muted/30">
      <td className="px-3 py-2.5">
        <Link href={`/rnd/hpp?edit=${m.id}`} className="font-medium text-foreground hover:underline">
          {m.name}
        </Link>
        <p className="text-[11px] text-muted-foreground">
          {m.brand} · {m.category} · jual {rp(m.chosenPrice)}
        </p>
      </td>
      <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{rp(m.hppLama)}</td>
      <td className="px-3 py-2.5 text-right font-medium tabular-nums text-foreground">{rp(m.hppBaru)}</td>
      <td className={cn("px-3 py-2.5 text-right font-medium tabular-nums", naik ? TONE_TEXT.bad : TONE_TEXT.good)}>
        {naik ? "+" : "−"}
        {rp(Math.abs(m.selisih))}
        <span className="block text-[11px] font-normal opacity-80">{pct(m.selisihPct)}</span>
      </td>
      <td className="px-3 py-2.5 text-right tabular-nums">
        <span className="text-muted-foreground">{m.hppPctLama > 0 ? `${(m.hppPctLama * 100).toFixed(0)}%` : "—"}</span>
        <ArrowRight className="mx-1 inline size-3 text-muted-foreground" />
        <span className={cn("font-medium", TONE_TEXT[m.status.tone])}>
          {m.hppPctBaru > 0 ? `${(m.hppPctBaru * 100).toFixed(0)}%` : "—"}
        </span>
      </td>
      <td className="px-3 py-2.5">
        <span className={cn("inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold", TONE_PILL[m.status.tone])}>
          {m.status.label}
        </span>
      </td>
      <td className="px-3 py-2.5 text-[11px] text-muted-foreground">{m.triggers.join(", ")}</td>
    </tr>
  );
}
