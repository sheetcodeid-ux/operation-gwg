"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarRange, CheckCircle2, ClipboardCheck, Loader2, Megaphone, Package, RotateCcw, Store, Wallet, X, XCircle } from "lucide-react";
import { toast } from "sonner";
import {
  fmtRupiah,
  MC_STATUS_META,
  MC_TYPE_META,
  windowDays,
  type EventImpact,
  type MarcommEventType,
  type ReviewableEvent,
} from "@/lib/marcomm-shared";
import { ImpactView } from "./impact";
import { approveEventAction, rejectEventAction, resetReviewAction } from "@/lib/actions/marcomm";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { MultiCombobox, SelectionChips } from "@/components/ui/multi-combobox";
import { StatTile } from "@/components/ui/stat";

type Filter = "all" | "pending" | "approved" | "rejected";

export function MarcommEvents({
  events,
  products,
  outlets,
  impacts,
}: {
  events: ReviewableEvent[];
  products: { name: string; brand: string }[];
  outlets: { id: string; name: string }[];
  impacts: EventImpact[];
}) {
  const [tab, setTab] = React.useState<"review" | "impact">("review");
  const [filter, setFilter] = React.useState<Filter>("all");
  const [q, setQ] = React.useState("");
  const [accId, setAccId] = React.useState<string | null>(null);
  const [rejectId, setRejectId] = React.useState<string | null>(null);

  const pending = events.filter((e) => e.review.status === "pending").length;
  const approved = events.filter((e) => e.review.status === "approved");
  const totalBudget = approved.reduce((s, e) => s + e.review.budget, 0);

  const rows = events.filter(
    (e) => (filter === "all" || e.review.status === filter) && (!q || e.name.toLowerCase().includes(q.toLowerCase()) || e.outletName.toLowerCase().includes(q.toLowerCase())),
  );

  const accEvent = events.find((e) => e.id === accId) ?? null;
  const rejectEvent = events.find((e) => e.id === rejectId) ?? null;

  return (
    <div className="space-y-4">
      <SegmentedTabs
        value={tab}
        onChange={(v) => setTab(v as "review" | "impact")}
        items={[
          { value: "review", label: "ACC & Klasifikasi" },
          { value: "impact", label: "Analisis Dampak & ROI" },
        ]}
      />

      {tab === "impact" ? (
        <ImpactView impacts={impacts} />
      ) : (
        <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={Megaphone} label="Total Event" value={events.length} sub="diajukan CA" />
        <StatTile icon={ClipboardCheck} label="Menunggu ACC" value={pending} sub="perlu keputusan" />
        <StatTile icon={CheckCircle2} label="Disetujui" value={approved.length} sub="berjalan/selesai" />
        <StatTile icon={Wallet} label="Total Budget" value={fmtRupiah(totalBudget)} sub="event disetujui" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SegmentedTabs
          value={filter}
          onChange={(v) => setFilter(v as Filter)}
          items={[
            { value: "all", label: "Semua" },
            { value: "pending", label: `Menunggu ACC${pending ? ` (${pending})` : ""}` },
            { value: "approved", label: "Disetujui" },
            { value: "rejected", label: "Ditolak" },
          ]}
        />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari event / outlet…" className="h-9 max-w-56" />
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
          {events.length === 0 ? "Belum ada event yang diajukan Coordinator Area." : "Tidak ada event pada filter ini."}
        </div>
      ) : (
        <div className="space-y-2.5">
          {rows.map((e) => (
            <EventCard key={e.id} e={e} onAcc={() => setAccId(e.id)} onReject={() => setRejectId(e.id)} />
          ))}
        </div>
      )}
        </>
      )}

      {accEvent && (
        <AccDialog event={accEvent} products={products} outlets={outlets} onClose={() => setAccId(null)} />
      )}
      {rejectEvent && <RejectDialog event={rejectEvent} onClose={() => setRejectId(null)} />}
    </div>
  );
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

function EventCard({ e, onAcc, onReject }: { e: ReviewableEvent; onAcc: () => void; onReject: () => void }) {
  const router = useRouter();
  const r = e.review;
  const st = MC_STATUS_META[r.status];
  const reset = () => {
    if (!window.confirm("Kembalikan event ini ke status Menunggu ACC?")) return;
    resetReviewAction(e.id).then((res) => {
      if (res?.error) return toast.error(res.error);
      toast.success("Dikembalikan ke Menunggu ACC.");
      router.refresh();
    });
  };

  return (
    <div className="card-gradient animate-fade-up rounded-xl p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={st.tone}>{st.label}</Badge>
            {r.status === "approved" && r.eventType && <Badge tone={MC_TYPE_META[r.eventType].tone}>{MC_TYPE_META[r.eventType].label}</Badge>}
          </div>
          <p className="mt-1.5 truncate text-sm font-semibold text-foreground">{e.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {e.outletName} · PIC {e.picName} · {fmtDate(e.startDate)} – {fmtDate(e.endDate)}
          </p>
          {e.description && <p className="mt-1 line-clamp-2 max-w-2xl text-xs text-muted-foreground/80">{e.description}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {r.status === "pending" ? (
            <>
              <Button size="sm" variant="ghost" className="text-red-600 dark:text-red-400" onClick={onReject}><XCircle className="size-4" /> Tolak</Button>
              <Button size="sm" onClick={onAcc}><ClipboardCheck className="size-4" /> ACC & Klasifikasi</Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="ghost" onClick={reset} title="Kembalikan ke Menunggu ACC"><RotateCcw className="size-4" /></Button>
              {r.status === "approved" && <Button size="sm" variant="outline" onClick={onAcc}>Ubah ACC</Button>}
              {r.status === "rejected" && <Button size="sm" onClick={onAcc}><ClipboardCheck className="size-4" /> ACC Ulang</Button>}
            </>
          )}
        </div>
      </div>

      {r.status === "approved" && (
        <div className="mt-3 grid gap-2 rounded-lg border border-border/60 bg-background/30 p-3 text-xs sm:grid-cols-2">
          <Detail icon={Wallet} label="Budget">{fmtRupiah(r.budget)}</Detail>
          <Detail icon={CalendarRange} label="Periode Ukur">
            {r.measureStart && r.measureEnd ? `${fmtDate(r.measureStart)} – ${fmtDate(r.measureEnd)} (${windowDays(r.measureStart, r.measureEnd)} hari)` : "—"}
          </Detail>
          {r.eventType === "promo" ? (
            <Detail icon={Package} label={`Produk (${r.productNames.length})`} className="sm:col-span-2">
              {r.productNames.length ? r.productNames.join(", ") : "—"}
            </Detail>
          ) : (
            <Detail icon={Store} label={`Outlet Terdampak (${r.outletIds.length})`} className="sm:col-span-2">
              {r.outletIds.length ? `${r.outletIds.length} outlet` : "—"}
            </Detail>
          )}
          {r.note && <Detail icon={ClipboardCheck} label="Catatan" className="sm:col-span-2">{r.note}</Detail>}
          {r.approvedByName && <p className="text-[11px] text-muted-foreground sm:col-span-2">Di-ACC oleh {r.approvedByName}</p>}
        </div>
      )}
      {r.status === "rejected" && r.rejectReason && (
        <p className="mt-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-300"><span className="font-medium">Alasan ditolak:</span> {r.rejectReason}</p>
      )}
    </div>
  );
}

function Detail({ icon: Icon, label, children, className }: { icon: React.ComponentType<{ className?: string }>; label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start gap-2", className)}>
      <Icon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
      <span className="text-muted-foreground">{label}:</span>
      <span className="min-w-0 flex-1 font-medium text-foreground">{children}</span>
    </div>
  );
}

function AccDialog({ event, products, outlets, onClose }: { event: ReviewableEvent; products: { name: string; brand: string }[]; outlets: { id: string; name: string }[]; onClose: () => void }) {
  const router = useRouter();
  const r = event.review;
  const [busy, setBusy] = React.useState(false);
  const [budget, setBudget] = React.useState(r.budget || event.proposedBudget || 0);
  const [type, setType] = React.useState<MarcommEventType>(r.eventType ?? "event");
  const [productNames, setProductNames] = React.useState<string[]>(r.productNames);
  const [outletIds, setOutletIds] = React.useState<string[]>(r.outletIds.length ? r.outletIds : event.outletId ? [event.outletId] : []);
  const [start, setStart] = React.useState(r.measureStart ?? event.startDate.slice(0, 10));
  const [end, setEnd] = React.useState(r.measureEnd ?? event.endDate.slice(0, 10));
  const [note, setNote] = React.useState(r.note);

  const productOpts = products.map((p) => ({ value: p.name, label: `${p.name} · ${p.brand}` }));
  const outletOpts = outlets.map((o) => ({ value: o.id, label: o.name }));

  const submit = () => {
    setBusy(true);
    approveEventAction({ eventId: event.id, budget, eventType: type, productNames, outletIds, measureStart: start, measureEnd: end, note })
      .then((res) => {
        if (res?.error) return toast.error(res.error);
        toast.success("Event di-ACC.");
        onClose();
        router.refresh();
      })
      .finally(() => setBusy(false));
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent title="ACC & Klasifikasi Event" description={event.name} align="center" className="max-w-lg">
        <div className="max-h-[76vh] space-y-3 overflow-y-auto p-5">
          <Field label="Budget (Rp)" hint="Anggaran yang disetujui Marketing Communication.">
            <Input type="number" min={0} value={budget} onChange={(e) => setBudget(Number(e.target.value))} />
          </Field>

          <Field label="Jenis">
            <SegmentedTabs
              value={type}
              onChange={(v) => setType(v as MarcommEventType)}
              items={[
                { value: "event", label: "Event Outlet" },
                { value: "promo", label: "Promo Produk" },
              ]}
            />
          </Field>

          {type === "promo" ? (
            <Field label={`Produk yang dipromosikan (${productNames.length})`} hint="Dampak diukur dari penjualan produk (bulanan) + omzet outlet (harian).">
              {productOpts.length ? (
                <div className="space-y-2">
                  <MultiCombobox value={productNames} onChange={setProductNames} options={productOpts} placeholder="Pilih produk…" searchPlaceholder="Cari produk…" />
                  <SelectionChips labels={productNames} onClear={() => setProductNames([])} />
                </div>
              ) : (
                <p className="rounded-lg border border-dashed border-border p-2.5 text-xs text-muted-foreground">Belum ada produk di katalog HPP.</p>
              )}
            </Field>
          ) : (
            <Field label={`Outlet yang terdampak (${outletIds.length})`}>
              <div className="space-y-2">
                <MultiCombobox value={outletIds} onChange={setOutletIds} options={outletOpts} placeholder="Pilih outlet…" searchPlaceholder="Cari outlet…" />
                <SelectionChips labels={outletIds.map((id) => outlets.find((o) => o.id === id)?.name).filter((n): n is string => !!n)} onClear={() => setOutletIds([])} />
              </div>
            </Field>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={type === "promo" ? "Mulai Jual" : "Mulai Event"}>
              <DatePicker value={start} onChange={setStart} />
            </Field>
            <Field label="Selesai">
              <DatePicker value={end} onChange={setEnd} />
            </Field>
          </div>

          <Field label="Catatan (opsional)">
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Catatan ACC / arahan…" />
          </Field>

          <div className="flex justify-end gap-2 border-t border-border pt-3">
            <Button variant="ghost" onClick={onClose} disabled={busy}>Batal</Button>
            <Button onClick={submit} disabled={busy}>{busy ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} Setujui (ACC)</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RejectDialog({ event, onClose }: { event: ReviewableEvent; onClose: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const submit = () => {
    if (!reason.trim()) return toast.error("Isi alasan penolakan.");
    setBusy(true);
    rejectEventAction({ eventId: event.id, reason })
      .then((res) => {
        if (res?.error) return toast.error(res.error);
        toast.success("Event ditolak.");
        onClose();
        router.refresh();
      })
      .finally(() => setBusy(false));
  };
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent title="Tolak Event" description={event.name} align="center" className="max-w-md">
        <div className="space-y-3 p-5">
          <Field label="Alasan Penolakan">
            <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Jelaskan alasan penolakan agar CA bisa memperbaiki…" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose} disabled={busy}>Batal</Button>
            <Button onClick={submit} disabled={busy} className="bg-red-600 hover:bg-red-600/90"><X className="size-4" /> Tolak Event</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
