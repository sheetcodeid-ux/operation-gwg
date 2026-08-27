"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { DataTable } from "@/components/ui/data-table";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { useConfirm } from "@/components/ui/confirm";
import { hapusBarisAction, simpanBarisAction } from "@/lib/actions/hcmos-lanjutan";
import type { TabelHcmos } from "@/lib/hcmos/tabel";

/**
 * Papan rekaman umum: tabel + formulir + hapus.
 *
 * Dipakai modul pilar yang bentuknya memang sama (kompetensi, kinerja, karier,
 * cuti, payroll, benefit, golongan, kasus). Kolom tabel dan bidang formulirnya
 * tetap ditulis per modul — yang dipakai bersama hanya mekanikanya, bukan isinya,
 * supaya tiap modul tetap bisa menampilkan hal yang memang khas baginya.
 */

export type TipeBidang = "teks" | "angka" | "tanggal" | "pilihan" | "panjang" | "boolean";

/** Pilihan untuk bidang bertipe boolean — teksnya tetap, nilainya boolean. */
const OPSI_BOOLEAN = [
  { value: "ya", label: "Ya" },
  { value: "tidak", label: "Belum" },
];

export interface Bidang {
  key: string;
  label: string;
  tipe: TipeBidang;
  opsi?: { value: string; label: string }[];
  hint?: string;
  /** Lebar kolom di kisi formulir (1–3). */
  span?: 1 | 2 | 3;
  /** Bidang wajib — dicek sebelum dikirim. */
  wajib?: boolean;
}

export type BarisRekaman = Record<string, unknown> & {
  id: string;
  /** Nama outlet, sudah dilekatkan lapisan data bila tabelnya punya outlet_id. */
  outletName?: string | null;
};

export function RekamanBoard({
  tabel,
  rute,
  tableId,
  rows,
  columns,
  bidang,
  bawaan,
  bolehUbah,
  labelTambah,
  toolbar,
  searchPlaceholder,
  showSearch = true,
  maxHeight,
}: {
  tabel: TabelHcmos;
  rute: string;
  tableId: string;
  rows: BarisRekaman[];
  columns: ColumnDef<BarisRekaman>[];
  bidang: Bidang[];
  /** Nilai awal untuk baris baru. */
  bawaan: Record<string, unknown>;
  bolehUbah: boolean;
  labelTambah: string;
  toolbar?: React.ReactNode;
  searchPlaceholder?: string;
  /**
   * Modul yang sudah punya kotak cari sendiri di batang alatnya mematikan yang
   * ini. Dua kotak cari yang menyaring hal berbeda — dan yang satu tidak
   * menghitung yang lain — adalah cara tercepat membuat orang salah baca.
   */
  showSearch?: boolean;
  maxHeight?: string;
}) {
  const router = useRouter();
  const { confirm, dialog } = useConfirm();
  const [form, setForm] = React.useState<{ isi: Record<string, unknown>; id?: string } | null>(null);

  const hapus = React.useCallback(
    async (baris: BarisRekaman) => {
      const ya = await confirm({
        title: "Hapus data ini?",
        description: "Tindakan ini tidak bisa dibatalkan.",
        confirmLabel: "Hapus",
        tone: "danger",
      });
      if (!ya) return;
      const res = await hapusBarisAction({ tabel, id: baris.id, rute });
      if (res.error) return toast.error(res.error);
      toast.success("Data dihapus");
      router.refresh();
    },
    [confirm, router, tabel, rute],
  );

  const kolomLengkap = React.useMemo<ColumnDef<BarisRekaman>[]>(() => {
    if (!bolehUbah) return columns;
    return [
      ...columns,
      {
        id: "aksi",
        header: "",
        cell: ({ row }) => (
          <div className="flex gap-1.5">
            <Button size="sm" variant="subtle" onClick={() => setForm({ isi: { ...row.original }, id: row.original.id })}>
              <Pencil className="size-3.5" /> Ubah
            </Button>
            <Button size="sm" variant="ghost" onClick={() => hapus(row.original)}>
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        ),
      },
    ];
  }, [columns, bolehUbah, hapus]);

  return (
    <>
      <DataTable
        tableId={tableId}
        columns={kolomLengkap}
        data={rows}
        showSearch={showSearch}
        maxHeight={maxHeight}
        searchPlaceholder={searchPlaceholder ?? "Cari…"}
        toolbar={
          <div className="contents">
            {toolbar}
            {bolehUbah && (
              <Button size="sm" className="shrink-0" onClick={() => setForm({ isi: { ...bawaan } })}>
                <Plus className="size-3.5" /> {labelTambah}
              </Button>
            )}
          </div>
        }
      />
      {form && (
        <DialogRekaman
          key={form.id ?? "baru"}
          tabel={tabel}
          rute={rute}
          bidang={bidang}
          awal={form.isi}
          id={form.id}
          onClose={() => setForm(null)}
        />
      )}
      {dialog}
    </>
  );
}

function DialogRekaman({
  tabel,
  rute,
  bidang,
  awal,
  id,
  onClose,
}: {
  tabel: TabelHcmos;
  rute: string;
  bidang: Bidang[];
  awal: Record<string, unknown>;
  id?: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [f, setF] = React.useState<Record<string, unknown>>(awal);
  const [busy, setBusy] = React.useState(false);
  const set = (k: string, v: unknown) => setF((p) => ({ ...p, [k]: v }));
  const teks = (k: string) => {
    const v = f[k];
    if (v === null || v === undefined) return "";
    // Kolom boolean disimpan sebagai true/false tapi dipilih lewat daftar;
    // keduanya dijembatani di satu tempat supaya nilai lama yang sudah ada di
    // basis data tetap terbaca benar saat formulirnya dibuka.
    if (typeof v === "boolean") return v ? "ya" : "tidak";
    return String(v);
  };

  async function simpan() {
    const kurang = bidang.find((b) => b.wajib && !teks(b.key).trim());
    if (kurang) return toast.error(`${kurang.label} wajib diisi.`);

    // Angka dikirim sebagai angka, bukan teks — kolomnya numeric di basis data.
    const isi: Record<string, unknown> = {};
    for (const b of bidang) {
      const v = teks(b.key).trim();
      if (b.tipe === "angka") isi[b.key] = v === "" ? null : Number(v);
      // Kolomnya boolean di basis data; mengirim "ya" sebagai teks akan
      // ditolak, dan mengirim null membuat langkah yang belum selesai tercatat
      // sebagai "tidak diketahui" alih-alih "belum".
      else if (b.tipe === "boolean") isi[b.key] = v === "ya";
      else isi[b.key] = v === "" ? null : v;
    }

    setBusy(true);
    const res = await simpanBarisAction({ tabel, isi, id, rute });
    setBusy(false);
    if (res.error) return toast.error(res.error);
    toast.success(id ? "Data diperbarui" : "Data ditambahkan");
    onClose();
    router.refresh();
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        title={id ? "Ubah Data" : "Tambah Data"}
        description="Isi yang diketahui saja — bagian kosong bisa dilengkapi nanti."
        align="center"
        className="max-w-2xl"
      >
        <div className="max-h-[75vh] space-y-3 overflow-y-auto p-5">
          <div className="grid gap-3 sm:grid-cols-3">
            {bidang.map((b) => (
              <Field
                key={b.key}
                label={b.label}
                hint={b.hint}
                className={b.span === 3 ? "sm:col-span-3" : b.span === 2 ? "sm:col-span-2" : undefined}
              >
                {b.tipe === "pilihan" || b.tipe === "boolean" ? (
                  <Combobox
                    portal
                    matchTriggerWidth
                    searchable={b.tipe === "pilihan" && (b.opsi?.length ?? 0) > 8}
                    value={teks(b.key)}
                    onChange={(v) => set(b.key, v)}
                    options={b.tipe === "boolean" ? OPSI_BOOLEAN : (b.opsi ?? [])}
                  />
                ) : b.tipe === "tanggal" ? (
                  <DatePicker value={teks(b.key)} onChange={(v) => set(b.key, v)} />
                ) : b.tipe === "panjang" ? (
                  <Textarea rows={3} value={teks(b.key)} onChange={(e) => set(b.key, e.target.value)} />
                ) : (
                  <Input
                    type={b.tipe === "angka" ? "number" : "text"}
                    value={teks(b.key)}
                    onChange={(e) => set(b.key, e.target.value)}
                  />
                )}
              </Field>
            ))}
          </div>

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
