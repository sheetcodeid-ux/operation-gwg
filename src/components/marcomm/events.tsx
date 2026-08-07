"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarRange, CheckCircle2, ClipboardCheck, FileText, Image as ImageIcon, Loader2, Megaphone, Package, Paperclip, RotateCcw, Store, Upload, Wallet, X, XCircle } from "lucide-react";
import { toast } from "sonner";
import {
  fmtRupiah,
  MC_STATUS_META,
  MC_TYPE_META,
  windowDays,
  type EventImpact,
  type MarcommEventType,
  type ProductOption,
  type ReviewableEvent,
} from "@/lib/marcomm-shared";
import { ImpactView } from "./impact";
import { approveEventAction, createMarcommProposalAction, rejectEventAction, resetReviewAction, uploadMarcommAttachmentAction } from "@/lib/actions/marcomm";
import { uploadMany } from "@/lib/upload-client";
import type { MarcommAttachment } from "@/lib/marcomm-shared";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { Combobox } from "@/components/ui/combobox";
import { MultiCombobox, SelectionChips } from "@/components/ui/multi-combobox";
import { StatTile } from "@/components/ui/stat";
import { Plus } from "lucide-react";

type Filter = "all" | "pending" | "approved" | "rejected";

export function MarcommEvents({
  events,
  products,
  outlets,
  impacts,
  canAcc = true,
}: {
  events: ReviewableEvent[];
  products: ProductOption[];
  outlets: { id: string; name: string }[];
  impacts: EventImpact[];
  /** Marketing Communication can ACC/reject; Coordinator Area only proposes + tracks status. */
  canAcc?: boolean;
}) {
  const [tab, setTab] = React.useState<"review" | "impact">("review");
  const [filter, setFilter] = React.useState<Filter>("all");
  const [q, setQ] = React.useState("");
  const [accId, setAccId] = React.useState<string | null>(null);
  const [rejectId, setRejectId] = React.useState<string | null>(null);
  const [newOpen, setNewOpen] = React.useState(false);

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
      {canAcc && (
        <SegmentedTabs
          value={tab}
          onChange={(v) => setTab(v as "review" | "impact")}
          items={[
            { value: "review", label: "ACC & Klasifikasi" },
            { value: "impact", label: "Analisis Dampak & ROI" },
          ]}
        />
      )}

      {canAcc && tab === "impact" ? (
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
        <Button size="sm" className="ml-auto" onClick={() => setNewOpen(true)}><Plus className="size-4" /> Tambah Event / Promo</Button>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
          {events.length === 0 ? "Belum ada event yang diajukan Coordinator Area." : "Tidak ada event pada filter ini."}
        </div>
      ) : (
        <div className="space-y-2.5">
          {rows.map((e) => (
            <EventCard key={e.id} e={e} canAcc={canAcc} onAcc={() => setAccId(e.id)} onReject={() => setRejectId(e.id)} />
          ))}
        </div>
      )}
        </>
      )}

      {accEvent && (
        <AccDialog event={accEvent} products={products} outlets={outlets} onClose={() => setAccId(null)} />
      )}
      {rejectEvent && <RejectDialog event={rejectEvent} onClose={() => setRejectId(null)} />}
      {newOpen && <NewEventDialog products={products} outlets={outlets} onClose={() => setNewOpen(false)} />}
    </div>
  );
}

/** Product multi-select sourced from the ESB catalog, filterable by category
 *  (a category dropdown that narrows the list) OR by typing a product/category
 *  name in the combobox — options are grouped by their ESB menu category so a
 *  whole category can be toggled at once. */
function ProductPicker({ products, value, onChange }: { products: ProductOption[]; value: string[]; onChange: (v: string[]) => void }) {
  const [cat, setCat] = React.useState("all");

  const categories = React.useMemo(() => {
    const set = new Set(products.map((p) => p.category).filter(Boolean));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [products]);

  const options = React.useMemo(
    () =>
      products
        .filter((p) => cat === "all" || p.category === cat)
        .map((p) => ({ value: p.name, label: p.name, group: p.category, hint: p.foodBev === "minuman" ? "Minuman" : "Makanan" })),
    [products, cat],
  );

  if (products.length === 0) {
    return <p className="rounded-lg border border-dashed border-border p-2.5 text-xs text-muted-foreground">Katalog produk ESB belum tersinkron. Sinkronkan produk ESB terlebih dahulu.</p>;
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Kategori</span>
        <Combobox
          className="h-9 min-w-40"
          value={cat}
          onChange={setCat}
          searchPlaceholder="Cari kategori…"
          options={[{ value: "all", label: `Semua Kategori (${products.length})` }, ...categories.map((c) => ({ value: c, label: c }))]}
        />
      </div>
      <MultiCombobox value={value} onChange={onChange} options={options} placeholder="Pilih produk…" searchPlaceholder="Cari produk / kategori…" />
      <SelectionChips labels={value} onClear={() => onChange([])} />
    </div>
  );
}

function NewEventDialog({ products, outlets, onClose }: { products: ProductOption[]; outlets: { id: string; name: string }[]; onClose: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [type, setType] = React.useState<MarcommEventType>("event");
  const [productNames, setProductNames] = React.useState<string[]>([]);
  const [outletIds, setOutletIds] = React.useState<string[]>([]);
  const [allOutlets, setAllOutlets] = React.useState(true);
  const [start, setStart] = React.useState("");
  const [end, setEnd] = React.useState("");
  const [files, setFiles] = React.useState<File[]>([]);

  const outletOpts = outlets.map((o) => ({ value: o.id, label: o.name }));

  const submit = async () => {
    if (!name.trim()) return toast.error("Nama event/promo wajib diisi.");
    if (!start || !end) return toast.error("Tentukan tanggal mulai & selesai.");
    if (type === "promo" && productNames.length === 0) return toast.error("Pilih minimal satu produk.");
    if (type === "event" && !allOutlets && outletIds.length === 0) return toast.error("Pilih outlet atau centang Semua Outlet.");
    setBusy(true);
    try {
      // Upload each PDF/PNG first → collect its storage path.
      const attachments: MarcommAttachment[] = [];
      try {
        attachments.push(...(await uploadMany("marcomm", files, uploadMarcommAttachmentAction)));
      } catch (e) {
        return toast.error(e instanceof Error ? e.message : "Gagal mengunggah berkas.");
      }
      const res = await createMarcommProposalAction({ title: name, description, eventType: type, productNames, outletIds, allOutlets, startDate: start, endDate: end, attachments });
      if (res?.error) return toast.error(res.error);
      toast.success("Diajukan. Lanjutkan dengan ACC (tetapkan budget).");
      onClose();
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent title="Tambah Event / Promo" description="Ajukan event atau promo baru. Budget ditetapkan saat ACC." align="center" className="max-w-lg">
        <div className="max-h-[76vh] space-y-3 overflow-y-auto p-5">
          <Field label="Nama Event / Promo">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="cth. Promo Kopi Susu Merdeka" />
          </Field>

          <Field label="Kategori">
            <SegmentedTabs
              value={type}
              onChange={(v) => setType(v as MarcommEventType)}
              items={[
                { value: "event", label: "Event (Outlet)" },
                { value: "promo", label: "Promo (Produk)" },
              ]}
            />
          </Field>

          {type === "promo" ? (
            <Field label={`Produk (${productNames.length})`} hint="Ambil dari katalog ESB — filter berdasarkan nama produk atau kategori. Dampak diukur dari omzet produk ini.">
              <ProductPicker products={products} value={productNames} onChange={setProductNames} />
            </Field>
          ) : (
            <Field label="Outlet yang terdampak" hint="Beberapa cabang atau semua outlet.">
              <div className="space-y-2">
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border p-2.5 text-sm text-foreground">
                  <input type="checkbox" checked={allOutlets} onChange={(e) => setAllOutlets(e.target.checked)} className="size-4 accent-brand-500" />
                  <Store className="size-4 text-muted-foreground" /> Semua Outlet
                </label>
                {!allOutlets && (
                  <>
                    <MultiCombobox value={outletIds} onChange={setOutletIds} options={outletOpts} placeholder="Pilih beberapa outlet…" searchPlaceholder="Cari outlet…" />
                    <SelectionChips labels={outletIds.map((id) => outlets.find((o) => o.id === id)?.name).filter((n): n is string => !!n)} onClear={() => setOutletIds([])} />
                  </>
                )}
              </div>
            </Field>
          )}

          <Field label="Deskripsi (opsional)">
            <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Detail event / promo…" />
          </Field>

          <Field label="Lampiran (PDF / PNG)" hint="Materi desain atau brief. Bisa lebih dari satu, maks 10 MB per berkas.">
            <AttachmentPicker files={files} onChange={setFiles} disabled={busy} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={type === "promo" ? "Mulai Jual" : "Tanggal Mulai"}><DatePicker value={start} onChange={setStart} /></Field>
            <Field label="Tanggal Selesai"><DatePicker value={end} onChange={setEnd} /></Field>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={onClose} disabled={busy}>Batal</Button>
            <Button onClick={submit} disabled={busy}>{busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Ajukan</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Multi-file picker for PDF/PNG attachments (client-side type + size guard). */
function AttachmentPicker({ files, onChange, disabled }: { files: File[]; onChange: (f: File[]) => void; disabled?: boolean }) {
  const add = (list: FileList | null) => {
    if (!list) return;
    const valid: File[] = [];
    for (const f of Array.from(list)) {
      if (f.type !== "application/pdf" && f.type !== "image/png") { toast.error(`"${f.name}" harus PDF atau PNG.`); continue; }
      if (f.size > 10 * 1024 * 1024) { toast.error(`"${f.name}" melebihi 10 MB.`); continue; }
      valid.push(f);
    }
    onChange([...files, ...valid].slice(0, 8));
  };
  return (
    <div className="space-y-2">
      <label className={cn("inline-flex cursor-pointer items-center gap-2 self-start rounded-lg border border-input bg-background/40 px-3 py-2 text-sm text-foreground/80 hover:bg-muted/50", disabled && "pointer-events-none opacity-50")}>
        <Upload className="size-4" /> Unggah PDF / PNG
        <input type="file" accept="application/pdf,image/png" multiple className="hidden" disabled={disabled} onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
      </label>
      {files.length > 0 && (
        <ul className="space-y-1.5">
          {files.map((f, i) => (
            <li key={i} className="flex items-center gap-2 rounded-lg bg-muted/60 px-2.5 py-1.5 text-xs text-foreground/80">
              {f.type === "application/pdf" ? <FileText className="size-3.5 shrink-0 text-red-500" /> : <ImageIcon className="size-3.5 shrink-0 text-blue-500" />}
              <span className="min-w-0 flex-1 truncate">{f.name}</span>
              <span className="shrink-0 text-muted-foreground">{(f.size / 1024 / 1024).toFixed(1)} MB</span>
              <button type="button" onClick={() => onChange(files.filter((_, j) => j !== i))} className="shrink-0 text-muted-foreground hover:text-foreground"><X className="size-3.5" /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Download chips for a proposal's PDF/PNG attachments. */
function AttachmentChips({ items }: { items: MarcommAttachment[] }) {
  if (!items.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {items.map((a, i) => {
        const Icon = a.name.toLowerCase().endsWith(".pdf") ? FileText : ImageIcon;
        const tone = a.name.toLowerCase().endsWith(".pdf") ? "text-red-500" : "text-blue-500";
        return a.url ? (
          <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background/40 px-2 py-1 text-[11px] text-foreground/80 hover:bg-muted/50">
            <Icon className={cn("size-3.5 shrink-0", tone)} /> <span className="max-w-[12rem] truncate">{a.name}</span>
          </a>
        ) : (
          <span key={i} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2 py-1 text-[11px] text-muted-foreground">
            <Paperclip className="size-3.5 shrink-0" /> <span className="max-w-[12rem] truncate">{a.name}</span>
          </span>
        );
      })}
    </div>
  );
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

function EventCard({ e, canAcc, onAcc, onReject }: { e: ReviewableEvent; canAcc: boolean; onAcc: () => void; onReject: () => void }) {
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
          <AttachmentChips items={r.attachments} />
        </div>
        {canAcc && (
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
        )}
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

function AccDialog({ event, products, outlets, onClose }: { event: ReviewableEvent; products: ProductOption[]; outlets: { id: string; name: string }[]; onClose: () => void }) {
  const router = useRouter();
  const r = event.review;
  const [busy, setBusy] = React.useState(false);
  const [budget, setBudget] = React.useState(r.budget || event.proposedBudget || 0);
  const [type, setType] = React.useState<MarcommEventType>(r.eventType ?? "event");
  const [productNames, setProductNames] = React.useState<string[]>(r.productNames);
  const [outletIds, setOutletIds] = React.useState<string[]>(r.outletIds.length ? r.outletIds : event.outletId ? [event.outletId] : []);
  const [allOutlets, setAllOutlets] = React.useState(r.allOutlets);
  const [start, setStart] = React.useState(r.measureStart ?? event.startDate.slice(0, 10));
  const [end, setEnd] = React.useState(r.measureEnd ?? event.endDate.slice(0, 10));
  const [note, setNote] = React.useState(r.note);

  const outletOpts = outlets.map((o) => ({ value: o.id, label: o.name }));

  const submit = () => {
    setBusy(true);
    approveEventAction({ eventId: event.id, budget, eventType: type, productNames, outletIds, allOutlets, measureStart: start, measureEnd: end, note })
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
            <Input inputMode="numeric" value={budget ? budget.toLocaleString("id-ID") : ""} onChange={(e) => setBudget(Number(e.target.value.replace(/\D/g, "")) || 0)} placeholder="0" />
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
            <Field label={`Produk yang dipromosikan (${productNames.length})`} hint="Ambil dari katalog ESB — filter berdasarkan nama produk atau kategori. Dampak diukur dari omzet produk ini.">
              <ProductPicker products={products} value={productNames} onChange={setProductNames} />
            </Field>
          ) : (
            <Field label="Outlet yang terdampak" hint="Dampak diukur dari omzet outlet terpilih.">
              <div className="space-y-2">
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border p-2.5 text-sm text-foreground">
                  <input type="checkbox" checked={allOutlets} onChange={(e) => setAllOutlets(e.target.checked)} className="size-4 accent-brand-500" />
                  <Store className="size-4 text-muted-foreground" /> Semua Outlet (dampak dihitung company-wide)
                </label>
                {!allOutlets && (
                  <>
                    <MultiCombobox value={outletIds} onChange={setOutletIds} options={outletOpts} placeholder="Pilih beberapa outlet…" searchPlaceholder="Cari outlet…" />
                    <SelectionChips labels={outletIds.map((id) => outlets.find((o) => o.id === id)?.name).filter((n): n is string => !!n)} onClear={() => setOutletIds([])} />
                  </>
                )}
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
