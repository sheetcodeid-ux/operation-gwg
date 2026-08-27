"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { ClipboardCheck, Grid3x3, LifeBuoy, Loader2, Pencil, Plus, Star, Trash2 } from "lucide-react";
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
import {
  BilahModul,
  KerangkaModul,
  LegendaHitung,
  LencanaHak,
  useLayarPenuh,
} from "@/components/hcmos/kit-modul";
import { KompetensiBoard, type PilihanOutlet } from "./modul-boards";
import { IntervensiBoard } from "./intervensi-board";
import type { BarisRekaman } from "./rekaman";
import { hapusBarisAction, simpanBarisAction } from "@/lib/actions/hcmos-lanjutan";
import { SCOPE_LABEL } from "@/lib/hcmos/pillars";
import { ASPEK_KINERJA, predikatKinerja, skorKinerja } from "@/lib/hcmos/lanjutan";

/**
 * Penilaian Kinerja, Request Intervensi, dan Competency Matrix.
 *
 * "Appraisal Review" dihapus di Meeting Fitur HRD dan digantikan Request
 * Intervensi. Keduanya sekilas mirip — sama-sama membahas kinerja seseorang
 * bersama atasannya — tapi pemicunya berlawanan: appraisal review dijadwalkan
 * untuk semua orang dan diisi karena kalendernya tiba, sedangkan intervensi
 * muncul untuk satu orang karena ada yang memutuskan sesuatu perlu ditangani.
 * Yang perlu tercatat adalah keputusan itu, bukan kehadiran di agenda.
 *
 * Kolom `status`, `tgl_review`, dan `hasil_review` sengaja TIDAK dihapus dari
 * baris penilaian: di situlah tersimpan review yang sudah pernah dilakukan.
 * Membuang kolomnya berarti membuang catatan yang sudah ada, hanya supaya
 * tabelnya terlihat rapi.
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
  intervensi,
  outlets,
  bolehUbah,
  tabAwal = "penilaian",
}: {
  penilaian: BarisRekaman[];
  kompetensi: BarisRekaman[];
  intervensi: BarisRekaman[];
  outlets: PilihanOutlet[];
  bolehUbah: boolean;
  tabAwal?: string;
}) {
  const router = useRouter();
  const { confirm, dialog } = useConfirm();
  const [tab, setTab] = React.useState(tabAwal);
  const [form, setForm] = React.useState<FormKinerja | null>(null);
  const [cari, setCari] = React.useState("");
  const [sorotStatus, setSorotStatus] = React.useState<StatusReview | null>(null);
  const { bingkai, layarPenuh, alih } = useLayarPenuh();

  const selesaiDinilai = penilaian.filter((p) => t(p, "status") !== "draf");
  const intervensiBaru = intervensi.filter((r) => t(r, "status") === "baru").length;
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
    (): ColumnDef<BarisRekaman>[] => [
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
      {
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

  /**
   * Pencarian dan saringan status milik modul, bukan milik satu tab.
   *
   * Ketiga tab berbicara tentang orang yang sama. Saringan yang hilang saat
   * berpindah tab memaksa orang mengetik ulang nama yang sedang ditelusurinya
   * — dan yang paling sering ditelusuri justru lintas tab: nilainya berapa,
   * intervensinya apa, kompetensinya kurang di mana.
   */
  const q = cari.trim().toLowerCase();
  const penilaianTersaring = React.useMemo(() => {
    let hasil = penilaian;
    if (sorotStatus) hasil = hasil.filter((r) => (t(r, "status") || "draf") === sorotStatus);
    if (!q) return hasil;
    return hasil.filter((r) =>
      `${t(r, "nama")} ${t(r, "jabatan")} ${t(r, "periode")} ${t(r, "penilai")}`.toLowerCase().includes(q),
    );
  }, [penilaian, sorotStatus, q]);

  const intervensiTersaring = React.useMemo(
    () => (q ? intervensi.filter((r) => `${t(r, "nama")} ${t(r, "jabatan")}`.toLowerCase().includes(q)) : intervensi),
    [intervensi, q],
  );
  const kompetensiTersaring = React.useMemo(
    () => (q ? kompetensi.filter((r) => `${t(r, "nama")} ${t(r, "jabatan")}`.toLowerCase().includes(q)) : kompetensi),
    [kompetensi, q],
  );

  const menyaring = q !== "" || sorotStatus !== null;

  // Legenda dihitung dari SELURUH penilaian: menyorot satu status tidak boleh
  // membuat dua status lain jatuh ke nol, kalau tidak ia tak bisa dipakai untuk
  // kembali.
  const rekapStatus = React.useMemo(
    () =>
      (Object.keys(STATUS_REVIEW) as StatusReview[]).map((st) => ({
        key: st,
        kode: KODE_REVIEW[st],
        label: STATUS_REVIEW[st].label,
        jumlah: penilaian.filter((r) => (t(r, "status") || "draf") === st).length,
        warna: WARNA_REVIEW[st],
        judulPenuh: STATUS_REVIEW[st].label,
      })),
    [penilaian],
  );

  const tampil =
    tab === "intervensi" ? intervensiTersaring.length : tab === "kompetensi" ? kompetensiTersaring.length : penilaianTersaring.length;
  const total = tab === "intervensi" ? intervensi.length : tab === "kompetensi" ? kompetensi.length : penilaian.length;

  return (
    <KerangkaModul ref={bingkai}>
      <BilahModul
        ikon={JUDUL_TAB[tab]?.ikon ?? Star}
        gradien="from-fuchsia-500 via-purple-500 to-violet-600 shadow-purple-500/20"
        judul={JUDUL_TAB[tab]?.judul ?? "Penilaian Kinerja"}
        ringkas={
          <>
            {penilaian.length} penilaian · {selesaiDinilai.length} selesai · rerata {rerata}/100 ·{" "}
            {intervensiBaru} intervensi belum ditangani
          </>
        }
        cari={cari}
        onCari={setCari}
        cariPlaceholder="Cari nama, periode, penilai…"
        hitung={{ tampil, total }}
        menyaring={menyaring}
        onBersihkan={() => {
          setCari("");
          setSorotStatus(null);
        }}
        panduan={PANDUAN_TAB[tab] ?? "kinerja"}
        tampilan={
          <SegmentedTabs
            className="w-full sm:w-auto"
            size="sm"
            value={tab}
            onChange={setTab}
            items={[
              { value: "penilaian", label: "Penilaian", icon: Star },
              { value: "intervensi", label: "Intervensi", icon: LifeBuoy },
              { value: "kompetensi", label: "Kompetensi", icon: Grid3x3 },
            ]}
          />
        }
        aksi={
          bolehUbah && tab === "penilaian" ? (
            <Button size="sm" className="shrink-0" onClick={() => setForm(kosong())}>
              <Plus className="size-3.5" /> Penilaian
            </Button>
          ) : null
        }
        layarPenuh={layarPenuh}
        onLayarPenuh={alih}
      />

      <div className="min-h-0 flex-1 overflow-auto p-3">
        {/* Ringkasan penilaian sudah ditampilkan halamannya sendiri di atas, dan
            jauh lebih berguna di sana karena punya penyebutnya. Menampilkannya
            dua kali membuat pembacanya membandingkan dua angka yang sebenarnya
            mengukur hal yang sama. */}
        {tab !== "penilaian" && (
          <div className="mb-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile icon={Star} label="Penilaian" value={penilaian.length} sub="seluruh periode" />
            <StatTile
              icon={LifeBuoy}
              label="Request Intervensi"
              value={intervensi.length}
              sub={`${intervensiBaru} belum ditangani`}
            />
            <StatTile icon={ClipboardCheck} label="Penilaian Selesai" value={selesaiDinilai.length} sub="bukan draf" />
            <StatTile icon={Star} label="Rerata Skor" value={rerata} sub="dari 100" />
          </div>
        )}

        {tab === "penilaian" && (
          <DataTable
            tableId="hcmos-penilaian"
            columns={kolom()}
            data={penilaianTersaring}
            showSearch={false}
            maxHeight="none"
          />
        )}

        {tab === "intervensi" && (
          <IntervensiBoard rows={intervensiTersaring} outlets={outlets} bolehUbah={bolehUbah} />
        )}

        {tab === "kompetensi" && <KompetensiBoard rows={kompetensiTersaring} bolehUbah={bolehUbah} />}
      </div>

      <LegendaHitung
        butir={rekapStatus}
        sorot={sorotStatus}
        onSorot={(k) => {
          setSorotStatus((v) => (v === k ? null : (k as StatusReview)));
          setTab("penilaian");
        }}
        kiri={<LencanaHak bolehUbah={bolehUbah} />}
      />

      {form && <DialogKinerja key={form.id ?? "baru"} awal={form} outlets={outlets} onClose={() => setForm(null)} />}
      {dialog}
    </KerangkaModul>
  );
}

/**
 * Judul dan panduan mengikuti tab, bukan halamannya.
 *
 * Tiga menu sidebar bermuara ke satu modul ini, dan tabnya bisa berpindah tanpa
 * halamannya dimuat ulang — jadi aturannya harus hidup di sini, bukan di berkas
 * halaman. Pengisinya pun berbeda: penilaian diisi atasan langsung, kompetensi
 * hanya dibaca, intervensi diajukan siapa pun yang membawahi orangnya.
 */
const JUDUL_TAB: Record<string, { judul: string; ikon: typeof Star }> = {
  penilaian: { judul: "Penilaian Kinerja", ikon: Star },
  intervensi: { judul: "Request Intervensi", ikon: LifeBuoy },
  kompetensi: { judul: "Competency Matrix", ikon: Grid3x3 },
};
const PANDUAN_TAB: Record<string, string> = {
  penilaian: "kinerja",
  intervensi: "intervensi",
  kompetensi: "kompetensi",
};

const KODE_REVIEW: Record<StatusReview, string> = { draf: "D", selesai: "S", ditinjau: "T" };
const WARNA_REVIEW: Record<StatusReview, [string, string]> = {
  draf: ["#d97706", "#fbbf24"],
  selesai: ["#4f46e5", "#818cf8"],
  ditinjau: ["#059669", "#34d399"],
};

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
