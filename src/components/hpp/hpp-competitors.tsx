"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowDownRight, ArrowUpRight, ChevronDown, Minus, Plus, Scale, Store, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { saveCompetitorPriceAction, deleteCompetitorPriceAction } from "@/lib/actions/hpp-competitors";
import type { CompetitorInsight, CompetitorPrice, PricePosition } from "@/lib/data/hpp-competitors";
import { Button } from "@/components/ui/button";
import { Field, Input, Label, Textarea } from "@/components/ui/input";
import { StatTile } from "@/components/ui/stat";
import { Combobox } from "@/components/ui/combobox";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useConfirm } from "@/components/ui/confirm";
import { Reveal } from "@/components/hpp/motion";
import { cn } from "@/lib/utils";

const rp = (n: number) => "Rp " + Math.round(n || 0).toLocaleString("id-ID");
const pct = (n: number) => `${n >= 0 ? "+" : ""}${(n * 100).toFixed(1)}%`;
const num = (v: string) => Number(String(v).replace(/[^\d.-]/g, "")) || 0;

const SOURCES = ["GoFood", "GrabFood", "ShopeeFood", "Survei langsung", "Media sosial", "Lainnya"];

const POSITION_META: Record<PricePosition, { label: string; pill: string; icon: typeof ArrowUpRight }> = {
  mahal: { label: "Di atas pasar", pill: "bg-red-500/12 text-red-600 dark:text-red-400", icon: ArrowUpRight },
  kompetitif: { label: "Kompetitif", pill: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400", icon: Minus },
  murah: { label: "Di bawah pasar", pill: "bg-blue-500/12 text-blue-600 dark:text-blue-400", icon: ArrowDownRight },
  "belum-ada-data": { label: "Belum ada pembanding", pill: "bg-muted text-muted-foreground", icon: Minus },
};

type Form = {
  menuId: string;
  menuName: string;
  competitor: string;
  price: string;
  city: string;
  source: string;
  note: string;
  observedAt: string;
};

const today = () => new Date().toISOString().slice(0, 10);
const empty = (): Form => ({ menuId: "", menuName: "", competitor: "", price: "", city: "", source: "GoFood", note: "", observedAt: today() });

export type MenuOption = { id: string; name: string; brand: string };

/**
 * Analytics Harga Kompetitor — menyandingkan harga kita dengan harga pasar,
 * lalu menguji rekomendasinya terhadap HPP. Tanpa uji itu, "turunkan harga"
 * gampang berubah jadi menu yang rugi diam-diam.
 */
export function HppCompetitors({
  insights,
  prices,
  menus,
  canEdit,
}: {
  insights: CompetitorInsight[];
  prices: CompetitorPrice[];
  menus: MenuOption[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const { confirm, dialog } = useConfirm();
  const [form, setForm] = React.useState<Form>(empty);
  const [formOpen, setFormOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [position, setPosition] = React.useState("all");
  const [expanded, setExpanded] = React.useState<string | null>(null);

  const tracked = insights.filter((i) => i.samples > 0);
  const overpriced = tracked.filter((i) => i.position === "mahal");
  const underpriced = tracked.filter((i) => i.position === "murah");
  const avgGap = tracked.length ? tracked.reduce((a, b) => a + b.gapPct, 0) / tracked.length : 0;

  const rows = React.useMemo(
    () => (position === "all" ? insights.filter((i) => i.samples > 0) : insights.filter((i) => i.position === position)),
    [insights, position],
  );

  async function save() {
    if (!form.menuName.trim()) return toast.error("Pilih atau tulis nama menu dulu.");
    if (!form.competitor.trim()) return toast.error("Isi nama kompetitornya.");
    if (num(form.price) <= 0) return toast.error("Harga kompetitor harus lebih dari 0.");
    setSaving(true);
    try {
      const res = await saveCompetitorPriceAction({
        menuId: form.menuId || null,
        menuName: form.menuName.trim(),
        competitor: form.competitor.trim(),
        price: num(form.price),
        city: form.city.trim() || null,
        source: form.source || null,
        note: form.note.trim() || null,
        observedAt: form.observedAt || today(),
      });
      if (res?.error) return toast.error(res.error);
      toast.success("Harga kompetitor dicatat");
      setForm(empty);
      setFormOpen(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function remove(p: CompetitorPrice) {
    if (!(await confirm({ title: `Hapus data ${p.competitor}?`, description: `${p.menuName} · ${rp(p.price)}`, confirmLabel: "Hapus", tone: "danger" }))) return;
    const res = await deleteCompetitorPriceAction(p.id);
    if (res?.error) return toast.error(res.error);
    toast.success("Data dihapus");
    router.refresh();
  }

  const pricesByMenu = React.useMemo(() => {
    const m = new Map<string, CompetitorPrice[]>();
    for (const p of prices) {
      const key = p.menuName.trim().toLowerCase();
      m.set(key, [...(m.get(key) ?? []), p]);
    }
    return m;
  }, [prices]);

  return (
    <div className="space-y-4">
      <Reveal className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={Store} label="Menu Dipantau" value={String(tracked.length)} sub={`${prices.length} data harga`} />
        <StatTile icon={ArrowUpRight} label="Di Atas Pasar" value={String(overpriced.length)} sub={overpriced.length ? "berisiko kalah saing" : "aman"} />
        <StatTile icon={ArrowDownRight} label="Di Bawah Pasar" value={String(underpriced.length)} sub={underpriced.length ? "peluang naikkan harga" : "—"} />
        <StatTile icon={Scale} label="Rata-rata Selisih" value={tracked.length ? pct(avgGap) : "—"} sub="vs harga pasar" />
      </Reveal>

      <div className="flex flex-wrap items-center gap-2">
        {canEdit && (
          <Button
            onClick={() => {
              setForm(empty);
              setFormOpen(true);
            }}
          >
            <Plus className="size-4" /> Catat Harga Kompetitor
          </Button>
        )}
        <div className="w-48 shrink-0">
          <Combobox
            portal
            searchable={false}
            matchTriggerWidth
            value={position}
            onChange={setPosition}
            options={[
              { value: "all", label: "Semua Menu Dipantau" },
              { value: "mahal", label: `Di atas pasar (${overpriced.length})` },
              { value: "kompetitif", label: "Kompetitif" },
              { value: "murah", label: `Di bawah pasar (${underpriced.length})` },
            ]}
          />
        </div>
        <span className="text-[11px] text-muted-foreground">Ambang kemahalan/kemurahan: ±10% dari rata-rata pasar</span>
      </div>

      {rows.length === 0 ? (
        <div className="glass rounded-2xl border border-border px-4 py-12 text-center text-sm text-muted-foreground">
          Belum ada data harga kompetitor. Catat harga menu sejenis di GoFood/GrabFood atau survei langsung, lalu sistem
          menghitung posisi harga kita otomatis.
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((i) => {
            const key = i.menuId ?? i.menuName;
            const meta = POSITION_META[i.position];
            const Icon = meta.icon;
            const open = expanded === key;
            const detail = pricesByMenu.get(i.menuName.trim().toLowerCase()) ?? [];
            return (
              <div key={key} className="glass overflow-hidden rounded-2xl border border-border">
                <button
                  type="button"
                  onClick={() => setExpanded(open ? null : key)}
                  className="flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-muted/30"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <p className="truncate font-semibold text-foreground">{i.menuName}</p>
                      <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold", meta.pill)}>
                        <Icon className="size-3" /> {meta.label}
                        {i.samples > 0 && i.ourPrice > 0 && <span className="tabular-nums">· {pct(i.gapPct)}</span>}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {i.brand} · {i.samples} pembanding · pasar {rp(i.min)}–{rp(i.max)} (rata-rata {rp(i.avg)})
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold tabular-nums text-foreground">{i.ourPrice > 0 ? rp(i.ourPrice) : "—"}</p>
                    <p className="text-[10px] text-muted-foreground">harga kita</p>
                  </div>
                  <ChevronDown className={cn("mt-1 size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
                </button>

                {open && (
                  <div className="space-y-3 border-t border-border p-4">
                    {i.ourPrice > 0 && i.hpp > 0 && (
                      <div className="grid gap-2 sm:grid-cols-3">
                        <Metric label="HPP sekarang" value={`${(i.hppPctNow * 100).toFixed(0)}%`} sub={`dari ${rp(i.ourPrice)}`} />
                        <Metric label="HPP di harga pasar" value={`${(i.hppPctAtMarket * 100).toFixed(0)}%`} sub={`dari ${rp(i.avg)}`} tone={i.canMatchMarket ? "good" : "bad"} />
                        <Metric label="Selisih ke pasar" value={rp(Math.abs(i.ourPrice - i.avg))} sub={i.ourPrice > i.avg ? "lebih mahal" : "lebih murah"} />
                      </div>
                    )}

                    {/* Rekomendasi — selalu diuji terhadap HPP, bukan sekadar ikut pasar. */}
                    {i.ourPrice > 0 && i.hpp > 0 && (
                      <div
                        className={cn(
                          "rounded-xl border p-3 text-[13px]",
                          i.position === "mahal" && i.canMatchMarket && "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
                          i.position === "mahal" && !i.canMatchMarket && "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
                          i.position === "murah" && "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
                          i.position === "kompetitif" && "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                        )}
                      >
                        {i.position === "mahal" && i.canMatchMarket && (
                          <>
                            Harga kita <b>{pct(i.gapPct)}</b> di atas rata-rata pasar. Turun ke {rp(i.avg)} masih aman — HPP jadi{" "}
                            <b>{(i.hppPctAtMarket * 100).toFixed(0)}%</b> ({i.marketStatus.label}).
                          </>
                        )}
                        {i.position === "mahal" && !i.canMatchMarket && (
                          <>
                            Harga kita <b>{pct(i.gapPct)}</b> di atas pasar, tapi <b>jangan diturunkan</b> ke {rp(i.avg)} — HPP-nya jadi{" "}
                            <b>{(i.hppPctAtMarket * 100).toFixed(0)}%</b> ({i.marketStatus.label}). Tekan biaya bahan dulu, atau posisikan sebagai menu premium.
                          </>
                        )}
                        {i.position === "murah" && (
                          <>
                            Harga kita <b>{pct(Math.abs(i.gapPct))}</b> di bawah pasar. Ada ruang naik sampai {rp(i.avg)} tanpa keluar dari harga wajar.
                          </>
                        )}
                        {i.position === "kompetitif" && <>Harga kita sejajar pasar ({pct(i.gapPct)}). Tidak perlu penyesuaian.</>}
                      </div>
                    )}

                    <div className="overflow-x-auto rounded-xl border border-border">
                      <table className="w-full min-w-[520px] text-sm">
                        <thead className="border-b border-border bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                          <tr>
                            <th className="px-3 py-2 font-medium">Kompetitor</th>
                            <th className="px-3 py-2 text-right font-medium">Harga</th>
                            <th className="px-3 py-2 font-medium">Kota</th>
                            <th className="px-3 py-2 font-medium">Sumber</th>
                            <th className="px-3 py-2 font-medium">Tanggal</th>
                            {canEdit && <th className="px-3 py-2" />}
                          </tr>
                        </thead>
                        <tbody>
                          {detail.map((p) => (
                            <tr key={p.id} className="border-b border-border/60 last:border-0">
                              <td className="px-3 py-2 font-medium text-foreground">{p.competitor}</td>
                              <td className="px-3 py-2 text-right tabular-nums text-foreground">{rp(p.price)}</td>
                              <td className="px-3 py-2 text-muted-foreground">{p.city || "—"}</td>
                              <td className="px-3 py-2 text-muted-foreground">{p.source || "—"}</td>
                              <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                                {new Date(p.observedAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                              </td>
                              {canEdit && (
                                <td className="px-3 py-2 text-right">
                                  <button
                                    type="button"
                                    onClick={() => remove(p)}
                                    title="Hapus"
                                    className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-500"
                                  >
                                    <Trash2 className="size-4" />
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Sheet open={formOpen} onOpenChange={setFormOpen}>
        <SheetContent title="Catat Harga Kompetitor" description="Satu baris = satu harga dari satu kompetitor. Makin banyak pembanding, makin akurat posisinya.">
          <div className="space-y-4">
            <div>
              <Label>Menu kita</Label>
              <div className="mt-1.5">
                <Combobox
                  portal
                  matchTriggerWidth
                  searchable
                  searchPlaceholder="Cari menu…"
                  value={form.menuId}
                  onChange={(v) => {
                    const m = menus.find((x) => x.id === v);
                    setForm((f) => ({ ...f, menuId: v, menuName: m ? m.name : f.menuName }));
                  }}
                  options={[{ value: "", label: "Tulis manual (menu belum ada)" }, ...menus.map((m) => ({ value: m.id, label: m.name, hint: m.brand }))]}
                />
              </div>
            </div>

            <Field label="Nama menu">
              <Input
                value={form.menuName}
                onChange={(e) => setForm({ ...form, menuName: e.target.value })}
                placeholder="mis. Es Kopi Susu"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Kompetitor">
                <Input value={form.competitor} onChange={(e) => setForm({ ...form, competitor: e.target.value })} placeholder="mis. Kopi Kenangan" />
              </Field>
              <Field label="Harga">
                <Input value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="Rp" inputMode="numeric" />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Kota">
                <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="mis. Sintang" />
              </Field>
              <div>
                <Label>Sumber</Label>
                <div className="mt-1.5">
                  <Combobox portal matchTriggerWidth value={form.source} onChange={(v) => setForm({ ...form, source: v })} options={SOURCES.map((s) => ({ value: s, label: s }))} />
                </div>
              </div>
            </div>

            <Field label="Tanggal pengamatan">
              <Input type="date" value={form.observedAt} onChange={(e) => setForm({ ...form, observedAt: e.target.value })} />
            </Field>

            <Field label="Catatan (opsional)">
              <Textarea rows={3} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="mis. ukuran cup lebih kecil, promo bundling" />
            </Field>

            <div className="flex gap-2 pt-1">
              <Button onClick={save} disabled={saving} className="flex-1">
                {saving ? "Menyimpan…" : "Simpan"}
              </Button>
              <Button variant="outline" onClick={() => setFormOpen(false)}>
                Batal
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {dialog}
    </div>
  );
}

function Metric({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-xl border border-border bg-muted/20 p-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-0.5 text-lg font-semibold tabular-nums",
          tone === "good" ? "text-emerald-600 dark:text-emerald-400" : tone === "bad" ? "text-red-600 dark:text-red-400" : "text-foreground",
        )}
      >
        {value}
      </p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}
