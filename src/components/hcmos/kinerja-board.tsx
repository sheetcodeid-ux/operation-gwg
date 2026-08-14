"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { ClipboardCheck, Grid3x3, Loader2, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { DataTable } from "@/components/ui/data-table";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { StatTile } from "@/components/ui/stat";
import { useConfirm } from "@/components/ui/confirm";
import { KompetensiBoard, type PilihanOutlet } from "./modul-boards";
import type { BarisRekaman } from "./rekaman";
import { hapusBarisAction, simpanBarisAction } from "@/lib/actions/hcmos-lanjutan";
import { SCOPE_LABEL } from "@/lib/hcmos/pillars";
import { ASPEK_KINERJA, predikatKinerja, skorKinerja } from "@/lib/hcmos/lanjutan";
import { formatDate } from "@/lib/utils";

/**
 * Penilaian Kinerja & Appraisal Review.
 *
 * Keduanya satu baris yang sama: appraisal review adalah sesi peninjauan atas
 * penilaian yang sudah dibuat, bukan penilaian kedua. Dipisah jadi dua tabel,
 * hasil review akan menunjuk ke penilaian yang bisa berubah setelahnya, dan
 * tidak ada yang tahu versi mana yang sebenarnya ditinjau.
 */

const STATUS_REVIEW = {
  draf: { label: "Draf", tone: "warning" as const },
  selesai: { label: "Penilaian Selesai", tone: "brand" as const },
  ditinjau: { label: "Sudah Ditinjau", tone: "success" as const },
};
type StatusReview = keyof typeof STATUS_REVIEW;

const t = (r: BarisRekaman, k: string) => (r[k] === null || r[k] === undefined ? "" : String(r[k]));
const nilaiOf = (r: BarisRekaman) => (r.nilai as Record<string, number> | null) ?? {};

const kosong = () => ({
  id: undefined as string | undefined,
  nama: "",
  jabatan: "",
  scope: "manajemen",
  outlet_id: "",
  periode: "",
  penilai: "",
  nilai: {} as Record<string, number>,
  catatan: "",
  status: "draf" as StatusReview,
  tgl_review: "",
  hasil_review: "",
});
type FormKinerja = ReturnType<typeof kosong>;

export function KinerjaBoard({
  penilaian,
  kompetensi,
  outlets,
  bolehUbah,
  tabAwal = "penilaian",
}: {
  penilaian: BarisRekaman[];
  kompetensi: BarisRekaman[];
  outlets: PilihanOutlet[];
  bolehUbah: boolean;
  tabAwal?: string;
}) {
  const router = useRouter();
  const { confirm, dialog } = useConfirm();
  const [tab, setTab] = React.useState(tabAwal);
  const [form, setForm] = React.useState<FormKinerja | null>(null);

  const ditinjau = penilaian.filter((p) => t(p, "status") === "ditinjau");
  const perluTinjau = penilaian.filter((p) => t(p, "status") === "selesai");
  const rerata = penilaian.length
    ? Math.round(penilaian.reduce((a, p) => a + skorKinerja(nilaiOf(p)), 0) / penilaian.length)
    : 0;

  const hapus = React.useCallback(
    async (r: BarisRekaman) => {
      const ya = await confirm({
        title: `Hapus penilaian ${t(r, "nama")}?`,
        description: "Nilai tiap aspek dan hasil peninjauannya ikut terhapus.",
        confirmLabel: "Hapus",
        tone: "danger",
      });
      if (!ya) return;
      const res = await hapusBarisAction({ tabel: "hc_reviews", id: r.id, rute: "/hc-mos/kinerja" });
      if (res.error) return toast.error(res.error);
      toast.success("Penilaian dihapus");
      router.refresh();
    },
    [confirm, router],
  );

  const kolom = React.useCallback(
    (mode: "penilaian" | "review"): ColumnDef<BarisRekaman>[] => [
      {
        accessorKey: "nama",
        header: "Karyawan",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{t(row.original, "nama")}</p>
            <p className="truncate text-[11px] text-muted-foreground">
              {t(row.original, "jabatan") || SCOPE_LABEL[(t(row.original, "scope") as "manajemen" | "outlet") || "manajemen"]}
              {row.original.outletName ? ` · ${row.original.outletName}` : ""}
            </p>
          </div>
        ),
      },
      { accessorKey: "periode", header: "Periode" },
      {
        accessorKey: "penilai",
        header: "Penilai",
        cell: ({ row }) => <span className="text-muted-foreground">{t(row.original, "penilai") || "—"}</span>,
      },
      {
        id: "skor",
        header: "Skor",
        cell: ({ row }) => {
          const skor = skorKinerja(nilaiOf(row.original));
          const p = predikatKinerja(skor);
          return (
            <div className="min-w-0">
              <p className="font-semibold tabular-nums text-foreground">{skor}</p>
              <Badge tone={p.tone}>{p.label}</Badge>
            </div>
          );
        },
      },
      mode === "review"
        ? {
            id: "review",
            header: "Peninjauan",
            cell: ({ row }) => {
              const tgl = t(row.original, "tgl_review");
              return (
                <div className="min-w-0">
                  <p className="text-foreground">{tgl ? formatDate(tgl) : "belum dijadwalkan"}</p>
                  <p className="max-w-xs truncate text-[11px] text-muted-foreground">
                    {t(row.original, "hasil_review") || "—"}
                  </p>
                </div>
              );
            },
          }
        : {
            accessorKey: "status",
            header: "Status",
            cell: ({ row }) => {
              const m = STATUS_REVIEW[t(row.original, "status") as StatusReview];
              return (
                <Badge tone={m?.tone ?? "neutral"} dot>
                  {m?.label ?? "—"}
                </Badge>
              );
            },
          },
      {
        id: "aksi",
        header: "",
        cell: ({ row }) =>
          bolehUbah ? (
            <div className="flex gap-1.5">
              <Button size="sm" variant="subtle" onClick={() => setForm(keForm(row.original))}>
                <Pencil className="size-3.5" /> Ubah
              </Button>
              <Button size="sm" variant="ghost" onClick={() => hapus(row.original)}>
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ) : null,
      },
    ],
    [bolehUbah, hapus],
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile icon={Star} label="Penilaian" value={penilaian.length} sub="seluruh periode" />
        <StatTile icon={ClipboardCheck} label="Menunggu Peninjauan" value={perluTinjau.length} sub="sudah dinilai" />
        <StatTile icon={ClipboardCheck} label="Sudah Ditinjau" value={ditinjau.length} sub="selesai penuh" />
        <StatTile icon={Star} label="Rerata Skor" value={rerata} sub="dari 100" />
      </div>

      <SegmentedTabs
        className="max-w-xl"
        value={tab}
        onChange={setTab}
        items={[
          { value: "penilaian", label: "Penilaian Kinerja", icon: Star },
          { value: "review", label: "Appraisal Review", icon: ClipboardCheck },
          { value: "kompetensi", label: "Competency Matrix", icon: Grid3x3 },
        ]}
      />

      {tab === "penilaian" && (
        <DataTable
          tableId="hcmos-penilaian"
          columns={kolom("penilaian")}
          data={penilaian}
          searchPlaceholder="Cari nama, periode…"
          toolbar={
            bolehUbah ? (
              <Button size="sm" className="shrink-0" onClick={() => setForm(kosong())}>
                <Plus className="size-3.5" /> Penilaian
              </Button>
            ) : undefined
          }
        />
      )}

      {tab === "review" && (
        <>
          {/* Yang ditinjau hanyalah penilaian yang penilaiannya sudah selesai —
              meninjau draf berarti meninjau angka yang masih bisa berubah. */}
          <DataTable
            tableId="hcmos-appraisal"
            columns={kolom("review")}
            data={penilaian.filter((p) => t(p, "status") !== "draf")}
            searchPlaceholder="Cari nama…"
          />
          <p className="text-[11px] text-muted-foreground">
            Hanya penilaian berstatus selesai atau sudah ditinjau yang muncul di sini. Draf masih bisa berubah, jadi
            belum layak ditinjau bersama atasan.
          </p>
        </>
      )}

      {tab === "kompetensi" && <KompetensiBoard rows={kompetensi} bolehUbah={bolehUbah} />}

      {form && <DialogKinerja key={form.id ?? "baru"} awal={form} outlets={outlets} onClose={() => setForm(null)} />}
      {dialog}
    </div>
  );
}

const keForm = (r: BarisRekaman): FormKinerja => ({
  id: r.id,
  nama: t(r, "nama"),
  jabatan: t(r, "jabatan"),
  scope: t(r, "scope") || "manajemen",
  outlet_id: t(r, "outlet_id"),
  periode: t(r, "periode"),
  penilai: t(r, "penilai"),
  nilai: nilaiOf(r),
  catatan: t(r, "catatan"),
  status: (t(r, "status") || "draf") as StatusReview,
  tgl_review: t(r, "tgl_review"),
  hasil_review: t(r, "hasil_review"),
});

function DialogKinerja({
  awal,
  outlets,
  onClose,
}: {
  awal: FormKinerja;
  outlets: PilihanOutlet[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [f, setF] = React.useState(awal);
  const [busy, setBusy] = React.useState(false);
  const set = <K extends keyof FormKinerja>(k: K, v: FormKinerja[K]) => setF((p) => ({ ...p, [k]: v }));

  const skor = skorKinerja(f.nilai);
  const predikat = predikatKinerja(skor);

  async function simpan() {
    if (!f.nama.trim()) return toast.error("Nama karyawan wajib diisi.");
    if (!f.periode.trim()) return toast.error("Periode wajib diisi.");
    setBusy(true);
    const res = await simpanBarisAction({
      tabel: "hc_reviews",
      id: f.id,
      rute: "/hc-mos/kinerja",
      isi: {
        nama: f.nama.trim(),
        jabatan: f.jabatan.trim() || null,
        scope: f.scope,
        outlet_id: f.outlet_id || null,
        periode: f.periode.trim(),
        penilai: f.penilai.trim() || null,
        nilai: f.nilai,
        catatan: f.catatan.trim() || null,
        status: f.status,
        tgl_review: f.tgl_review || null,
        hasil_review: f.hasil_review.trim() || null,
      },
    });
    setBusy(false);
    if (res.error) return toast.error(res.error);
    toast.success(f.id ? "Penilaian diperbarui" : "Penilaian dibuat");
    onClose();
    router.refresh();
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        title={f.id ? "Ubah Penilaian Kinerja" : "Penilaian Kinerja Baru"}
        description="Nilai tiap aspek 1–5. Skor akhir dihitung otomatis menurut bobotnya."
        align="center"
        className="max-w-2xl"
      >
        <div className="max-h-[75vh] space-y-3 overflow-y-auto p-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Nama Karyawan">
              <Input value={f.nama} onChange={(e) => set("nama", e.target.value)} />
            </Field>
            <Field label="Jabatan">
              <Input value={f.jabatan} onChange={(e) => set("jabatan", e.target.value)} />
            </Field>
            <Field label="Periode" hint="mis. 2026-S1 atau 2026-08">
              <Input value={f.periode} onChange={(e) => set("periode", e.target.value)} />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Scope">
              <Combobox
                portal
                searchable={false}
                matchTriggerWidth
                value={f.scope}
                onChange={(v) => set("scope", v)}
                options={[
                  { value: "manajemen", label: SCOPE_LABEL.manajemen },
                  { value: "outlet", label: SCOPE_LABEL.outlet },
                ]}
              />
            </Field>
            {f.scope === "outlet" && (
              <Field label="Outlet">
                <Combobox
                  portal
                  matchTriggerWidth
                  value={f.outlet_id}
                  onChange={(v) => set("outlet_id", v)}
                  options={[{ value: "", label: "—" }, ...outlets.map((o) => ({ value: o.id, label: o.name }))]}
                />
              </Field>
            )}
            <Field label="Penilai">
              <Input value={f.penilai} onChange={(e) => set("penilai", e.target.value)} />
            </Field>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Aspek Penilaian — skala 1 sampai 5
            </p>
            <div className="space-y-2">
              {ASPEK_KINERJA.map((a) => (
                <div key={a.key} className="flex items-center gap-3 rounded-lg border border-border p-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-foreground">{a.label}</p>
                    <p className="text-[11px] text-muted-foreground">bobot {a.bobot}%</p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {[1, 2, 3, 4, 5].map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => set("nilai", { ...f.nilai, [a.key]: v })}
                        className={
                          (f.nilai[a.key] ?? 0) === v
                            ? "grid size-8 place-items-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground"
                            : "grid size-8 place-items-center rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted"
                        }
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 rounded-xl border border-border bg-muted/40 p-3">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-[11px] text-muted-foreground">Skor akhir — dihitung dari bobot tiap aspek</p>
                  <p className="text-2xl font-semibold tabular-nums text-foreground">{skor}</p>
                </div>
                <Badge tone={predikat.tone}>{predikat.label}</Badge>
              </div>
              <Progress className="mt-2" value={skor} tone={predikat.tone === "danger" ? "danger" : "brand"} />
            </div>
          </div>

          <Field label="Catatan Penilaian">
            <Textarea rows={3} value={f.catatan} onChange={(e) => set("catatan", e.target.value)} />
          </Field>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Status">
              <Combobox
                portal
                searchable={false}
                matchTriggerWidth
                value={f.status}
                onChange={(v) => set("status", v as StatusReview)}
                options={(Object.keys(STATUS_REVIEW) as StatusReview[]).map((s) => ({
                  value: s,
                  label: STATUS_REVIEW[s].label,
                }))}
              />
            </Field>
            <Field label="Tanggal Appraisal Review">
              <DatePicker value={f.tgl_review} onChange={(v) => set("tgl_review", v)} />
            </Field>
          </div>

          <Field label="Hasil Peninjauan Bersama Atasan">
            <Textarea rows={3} value={f.hasil_review} onChange={(e) => set("hasil_review", e.target.value)} />
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
