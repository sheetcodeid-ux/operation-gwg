"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { ExternalLink, Eye, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { DataTable } from "@/components/ui/data-table";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { useConfirm } from "@/components/ui/confirm";
import { HC_PILLARS } from "@/lib/hcmos/pillars";
import {
  JENIS_DOKUMEN,
  JENIS_DOKUMEN_META,
  STATUS_BERLAKU_META,
  STATUS_DOKUMEN_META,
  sisaBerlaku,
  type JenisDokumen,
  type StatusDokumen,
} from "@/lib/hcmos/dokumen";
import { hapusDokumenAction, simpanDokumenAction } from "@/lib/actions/hcmos-dokumen";
import type { DokumenRow } from "@/lib/data/hcmos-dokumen";
import { formatDate } from "@/lib/utils";

const kosong = (jenis: JenisDokumen, pilar: string) => ({
  id: undefined as string | undefined,
  jenis,
  pilar,
  judul: "",
  ringkasan: "",
  isi: "",
  tautan: "",
  versi: "",
  pemilik: "",
  berlakuMulai: "",
  berlakuSampai: "",
  pihak: "",
  status: "aktif" as StatusDokumen,
});
type FormDokumen = ReturnType<typeof kosong>;

/** Jenis yang punya masa berlaku — sisanya tidak perlu ditanyai tanggal. */
const PUNYA_MASA: JenisDokumen[] = ["pks", "compliance"];

export function DokumenBoard({
  rows,
  jenisAwal,
  pilarAwal,
  bolehUbah,
}: {
  rows: DokumenRow[];
  jenisAwal: JenisDokumen;
  pilarAwal: string;
  bolehUbah: boolean;
}) {
  const router = useRouter();
  const { confirm, dialog } = useConfirm();
  const [jenis, setJenis] = React.useState<JenisDokumen>(jenisAwal);
  const [pilar, setPilar] = React.useState(pilarAwal || "all");
  const [form, setForm] = React.useState<FormDokumen | null>(null);
  const [baca, setBaca] = React.useState<DokumenRow | null>(null);

  const tersaring = React.useMemo(
    () =>
      rows.filter(
        (r) => r.jenis === jenis && (jenis !== "sop" || pilar === "all" || r.pilar === pilar),
      ),
    [rows, jenis, pilar],
  );

  const hapus = React.useCallback(
    async (d: DokumenRow) => {
      const ya = await confirm({
        title: `Hapus "${d.judul}"?`,
        description: "Dokumen ini hilang dari seluruh pilar yang menampilkannya.",
        confirmLabel: "Hapus",
        tone: "danger",
      });
      if (!ya) return;
      const res = await hapusDokumenAction(d.id);
      if (res.error) return toast.error(res.error);
      toast.success("Dokumen dihapus");
      router.refresh();
    },
    [confirm, router],
  );

  const columns = React.useMemo<ColumnDef<DokumenRow>[]>(
    () => [
      {
        accessorKey: "judul",
        header: "Dokumen",
        cell: ({ row }) => (
          <div className="min-w-0 max-w-sm">
            <p className="truncate font-medium text-foreground">{row.original.judul}</p>
            <p className="truncate text-[11px] text-muted-foreground">
              {row.original.ringkasan || "tanpa ringkasan"}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "pilar",
        header: "Pilar",
        cell: ({ getValue }) => {
          const s = getValue<string | null>();
          const p = HC_PILLARS.find((x) => x.slug === s);
          return <span className="text-muted-foreground">{p?.label ?? "—"}</span>;
        },
      },
      {
        accessorKey: "pemilik",
        header: "Pemilik",
        cell: ({ getValue }) => <span className="text-muted-foreground">{getValue<string | null>() ?? "—"}</span>,
      },
      {
        accessorKey: "versi",
        header: "Versi",
        cell: ({ getValue }) => <span className="text-muted-foreground">{getValue<string | null>() ?? "—"}</span>,
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const m = STATUS_DOKUMEN_META[row.original.status];
          const b = row.original.masaBerlaku;
          const sisa = sisaBerlaku(row.original.berlakuSampai);
          return (
            <div className="flex flex-col items-start gap-1">
              <Badge tone={m.tone} dot>
                {m.label}
              </Badge>
              {b !== "tanpa_masa" && (
                <span className="text-[10px] text-muted-foreground">
                  {STATUS_BERLAKU_META[b].label}
                  {sisa !== null && (sisa >= 0 ? ` · ${sisa} hari lagi` : ` · lewat ${Math.abs(sisa)} hari`)}
                </span>
              )}
            </div>
          );
        },
      },
      {
        id: "aksi",
        header: "",
        cell: ({ row }) => (
          <div className="flex gap-1.5">
            <Button size="sm" variant="subtle" onClick={() => setBaca(row.original)}>
              <Eye className="size-3.5" /> Baca
            </Button>
            {bolehUbah && (
              <>
                <Button size="sm" variant="subtle" onClick={() => setForm(keForm(row.original))}>
                  <Pencil className="size-3.5" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => hapus(row.original)}>
                  <Trash2 className="size-3.5" />
                </Button>
              </>
            )}
          </div>
        ),
      },
    ],
    [bolehUbah, hapus],
  );

  return (
    <div className="space-y-3">
      <DataTable
        tableId={`hcmos-dokumen-${jenis}`}
        columns={columns}
        data={tersaring}
        searchPlaceholder="Cari judul dokumen…"
        toolbar={
          <div className="contents">
            <Combobox
              portal
              searchable={false}
              value={jenis}
              onChange={(v) => setJenis(v as JenisDokumen)}
              className="w-48 shrink-0"
              options={JENIS_DOKUMEN.map((j) => ({ value: j, label: JENIS_DOKUMEN_META[j].label }))}
            />
            {/* Saringan pilar hanya masuk akal untuk SOP — jenis lain berlaku
                lintas pilar, dan dropdown yang tidak mengubah apa pun hanya
                membuat orang mengira datanya tersembunyi. */}
            {jenis === "sop" && (
              <Combobox
                portal
                value={pilar}
                onChange={setPilar}
                className="w-56 shrink-0"
                options={[
                  { value: "all", label: "Semua Pilar" },
                  ...HC_PILLARS.map((p) => ({ value: p.slug, label: p.label })),
                ]}
              />
            )}
            {bolehUbah && (
              <Button
                size="sm"
                className="shrink-0"
                onClick={() => setForm(kosong(jenis, jenis === "sop" && pilar !== "all" ? pilar : ""))}
              >
                <Plus className="size-3.5" /> Dokumen
              </Button>
            )}
          </div>
        }
      />
      <p className="text-[11px] text-muted-foreground">{JENIS_DOKUMEN_META[jenis].ringkas}</p>

      {form && <DialogDokumen key={form.id ?? "baru"} awal={form} onClose={() => setForm(null)} />}
      {baca && <DialogBaca key={baca.id} d={baca} onClose={() => setBaca(null)} />}
      {dialog}
    </div>
  );
}

const keForm = (d: DokumenRow): FormDokumen => ({
  id: d.id,
  jenis: d.jenis,
  pilar: d.pilar ?? "",
  judul: d.judul,
  ringkasan: d.ringkasan ?? "",
  isi: d.isi ?? "",
  tautan: d.tautan ?? "",
  versi: d.versi ?? "",
  pemilik: d.pemilik ?? "",
  berlakuMulai: d.berlakuMulai ?? "",
  berlakuSampai: d.berlakuSampai ?? "",
  pihak: d.pihak ?? "",
  status: d.status,
});

function DialogDokumen({ awal, onClose }: { awal: FormDokumen; onClose: () => void }) {
  const router = useRouter();
  const [f, setF] = React.useState(awal);
  const [busy, setBusy] = React.useState(false);
  const set = <K extends keyof FormDokumen>(k: K, v: FormDokumen[K]) => setF((p) => ({ ...p, [k]: v }));
  const punyaMasa = PUNYA_MASA.includes(f.jenis);

  async function simpan() {
    if (!f.judul.trim()) return toast.error("Judul wajib diisi.");
    setBusy(true);
    const res = await simpanDokumenAction(f);
    setBusy(false);
    if (res.error) return toast.error(res.error);
    toast.success(f.id ? "Dokumen diperbarui" : "Dokumen ditambahkan");
    onClose();
    router.refresh();
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        title={f.id ? "Ubah Dokumen" : "Dokumen Baru"}
        description={JENIS_DOKUMEN_META[f.jenis].label}
        align="center"
        className="max-w-2xl"
      >
        <div className="max-h-[75vh] space-y-3 overflow-y-auto p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Jenis">
              <Combobox
                portal
                searchable={false}
                matchTriggerWidth
                value={f.jenis}
                onChange={(v) => set("jenis", v as JenisDokumen)}
                options={JENIS_DOKUMEN.map((j) => ({ value: j, label: JENIS_DOKUMEN_META[j].label }))}
              />
            </Field>
            <Field label="Pilar" hint="Kosongkan bila berlaku lintas pilar.">
              <Combobox
                portal
                matchTriggerWidth
                value={f.pilar}
                onChange={(v) => set("pilar", v)}
                options={[{ value: "", label: "— lintas pilar —" }, ...HC_PILLARS.map((p) => ({ value: p.slug, label: p.label }))]}
              />
            </Field>
          </div>

          <Field label="Judul">
            <Input value={f.judul} onChange={(e) => set("judul", e.target.value)} />
          </Field>
          <Field label="Ringkasan">
            <Input value={f.ringkasan} onChange={(e) => set("ringkasan", e.target.value)} />
          </Field>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Versi">
              <Input value={f.versi} onChange={(e) => set("versi", e.target.value)} placeholder="mis. v1.0" />
            </Field>
            <Field label="Pemilik">
              <Input value={f.pemilik} onChange={(e) => set("pemilik", e.target.value)} placeholder="mis. Riva" />
            </Field>
            <Field label="Status">
              <Combobox
                portal
                searchable={false}
                matchTriggerWidth
                value={f.status}
                onChange={(v) => set("status", v as StatusDokumen)}
                options={(Object.keys(STATUS_DOKUMEN_META) as StatusDokumen[]).map((s) => ({
                  value: s,
                  label: STATUS_DOKUMEN_META[s].label,
                }))}
              />
            </Field>
          </div>

          {punyaMasa && (
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Berlaku Mulai">
                <DatePicker value={f.berlakuMulai} onChange={(v) => set("berlakuMulai", v)} />
              </Field>
              <Field label="Berlaku Sampai">
                <DatePicker value={f.berlakuSampai} onChange={(v) => set("berlakuSampai", v)} />
              </Field>
              <Field label="Pihak">
                <Input value={f.pihak} onChange={(e) => set("pihak", e.target.value)} placeholder="mis. PT Sewa Lokasi" />
              </Field>
            </div>
          )}

          <Field label="Tautan Berkas" hint="Google Drive, PDF, atau tautan mana pun.">
            <Input value={f.tautan} onChange={(e) => set("tautan", e.target.value)} placeholder="https://…" />
          </Field>
          <Field label="Isi Dokumen" hint="Boleh ditulis langsung di sini bila tidak ada berkasnya.">
            <Textarea rows={8} value={f.isi} onChange={(e) => set("isi", e.target.value)} />
          </Field>

          <div className="flex justify-end gap-2 border-t border-border pt-3">
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              Batal
            </Button>
            <Button onClick={simpan} disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />} Simpan
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DialogBaca({ d, onClose }: { d: DokumenRow; onClose: () => void }) {
  const p = HC_PILLARS.find((x) => x.slug === d.pilar);
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent title={d.judul} description={p?.label ?? JENIS_DOKUMEN_META[d.jenis].label} align="center" className="max-w-2xl">
        <div className="max-h-[75vh] space-y-3 overflow-y-auto p-5">
          <div className="flex flex-wrap gap-1.5">
            <Badge tone={STATUS_DOKUMEN_META[d.status].tone}>{STATUS_DOKUMEN_META[d.status].label}</Badge>
            {d.versi && <Badge tone="neutral">Versi {d.versi}</Badge>}
            {d.pemilik && <Badge tone="neutral">Pemilik {d.pemilik}</Badge>}
            {d.masaBerlaku !== "tanpa_masa" && (
              <Badge tone={STATUS_BERLAKU_META[d.masaBerlaku].tone}>{STATUS_BERLAKU_META[d.masaBerlaku].label}</Badge>
            )}
          </div>

          {d.pihak && <p className="text-sm text-muted-foreground">Pihak: {d.pihak}</p>}
          {(d.berlakuMulai || d.berlakuSampai) && (
            <p className="text-sm text-muted-foreground">
              Masa berlaku: {d.berlakuMulai ? formatDate(d.berlakuMulai) : "—"} s.d.{" "}
              {d.berlakuSampai ? formatDate(d.berlakuSampai) : "—"}
            </p>
          )}
          {d.ringkasan && <p className="text-sm text-foreground/90">{d.ringkasan}</p>}

          {d.isi ? (
            <div className="whitespace-pre-line rounded-xl border border-border bg-muted/30 p-3 text-sm leading-relaxed text-foreground/90">
              {d.isi}
            </div>
          ) : (
            !d.tautan && <p className="text-sm text-muted-foreground">Dokumen ini belum ada isinya.</p>
          )}

          {d.tautan && (
            <a
              href={d.tautan}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              Buka berkas <ExternalLink className="size-4" />
            </a>
          )}

          <div className="flex justify-end border-t border-border pt-3">
            <Button variant="ghost" onClick={onClose}>
              Tutup
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
