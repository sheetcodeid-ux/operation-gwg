"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import {
  Building2,
  CalendarClock,
  ClipboardList,
  Loader2,
  Lock,
  Pencil,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  BRANDS,
  KATEGORI_TURNOVER,
  PRIORITAS_META,
  STATUS_KONTRAK_META,
  durasiBulan,
  masaKerja,
  periodeLabel,
  sisaHari,
  statusKontrak,
  type JenisKontrak,
  type PrioritasRenewal,
} from "@/lib/hcmos/kontrak";
import {
  hapusKontrakAction,
  simpanKontrakAction,
  simpanUpdateBulananAction,
} from "@/lib/actions/hcmos";
import type { KontrakRow, OutletKontrak } from "@/lib/data/hcmos";

/**
 * Kontrak Tracker — pengganti aplikasi HTML terpisah.
 *
 * Tiga hal yang sengaja berbeda dari berkas HTML aslinya:
 *
 *  1. Tidak ada "Portal Supervisor" dengan login sendiri. Supervisor sudah
 *     masuk sebagai dirinya di sistem ini, dan server hanya menerima tulisan
 *     untuk outlet miliknya. Portal lama memakai dropdown 60 outlet + ketik
 *     nama, dan peringatan bila namanya tidak cocok bisa dilewati dengan klik
 *     sekali lagi — artinya siapa pun bisa menulis data outlet siapa pun.
 *  2. Datanya tersimpan di basis data, bukan window.storage. Penyimpanan itu
 *     hanya hidup di dalam Claude; di hosting sendiri tombol simpannya mati.
 *  3. Status, durasi, sisa hari, dan masa kerja dihitung saat dibaca —
 *     tidak ada kolom status yang bisa basi diam-diam.
 */

const kosong = (outletId: string) => ({
  id: undefined as string | undefined,
  outletId,
  nip: "",
  nama: "",
  jabatan: "",
  noKontrak: "",
  jenis: "PKWT" as JenisKontrak | null,
  tglMulai: "",
  tglBerakhir: "",
  kontrakKe: 1,
  prioritasRenewal: "normal" as PrioritasRenewal,
  linkKontrak: "",
  linkKtp: "",
  linkFoto: "",
  catatan: "",
  tglMasukPertama: "",
  tglResign: "",
  kategoriTurnover: "",
  alasanKeluar: "",
});

type FormKontrak = ReturnType<typeof kosong>;

export function KontrakBoard({
  outlets,
  kontrak,
  periode,
  outletSaya,
}: {
  outlets: OutletKontrak[];
  kontrak: KontrakRow[];
  periode: string;
  /** Outlet yang boleh ditulis pengguna ini — dari server, bukan dari peran di peramban. */
  outletSaya: string[];
}) {
  const [tab, setTab] = React.useState("outlet");
  const [brand, setBrand] = React.useState("all");
  const [form, setForm] = React.useState<FormKontrak | null>(null);
  const [lapor, setLapor] = React.useState<OutletKontrak | null>(null);

  const bolehTulis = React.useCallback((outletId: string) => outletSaya.includes(outletId), [outletSaya]);

  const outletTersaring = React.useMemo(
    () => (brand === "all" ? outlets : outlets.filter((o) => o.brand === brand)),
    [outlets, brand],
  );
  const kontrakTersaring = React.useMemo(
    () => (brand === "all" ? kontrak : kontrak.filter((k) => k.brand === brand)),
    [kontrak, brand],
  );

  const aktif = kontrak.filter((k) => !k.keluar);
  const lapors = outlets.filter((o) => o.sudahLapor).length;

  const saringBrand = (
    <Combobox
      portal
      searchable={false}
      value={brand}
      onChange={setBrand}
      className="w-44 shrink-0"
      options={[{ value: "all", label: "Semua Brand" }, ...BRANDS.map((b) => ({ value: b, label: b }))]}
    />
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile icon={Building2} label="Outlet" value={outlets.length} sub="dalam lingkup Anda" />
        <StatTile icon={Users} label="Karyawan Aktif" value={aktif.length} sub="belum keluar" />
        <StatTile
          icon={CalendarClock}
          label="Segera Berakhir"
          value={aktif.filter((k) => k.status === "segera_berakhir").length}
          sub="≤ 60 hari lagi"
        />
        <StatTile
          icon={ClipboardList}
          label={`Lapor ${periodeLabel(periode)}`}
          value={`${lapors}/${outlets.length}`}
          sub="Update Bulanan"
        />
      </div>

      <SegmentedTabs
        className="max-w-xl"
        value={tab}
        onChange={setTab}
        items={[
          { value: "outlet", label: "Outlet", icon: Building2 },
          { value: "karyawan", label: "Karyawan", icon: Users },
          { value: "lapor", label: "Update Bulanan", icon: ClipboardList },
        ]}
      />

      {tab === "outlet" && (
        <TabelOutlet
          rows={outletTersaring}
          toolbar={saringBrand}
          bolehTulis={bolehTulis}
          onTambah={(o) => setForm(kosong(o.id))}
          onLapor={setLapor}
        />
      )}

      {tab === "karyawan" && (
        <TabelKaryawan
          rows={kontrakTersaring}
          toolbar={saringBrand}
          bolehTulis={bolehTulis}
          onUbah={(k) => setForm(keForm(k))}
        />
      )}

      {tab === "lapor" && (
        <PanelLapor rows={outletTersaring} periode={periode} bolehTulis={bolehTulis} onLapor={setLapor} />
      )}

      {form && (
        <DialogKaryawan
          key={form.id ?? "baru"}
          awal={form}
          outlets={outlets}
          onClose={() => setForm(null)}
        />
      )}
      {lapor && <DialogLapor key={lapor.id} outlet={lapor} periode={periode} onClose={() => setLapor(null)} />}
    </div>
  );
}

const keForm = (k: KontrakRow): FormKontrak => ({
  id: k.id,
  outletId: k.outletId,
  nip: k.nip ?? "",
  nama: k.nama,
  jabatan: k.jabatan ?? "",
  noKontrak: k.noKontrak ?? "",
  jenis: k.jenis,
  tglMulai: k.tglMulai ?? "",
  tglBerakhir: k.tglBerakhir ?? "",
  kontrakKe: k.kontrakKe,
  prioritasRenewal: k.prioritasRenewal,
  linkKontrak: k.linkKontrak ?? "",
  linkKtp: k.linkKtp ?? "",
  linkFoto: k.linkFoto ?? "",
  catatan: k.catatan ?? "",
  tglMasukPertama: k.tglMasukPertama ?? "",
  tglResign: k.tglResign ?? "",
  kategoriTurnover: k.kategoriTurnover ?? "",
  alasanKeluar: k.alasanKeluar ?? "",
});

/* ───────────────────────────── tabel outlet ───────────────────────────── */

function TabelOutlet({
  rows,
  toolbar,
  bolehTulis,
  onTambah,
  onLapor,
}: {
  rows: OutletKontrak[];
  toolbar: React.ReactNode;
  bolehTulis: (id: string) => boolean;
  onTambah: (o: OutletKontrak) => void;
  onLapor: (o: OutletKontrak) => void;
}) {
  const columns = React.useMemo<ColumnDef<OutletKontrak>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Outlet",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{row.original.name}</p>
            <p className="truncate text-[11px] text-muted-foreground">
              {row.original.code} · {row.original.areaName}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "brand",
        header: "Brand",
        cell: ({ getValue }) => {
          const b = getValue<string | null>();
          return b ? <Badge tone="neutral">{b}</Badge> : <span className="text-muted-foreground">—</span>;
        },
      },
      { accessorKey: "supervisorName", header: "Supervisor" },
      {
        accessorKey: "aktif",
        header: "Karyawan",
        cell: ({ getValue }) => <span className="tabular-nums text-foreground">{getValue<number>()}</span>,
      },
      {
        id: "kontrak",
        header: "Kontrak",
        cell: ({ row }) => {
          const o = row.original;
          if (o.aktif === 0) return <span className="text-muted-foreground">belum ada data</span>;
          return (
            <div className="flex flex-wrap gap-1">
              {o.segera > 0 && <Badge tone="warning">{o.segera} segera</Badge>}
              {o.berakhir > 0 && <Badge tone="danger">{o.berakhir} berakhir</Badge>}
              {o.belumAdaKontrak > 0 && <Badge tone="neutral">{o.belumAdaKontrak} tanpa kontrak</Badge>}
              {o.segera === 0 && o.berakhir === 0 && o.belumAdaKontrak === 0 && <Badge tone="success">aman</Badge>}
            </div>
          );
        },
      },
      {
        accessorKey: "sudahLapor",
        header: "Update Bulanan",
        cell: ({ row }) =>
          row.original.sudahLapor ? (
            <div className="flex flex-col items-start gap-0.5">
              <Badge tone="success" dot>
                Sudah lapor
              </Badge>
              <span className="text-[10px] text-muted-foreground">{row.original.updateTerakhir?.olehNama}</span>
            </div>
          ) : (
            <Badge tone="warning" dot>
              Belum lapor
            </Badge>
          ),
      },
      {
        id: "aksi",
        header: "",
        cell: ({ row }) => {
          const o = row.original;
          if (!bolehTulis(o.id)) return null;
          return (
            <div className="flex gap-1.5">
              <Button size="sm" variant="subtle" onClick={() => onTambah(o)}>
                <Plus className="size-3.5" /> Karyawan
              </Button>
              <Button size="sm" variant="subtle" onClick={() => onLapor(o)}>
                <ClipboardList className="size-3.5" /> Lapor
              </Button>
            </div>
          );
        },
      },
    ],
    [bolehTulis, onTambah, onLapor],
  );

  return <DataTable tableId="hcmos-outlet" columns={columns} data={rows} toolbar={toolbar} searchPlaceholder="Cari outlet…" />;
}

/* ──────────────────────────── tabel karyawan ──────────────────────────── */

function TabelKaryawan({
  rows,
  toolbar,
  bolehTulis,
  onUbah,
}: {
  rows: KontrakRow[];
  toolbar: React.ReactNode;
  bolehTulis: (id: string) => boolean;
  onUbah: (k: KontrakRow) => void;
}) {
  const router = useRouter();
  const { confirm, dialog } = useConfirm();

  const hapus = React.useCallback(async (k: KontrakRow) => {
    const ya = await confirm({
      title: `Hapus data ${k.nama}?`,
      description: `${k.outletName} — data kontrak dan riwayatnya ikut terhapus dan tidak bisa dikembalikan.`,
      confirmLabel: "Hapus",
      tone: "danger",
    });
    if (!ya) return;
    const res = await hapusKontrakAction(k.id);
    if (res.error) return toast.error(res.error);
    toast.success("Data karyawan dihapus");
    router.refresh();
  }, [confirm, router]);

  const columns = React.useMemo<ColumnDef<KontrakRow>[]>(
    () => [
      {
        accessorKey: "nama",
        header: "Karyawan",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{row.original.nama}</p>
            <p className="truncate text-[11px] text-muted-foreground">
              {row.original.jabatan || "—"}
              {row.original.nip ? ` · ${row.original.nip}` : ""}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "outletName",
        header: "Outlet",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate text-foreground">{row.original.outletName}</p>
            <p className="truncate text-[11px] text-muted-foreground">{row.original.brand ?? "—"}</p>
          </div>
        ),
      },
      {
        accessorKey: "jenis",
        header: "Kontrak",
        cell: ({ row }) => {
          const k = row.original;
          const durasi = durasiBulan(k);
          return (
            <div className="min-w-0">
              <p className="text-foreground">{k.jenis ?? "—"}</p>
              <p className="text-[11px] text-muted-foreground">
                {k.noKontrak || "tanpa nomor"}
                {durasi ? ` · ${durasi} bln` : ""}
              </p>
            </div>
          );
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const k = row.original;
          if (k.keluar) return <Badge tone="neutral">Sudah keluar</Badge>;
          const m = STATUS_KONTRAK_META[k.status];
          const sisa = sisaHari(k);
          return (
            <div className="flex flex-col items-start gap-0.5">
              <Badge tone={m.tone} dot>
                {m.label}
              </Badge>
              {sisa !== null && (
                <span className="text-[10px] text-muted-foreground">
                  {sisa >= 0 ? `${sisa} hari lagi` : `lewat ${Math.abs(sisa)} hari`}
                </span>
              )}
            </div>
          );
        },
      },
      {
        id: "masaKerja",
        header: "Masa Kerja",
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {masaKerja(row.original.tglMasukPertama, row.original.tglResign)}
          </span>
        ),
      },
      {
        id: "aksi",
        header: "",
        cell: ({ row }) => {
          const k = row.original;
          if (!bolehTulis(k.outletId)) return null;
          return (
            <div className="flex gap-1.5">
              <Button size="sm" variant="subtle" onClick={() => onUbah(k)}>
                <Pencil className="size-3.5" /> Ubah
              </Button>
              <Button size="sm" variant="ghost" onClick={() => hapus(k)}>
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          );
        },
      },
    ],
    [bolehTulis, onUbah, hapus],
  );

  return (
    <>
      <DataTable
        tableId="hcmos-karyawan"
        columns={columns}
        data={rows}
        toolbar={toolbar}
        searchPlaceholder="Cari karyawan…"
      />
      {dialog}
    </>
  );
}

/* ─────────────────────────── panel update bulanan ─────────────────────────── */

function PanelLapor({
  rows,
  periode,
  bolehTulis,
  onLapor,
}: {
  rows: OutletKontrak[];
  periode: string;
  bolehTulis: (id: string) => boolean;
  onLapor: (o: OutletKontrak) => void;
}) {
  const sudah = rows.filter((o) => o.sudahLapor);
  const belum = rows.filter((o) => !o.sudahLapor);
  const persen = rows.length ? Math.round((sudah.length / rows.length) * 100) : 0;

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader>
          <CardTitle>Kepatuhan {periodeLabel(periode)}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end justify-between gap-3">
            <p className="text-3xl font-semibold tabular-nums text-foreground">{persen}%</p>
            <p className="text-sm text-muted-foreground">
              {sudah.length} dari {rows.length} outlet
            </p>
          </div>
          <Progress className="mt-3" value={persen} tone={persen >= 80 ? "success" : persen >= 50 ? "warning" : "danger"} />
        </CardContent>
      </Card>

      {belum.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Belum Melapor · {belum.length} outlet</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {belum.map((o) => (
              <div key={o.id} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{o.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">Supervisor: {o.supervisorName}</p>
                </div>
                {bolehTulis(o.id) && (
                  <Button size="sm" variant="subtle" onClick={() => onLapor(o)}>
                    <ClipboardList className="size-3.5" /> Isi Laporan
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {sudah.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Sudah Melapor · {sudah.length} outlet</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {sudah.map((o) => (
              <div key={o.id} className="rounded-xl border border-border p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-medium text-foreground">{o.name}</p>
                  <Badge tone="success">{o.updateTerakhir?.jumlahKaryawan ?? 0} karyawan</Badge>
                </div>
                {o.updateTerakhir?.catatan && (
                  <p className="mt-1.5 whitespace-pre-line text-[12px] leading-relaxed text-foreground/90">
                    {o.updateTerakhir.catatan}
                  </p>
                )}
                <p className="mt-1 text-[11px] text-muted-foreground">oleh {o.updateTerakhir?.olehNama ?? "—"}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ───────────────────────────── dialog karyawan ───────────────────────────── */

/** Bagian terkunci — dihitung sistem, ditampilkan supaya pengisinya tahu hasilnya. */
function Terkunci({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 p-2.5">
      <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
        <Lock className="size-3" /> {label}
      </p>
      <p className="mt-0.5 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function DialogKaryawan({
  awal,
  outlets,
  onClose,
}: {
  awal: FormKontrak;
  outlets: OutletKontrak[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [f, setF] = React.useState<FormKontrak>(awal);
  const [busy, setBusy] = React.useState(false);
  const set = <K extends keyof FormKontrak>(k: K, v: FormKontrak[K]) => setF((p) => ({ ...p, [k]: v }));

  // Bagian 🔒 dihitung ulang setiap tanggalnya berubah — pengisinya langsung
  // melihat akibat dari tanggal yang baru saja ia ketik.
  const hitung = React.useMemo(() => {
    const k = { jenis: f.jenis, tglMulai: f.tglMulai || null, tglBerakhir: f.tglBerakhir || null, tglResign: f.tglResign || null };
    const durasi = durasiBulan(k);
    const sisa = sisaHari(k);
    const st = STATUS_KONTRAK_META[statusKontrak(k)];
    return {
      durasi: durasi ? `${durasi} bulan` : "—",
      sisa: sisa === null ? "—" : sisa >= 0 ? `${sisa} hari` : `lewat ${Math.abs(sisa)} hari`,
      status: st.label,
      masaKerja: masaKerja(f.tglMasukPertama || null, f.tglResign || null),
    };
  }, [f.jenis, f.tglMulai, f.tglBerakhir, f.tglResign, f.tglMasukPertama]);

  async function simpan() {
    if (!f.nama.trim()) return toast.error("Nama karyawan wajib diisi.");
    setBusy(true);
    const res = await simpanKontrakAction(f);
    setBusy(false);
    if (res.error) return toast.error(res.error);
    toast.success(f.id ? "Data karyawan diperbarui" : "Karyawan ditambahkan");
    onClose();
    router.refresh();
  }

  const outletName = outlets.find((o) => o.id === f.outletId)?.name ?? "—";

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        title={f.id ? "Ubah Data Karyawan" : "Tambah Karyawan"}
        description={outletName}
        align="center"
        className="max-w-2xl"
      >
        <div className="max-h-[75vh] space-y-4 overflow-y-auto p-5">
          <Bagian judul="Identitas Karyawan">
            <Field label="NIP">
              <Input value={f.nip} onChange={(e) => set("nip", e.target.value)} placeholder="mis. C24121998" />
            </Field>
            <Field label="Nama Lengkap">
              <Input value={f.nama} onChange={(e) => set("nama", e.target.value)} placeholder="Nama sesuai KTP" />
            </Field>
            <Field label="Jabatan">
              <Input value={f.jabatan} onChange={(e) => set("jabatan", e.target.value)} placeholder="mis. Staff Barista" />
            </Field>
          </Bagian>

          <Bagian judul="Data Kontrak">
            <Field label="No. Kontrak">
              <Input
                value={f.noKontrak}
                onChange={(e) => set("noKontrak", e.target.value)}
                placeholder="mis. 11/NRD-PKWT/V/2026"
              />
            </Field>
            <Field label="Jenis">
              <Combobox
                portal
                searchable={false}
                matchTriggerWidth
                value={f.jenis ?? ""}
                onChange={(v) => set("jenis", (v || null) as JenisKontrak | null)}
                options={[
                  { value: "PKWT", label: "PKWT — kontrak" },
                  { value: "PKWTT", label: "PKWTT — tetap" },
                ]}
              />
            </Field>
            <Field label="Kontrak Ke-">
              <Input
                type="number"
                min={1}
                value={String(f.kontrakKe)}
                onChange={(e) => set("kontrakKe", Math.max(1, Number(e.target.value) || 1))}
              />
            </Field>
            <Field label="Tanggal Mulai">
              <DatePicker value={f.tglMulai} onChange={(v) => set("tglMulai", v)} />
            </Field>
            <Field label="Tanggal Berakhir" hint={f.jenis === "PKWTT" ? "PKWTT tidak punya tanggal berakhir." : undefined}>
              <DatePicker value={f.tglBerakhir} onChange={(v) => set("tglBerakhir", v)} />
            </Field>
            <Field label="Prioritas Perpanjangan">
              <Combobox
                portal
                searchable={false}
                matchTriggerWidth
                value={f.prioritasRenewal}
                onChange={(v) => set("prioritasRenewal", v as PrioritasRenewal)}
                options={(Object.keys(PRIORITAS_META) as PrioritasRenewal[]).map((p) => ({
                  value: p,
                  label: PRIORITAS_META[p].label,
                }))}
              />
            </Field>
          </Bagian>

          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Lock className="size-3.5" /> Status Kontrak — dihitung sistem
            </p>
            <div className="grid gap-2 sm:grid-cols-4">
              <Terkunci label="Durasi" value={hitung.durasi} />
              <Terkunci label="Sisa" value={hitung.sisa} />
              <Terkunci label="Status" value={hitung.status} />
              <Terkunci label="Masa Kerja" value={hitung.masaKerja} />
            </div>
          </div>

          <Bagian judul="Soft File & Lampiran">
            <Field label="Link Kontrak">
              <Input value={f.linkKontrak} onChange={(e) => set("linkKontrak", e.target.value)} placeholder="https://…" />
            </Field>
            <Field label="Link KTP">
              <Input value={f.linkKtp} onChange={(e) => set("linkKtp", e.target.value)} placeholder="https://…" />
            </Field>
            <Field label="Link Foto">
              <Input value={f.linkFoto} onChange={(e) => set("linkFoto", e.target.value)} placeholder="https://…" />
            </Field>
            <Field label="Catatan Dokumen" className="sm:col-span-2">
              <Textarea rows={2} value={f.catatan} onChange={(e) => set("catatan", e.target.value)} />
            </Field>
          </Bagian>

          <Bagian judul="Riwayat & Turnover">
            <Field label="Tgl Masuk Pertama">
              <DatePicker value={f.tglMasukPertama} onChange={(v) => set("tglMasukPertama", v)} />
            </Field>
            <Field label="Tgl Resign / PHK" hint="Diisi hanya bila karyawannya sudah keluar.">
              <DatePicker value={f.tglResign} onChange={(v) => set("tglResign", v)} />
            </Field>
            <Field label="Kategori Turnover">
              <Combobox
                portal
                searchable={false}
                matchTriggerWidth
                value={f.kategoriTurnover}
                onChange={(v) => set("kategoriTurnover", v)}
                options={[{ value: "", label: "—" }, ...KATEGORI_TURNOVER.map((k) => ({ value: k, label: k }))]}
              />
            </Field>
            <Field label="Alasan Keluar" className="sm:col-span-3">
              <Input value={f.alasanKeluar} onChange={(e) => set("alasanKeluar", e.target.value)} />
            </Field>
          </Bagian>

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

function Bagian({ judul, children }: { judul: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{judul}</p>
      <div className="grid gap-3 sm:grid-cols-3">{children}</div>
    </div>
  );
}

/* ────────────────────────────── dialog laporan ────────────────────────────── */

function DialogLapor({
  outlet,
  periode,
  onClose,
}: {
  outlet: OutletKontrak;
  periode: string;
  onClose: () => void;
}) {
  const router = useRouter();
  // Nilai awal diambil dari jumlah karyawan aktif yang tercatat — angka yang
  // paling mungkin benar, dan tetap bisa dikoreksi.
  const [jumlah, setJumlah] = React.useState(String(outlet.updateTerakhir?.jumlahKaryawan ?? outlet.aktif));
  const [catatan, setCatatan] = React.useState(outlet.updateTerakhir?.catatan ?? "");
  const [busy, setBusy] = React.useState(false);

  async function kirim() {
    const n = Number(jumlah);
    if (!Number.isFinite(n) || n < 0) return toast.error("Jumlah karyawan tidak valid.");
    setBusy(true);
    const res = await simpanUpdateBulananAction({
      outletId: outlet.id,
      periode,
      jumlahKaryawan: n,
      catatan,
    });
    setBusy(false);
    if (res.error) return toast.error(res.error);
    toast.success(`Update Bulanan ${periodeLabel(periode)} tersimpan`);
    onClose();
    router.refresh();
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        title={`Update Bulanan — ${periodeLabel(periode)}`}
        description={outlet.name}
        align="center"
        className="max-w-md"
      >
        <div className="space-y-3 p-5">
          <Field label="Jumlah Karyawan Aktif" hint={`Tercatat di Kontrak Tracker: ${outlet.aktif} orang.`}>
            <Input type="number" min={0} value={jumlah} onChange={(e) => setJumlah(e.target.value)} />
          </Field>
          <Field label="Catatan / Laporan">
            <Textarea
              rows={4}
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              placeholder="mis. 1 crew resign akhir bulan, 2 kontrak perlu diperpanjang bulan depan"
            />
          </Field>
          <p className="text-[11px] text-muted-foreground">
            Mengirim ulang pada bulan yang sama akan memperbarui laporan ini, bukan menambah laporan baru.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              Batal
            </Button>
            <Button onClick={kirim} disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />} Kirim Laporan
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
