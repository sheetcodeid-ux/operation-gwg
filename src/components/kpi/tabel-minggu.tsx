"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { Progress } from "@/components/ui/progress";
import { merekOutlet } from "@/lib/kpi/merek";
import type { BarisMinggu, RentangMinggu } from "@/lib/kpi/minggu";
import type { DetailMinggu } from "@/lib/data/minggu-outlet";
import { cn, formatIDR, formatIDRShort, formatNumber } from "@/lib/utils";

/**
 * Tabel MINGGU DEMI MINGGU — dipakai KPI Manajemen maupun Coordinator Area.
 *
 * SATU KOMPONEN untuk keduanya, bukan dua yang mirip. Keduanya menjawab
 * pertanyaan yang persis sama — outlet mana yang tertinggal minggu ini, dan
 * harus mengejar berapa — dan hanya berbeda outlet mana yang ikut. Disalin jadi
 * dua, keduanya akan berbeda diam-diam begitu salah satunya diperbaiki, dan
 * satu outlet bisa terbaca tertinggal di satu halaman dan aman di halaman
 * sebelahnya tanpa ada cara tahu mana yang benar.
 */

const AMBANG_HIJAU = 80;

const persen = (n: number | null, digit = 2) =>
  n === null ? "—" : `${formatNumber(n, { minimumFractionDigits: digit, maximumFractionDigits: digit })}%`;

/**
 * Baris SELURUH OUTLET di atas tabel mingguan.
 *
 * Ditaruh di luar tabel, bukan sebagai baris pertama di dalamnya: baris total
 * yang ikut diurutkan dan ikut tersaring kotak cari akan hilang begitu ada
 * yang mengetik nama outlet — persis saat ia paling dibutuhkan sebagai
 * pembanding.
 */
function RingkasMinggu({ detail, judul }: { detail: DetailMinggu; judul: string }) {
  const k = detail.korporat;
  if (!k) return null;
  return (
    <div className="mb-4 overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border/70 px-4 py-2.5">
        <span className="text-[13px] font-semibold text-foreground">{judul}</span>
        <span className="text-[12px] text-muted-foreground">
          {detail.minggu.length} minggu · target sebulan {formatIDR(Math.round(k.targetBulan))}
        </span>
        {detail.tanpaRincian > 0 && (
          <span className="text-[12px] text-muted-foreground">
            · {detail.tanpaRincian} outlet diketik bulanan, tidak ikut dijumlahkan
          </span>
        )}
        <Badge tone={statusMinggu(k).tone} className="ml-auto">
          {statusMinggu(k).label}
        </Badge>
      </div>
      <div className="grid gap-px bg-border/70 sm:grid-cols-2 lg:grid-cols-4">
        <PetakMinggu label="Terkumpul" nilai={formatIDR(Math.round(k.terkumpul))} tebal />
        <PetakMinggu
          label="Target sampai hari ini"
          nilai={formatIDR(Math.round(k.targetSampai))}
          bawah={<BarPersen nilai={k.persen} />}
        />
        <PetakMinggu
          label="Kekurangan"
          nilai={k.kurang > 0 ? formatIDR(Math.round(k.kurang)) : "Tidak ada"}
          warna={k.kurang > 0 ? false : true}
        />
        <PetakMinggu
          label={k.mingguKejar === null ? "Minggu tersisa" : `Minggu ${k.mingguKejar} harus`}
          nilai={k.kejar === null ? "Bulannya sudah habis" : formatIDR(Math.round(k.kejar))}
          bawah={
            k.mingguKejar === null ? undefined : (
              <span className="text-[11px] text-muted-foreground">termasuk menutup kekurangan minggu sebelumnya</span>
            )
          }
        />
      </div>
    </div>
  );
}

function PetakMinggu({
  label,
  nilai,
  tebal,
  warna,
  bawah,
}: {
  label: string;
  nilai: string;
  tebal?: boolean;
  /** true = hijau, false = merah, undefined = warna teks biasa. */
  warna?: boolean;
  bawah?: React.ReactNode;
}) {
  return (
    <div className="bg-card px-4 py-3">
      <p className="text-[11.5px] text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 text-[15px] tabular-nums",
          tebal ? "font-semibold" : "font-medium",
          warna === undefined
            ? "text-foreground"
            : warna
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-rose-600 dark:text-rose-400",
        )}
      >
        {nilai}
      </p>
      {bawah && <div className="mt-1.5">{bawah}</div>}
    </div>
  );
}

/**
 * Yang paling tertinggal di atas.
 *
 * Tabel ini dibuka untuk mencari outlet yang bermasalah, bukan untuk membaca
 * enam puluh outlet berurutan; mengurutnya menurut abjad membuat yang dicari
 * bisa ada di baris mana saja. Outlet tanpa rincian ditaruh paling bawah — ia
 * bukan tertinggal, ia hanya tidak terukur.
 */
const urutMingguTertinggal = (baris: BarisMinggu[]): BarisMinggu[] =>
  [...baris].sort((a, b) => {
    if (a.tanpaRincian !== b.tanpaRincian) return a.tanpaRincian ? 1 : -1;
    return (a.persen ?? Number.POSITIVE_INFINITY) - (b.persen ?? Number.POSITIVE_INFINITY);
  });

/** Kepala kolom minggu: nomornya besar, rentang tanggalnya kecil di bawahnya. */
function KepalaMinggu({ m }: { m: RentangMinggu }) {
  return (
    <div className="whitespace-nowrap leading-tight">
      <div>Minggu {m.minggu}</div>
      <div className="text-[10.5px] font-normal text-muted-foreground">
        tgl {m.dari}–{m.sampai}
      </div>
    </div>
  );
}

/**
 * Satu sel minggu: nominalnya di atas, capaiannya terhadap target minggu itu
 * di bawahnya.
 *
 * Nominal saja tidak cukup — minggu terakhir hanya dua atau tiga hari, jadi
 * angkanya SELALU paling kecil dan selalu terbaca sebagai minggu terburuk.
 * Persentase terhadap target minggu itu sendirilah yang membuat kelimanya
 * sebanding.
 */
function SelMinggu({
  actual,
  target,
  capaian,
  hariAda,
  hariMinggu,
  tanpaRincian,
}: {
  actual: number | null;
  target: number;
  capaian: number | null;
  hariAda: number;
  hariMinggu: number;
  tanpaRincian: boolean;
}) {
  if (tanpaRincian) return <span className="text-[11px] text-muted-foreground">diketik bulanan</span>;
  // Belum ditarik BUKAN nol: outlet yang minggunya belum masuk akan terbaca
  // sebagai outlet yang tutup seminggu penuh.
  if (actual === null) return <span className="text-[11px] text-muted-foreground">belum ditarik</span>;
  const baik = capaian !== null && capaian >= AMBANG_HIJAU;
  const berjalan = hariAda > 0 && hariAda < hariMinggu;
  return (
    <div className="whitespace-nowrap">
      <div className="text-[12.5px] tabular-nums text-foreground/90">{formatIDRShort(actual)}</div>
      <div
        className={cn(
          "text-[11px] tabular-nums",
          capaian === null ? "text-muted-foreground" : baik ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400",
        )}
        title={`Target minggu penuh ${formatIDR(Math.round(target))}${berjalan ? ` · baru ${hariAda} dari ${hariMinggu} hari` : ""}`}
      >
        {capaian === null ? "—" : persen(capaian, 0)}
        {/* Minggu yang belum penuh disebutkan apa adanya. Persentasenya sudah
            diukur terhadap hari yang lewat, jadi tanpa tanda ini ia terbaca
            seolah minggu itu sudah selesai. */}
        {berjalan && <span className="ml-1 text-muted-foreground">· {hariAda}/{hariMinggu} hr</span>}
      </div>
    </div>
  );
}

/**
 * Angka kejar — inti tabel ini.
 *
 * Bukan "kurang sekian" melainkan "minggu ke-N harus sekian": kekurangan
 * memberi tahu apa yang sudah terjadi, sedangkan angka ini memberi tahu apa
 * yang harus dilakukan, dan hanya yang kedua bisa ditindaklanjuti hari itu
 * juga.
 */
function Kejar({ baris }: { baris: BarisMinggu }) {
  if (baris.tanpaRincian) return <span className="text-[11px] text-muted-foreground">—</span>;
  if (baris.kejar === null || baris.mingguKejar === null) {
    return <span className="text-[11px] text-muted-foreground">bulannya sudah habis</span>;
  }
  return (
    <div className="whitespace-nowrap">
      <div className={cn("text-[12.5px] font-medium tabular-nums", baris.kurang > 0 ? "text-rose-600 dark:text-rose-400" : "text-foreground/80")}>
        {formatIDR(Math.round(baris.kejar))}
      </div>
      <div className="text-[11px] text-muted-foreground">
        di Minggu {baris.mingguKejar}
        {baris.kurang > 0 ? ` · nutup ${formatIDRShort(Math.round(baris.kurang))}` : ""}
      </div>
    </div>
  );
}

/** Status baris mingguan — capaian kumulatif, bukan minggu terakhir saja. */
function statusMinggu(b: BarisMinggu): { label: string; tone: "success" | "warning" | "danger" | "neutral" } {
  if (b.tanpaRincian) return { label: "Tanpa rincian", tone: "neutral" };
  if (b.persen === null) return { label: "Belum terukur", tone: "neutral" };
  if (b.persen >= 100) return { label: "Di atas target", tone: "success" };
  if (b.persen >= AMBANG_HIJAU) return { label: "Mendekati", tone: "warning" };
  return { label: "Tertinggal", tone: "danger" };
}


/** Nomor urut baris — mengikuti urutan tabel, bukan id outletnya. */
function kolomNo<T>(): ColumnDef<T> {
  return {
    id: "no",
    header: "#",
    cell: ({ row, table }) => {
      const urut = table.getSortedRowModel().rows.findIndex((r) => r.id === row.id);
      return <span className="tabular-nums text-muted-foreground">{urut + 1}</span>;
    },
    enableSorting: false,
  };
}

/** Bilah persentase hijau/merah — bentuk yang sama dipakai kedua halaman. */
function BarPersen({ nilai }: { nilai: number | null }) {
  if (nilai === null) return <span className="text-[11px] text-muted-foreground">—</span>;
  const baik = nilai >= AMBANG_HIJAU;
  return (
    <div className="flex w-32 items-center gap-2">
      <Progress value={Math.min(100, Math.round(nilai))} tone={baik ? "success" : "danger"} className="h-2" />
      <span className={cn("w-12 text-right text-[11.5px] font-medium tabular-nums", baik ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
        {persen(nilai, 0)}
      </span>
    </div>
  );
}

/**
 * Keterangan ringkas saat kursor diarahkan — versi kecil dari yang di papan
 * Manajemen, cukup untuk menerangkan satu baris yang ditandai.
 */
function Keterangan({ teks }: { teks: string }) {
  return (
    <span
      title={teks}
      aria-label={teks}
      className="shrink-0 cursor-help text-[11px] text-muted-foreground/70"
    >
      ⓘ
    </span>
  );
}

/**
 * Kolom tabel mingguan. `judulGabungan` menamai baris ringkasnya — "Seluruh
 * outlet" untuk korporat, "Seluruh outlet area" untuk Coordinator Area.
 */
export function kolomMinggu(mg: RentangMinggu[]): ColumnDef<BarisMinggu>[] {
  return [
    kolomNo(),
    {
      id: "nama",
      header: "Outlet",
      accessorFn: (b) => b.nama,
      cell: ({ row }) => (
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate font-medium text-foreground">{row.original.nama}</span>
          {row.original.tanpaRincian && (
            <Keterangan teks="Omzet outlet ini diketik sebagai satu angka sebulan karena belum masuk ESB, jadi tidak punya rincian mingguan. Barisnya tetap ditampilkan, tapi tidak ikut dijumlahkan." />
          )}
        </div>
      ),
    },
    {
      id: "merek",
      header: "Brand",
      accessorFn: (b) => merekOutlet(b.nama)?.label ?? "—",
      cell: ({ row }) => {
        const m = merekOutlet(row.original.nama);
        return m ? <Badge tone={m.tone}>{m.label}</Badge> : <span className="text-[11px] text-muted-foreground">—</span>;
      },
    },
    ...mg.map(
      (m): ColumnDef<BarisMinggu> => ({
        id: `m${m.minggu}`,
        header: () => <KepalaMinggu m={m} />,
        accessorFn: (b) => b.actual[m.minggu - 1],
        cell: ({ row }) => (
          <SelMinggu
            actual={row.original.actual[m.minggu - 1]}
            target={row.original.target[m.minggu - 1]}
            capaian={row.original.capaian[m.minggu - 1]}
            hariAda={row.original.hariAda[m.minggu - 1]}
            hariMinggu={m.hari}
            tanpaRincian={row.original.tanpaRincian === true}
          />
        ),
      }),
    ),
    {
      id: "terkumpul",
      header: "Terkumpul",
      accessorFn: (b) => b.terkumpul,
      cell: ({ row }) =>
        row.original.tanpaRincian ? (
          <span className="text-[11px] text-muted-foreground">—</span>
        ) : (
          <div className="whitespace-nowrap">
            <div className="text-[12.5px] font-medium tabular-nums text-foreground">{formatIDR(row.original.terkumpul)}</div>
            <div className="text-[11px] tabular-nums text-muted-foreground">dari {formatIDR(row.original.targetSampai)}</div>
          </div>
        ),
    },
    {
      id: "persen",
      header: "%",
      accessorFn: (b) => b.persen,
      cell: ({ row }) => (row.original.tanpaRincian ? <span className="text-[11px] text-muted-foreground">—</span> : <BarPersen nilai={row.original.persen} />),
    },
    {
      id: "kejar",
      header: "Harus Dikejar",
      accessorFn: (b) => b.kejar,
      cell: ({ row }) => <Kejar baris={row.original} />,
    },
    {
      id: "status",
      header: "Status",
      accessorFn: (b) => statusMinggu(b).label,
      cell: ({ row }) => {
        const st = statusMinggu(row.original);
        return <Badge tone={st.tone}>{st.label}</Badge>;
      },
    },
  ];
}

/**
 * Tab Detail Mingguan lengkap: baris ringkas di atas, tabel outlet di bawah.
 *
 * `tableId` dibedakan tiap halaman supaya pilihan kolom yang disembunyikan
 * pengguna tidak saling menimpa antara Manajemen dan Coordinator Area.
 */
export function TabMinggu({
  detail,
  tableId,
  judul,
  toolbar,
  onExport,
}: {
  detail: DetailMinggu;
  tableId: string;
  judul: string;
  toolbar?: React.ReactNode;
  onExport?: () => void;
}) {
  const kolom = React.useMemo(() => kolomMinggu(detail.minggu), [detail.minggu]);
  return (
    <>
      <RingkasMinggu detail={detail} judul={judul} />
      <DataTable
        tableId={tableId}
        columns={kolom}
        data={urutMingguTertinggal(detail.baris)}
        searchPlaceholder="Cari outlet…"
        stickyHeader={false}
        toolbar={toolbar}
        onExport={onExport}
        exportTitle="Unduh laporan PDF"
      />
    </>
  );
}
