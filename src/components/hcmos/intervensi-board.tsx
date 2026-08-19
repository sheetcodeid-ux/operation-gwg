"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { AlertTriangle, LifeBuoy, ShieldCheck, TrendingDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Tone } from "@/lib/constants";
import { StatTile } from "@/components/ui/stat";
import { RekamanBoard, type BarisRekaman, type Bidang } from "./rekaman";
import { SCOPE_LABEL } from "@/lib/hcmos/pillars";
import {
  LABEL_PERAN_PEMOHON,
  LABEL_STATUS_INTERVENSI,
  LABEL_URGENSI_INTERVENSI,
  peranPemohonUntuk,
  type PeranPemohon,
  type StatusIntervensi,
  type UrgensiIntervensi,
} from "@/lib/hcmos/intervensi";
import type { PilihanOutlet } from "./modul-boards";
import { formatDate } from "@/lib/utils";

/**
 * Request Intervensi Kinerja.
 *
 * Menggantikan Appraisal Review. Bedanya bukan sekadar nama: appraisal review
 * adalah agenda yang dijadwalkan untuk semua orang, sedangkan intervensi adalah
 * PERMINTAAN yang muncul karena ada yang tidak beres pada satu orang. Yang
 * pertama diisi karena kalendernya tiba; yang kedua diisi karena seseorang
 * memutuskan sesuatu perlu ditangani — dan keputusan itulah yang perlu tercatat.
 */

const t = (r: BarisRekaman, k: string) => (r[k] === null || r[k] === undefined ? "" : String(r[k]));

const TONE_STATUS: Record<StatusIntervensi, Tone> = {
  baru: "warning",
  diproses: "cyan",
  selesai: "success",
  ditutup: "neutral",
};

const TONE_URGENSI: Record<UrgensiIntervensi, Tone> = {
  urgent: "danger",
  normal: "amber",
  rendah: "neutral",
};

export function IntervensiBoard({
  rows,
  outlets,
  bolehUbah,
}: {
  rows: BarisRekaman[];
  outlets: PilihanOutlet[];
  bolehUbah: boolean;
}) {
  const belum = rows.filter((r) => t(r, "status") === "baru").length;
  const jalan = rows.filter((r) => t(r, "status") === "diproses").length;
  const dariOwner = rows.filter((r) => t(r, "peran_pemohon") === "owner").length;

  const kolom: ColumnDef<BarisRekaman>[] = [
    {
      accessorKey: "nama",
      header: "Diminta Diintervensi",
      cell: ({ row }) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{t(row.original, "nama")}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {[t(row.original, "jabatan"), t(row.original, "divisi") || row.original.outletName].filter(Boolean).join(" · ") ||
              SCOPE_LABEL[(t(row.original, "scope") as "manajemen" | "outlet") || "manajemen"]}
          </p>
        </div>
      ),
    },
    {
      accessorKey: "pemohon",
      header: "Diminta Oleh",
      cell: ({ row }) => {
        const peran = (t(row.original, "peran_pemohon") || "head") as PeranPemohon;
        return (
          <div className="min-w-0">
            <p className="truncate text-foreground">{t(row.original, "pemohon") || "—"}</p>
            <p className="truncate text-[11px] text-muted-foreground">{LABEL_PERAN_PEMOHON[peran] ?? peran}</p>
          </div>
        );
      },
    },
    {
      accessorKey: "gejala",
      header: "Yang Terlihat Turun",
      cell: ({ row }) => (
        <p className="max-w-xs truncate text-muted-foreground">{t(row.original, "gejala") || "—"}</p>
      ),
    },
    {
      accessorKey: "urgensi",
      header: "Urgensi",
      cell: ({ row }) => {
        const u = (t(row.original, "urgensi") || "normal") as UrgensiIntervensi;
        return <Badge tone={TONE_URGENSI[u] ?? "neutral"}>{LABEL_URGENSI_INTERVENSI[u] ?? u}</Badge>;
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const s = (t(row.original, "status") || "baru") as StatusIntervensi;
        return <Badge tone={TONE_STATUS[s] ?? "neutral"}>{LABEL_STATUS_INTERVENSI[s] ?? s}</Badge>;
      },
    },
    {
      accessorKey: "tanggal",
      header: "Tanggal",
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {t(row.original, "tanggal") ? formatDate(t(row.original, "tanggal")) : "—"}
        </span>
      ),
    },
  ];

  const bidang: Bidang[] = [
    { key: "nama", label: "Nama Karyawan", tipe: "teks", wajib: true, span: 2 },
    { key: "jabatan", label: "Jabatan", tipe: "teks" },
    {
      key: "peran_pemohon",
      label: "Permintaan Datang Dari",
      tipe: "pilihan",
      opsi: (Object.keys(LABEL_PERAN_PEMOHON) as PeranPemohon[]).map((v) => ({
        value: v,
        label: LABEL_PERAN_PEMOHON[v],
      })),
      // Aturan yang disepakati, ditulis di tempat orang mengisinya — bukan di
      // dokumen terpisah yang tidak dibuka saat formulirnya sedang diisi.
      hint: "Anggota tim bermasalah → head divisinya. Head divisi bermasalah → Owner.",
      span: 2,
    },
    { key: "pemohon", label: "Nama Pemohon", tipe: "teks", wajib: true },
    { key: "divisi", label: "Divisi", tipe: "teks" },
    {
      key: "scope",
      label: "Scope",
      tipe: "pilihan",
      opsi: [
        { value: "manajemen", label: SCOPE_LABEL.manajemen },
        { value: "outlet", label: SCOPE_LABEL.outlet },
      ],
    },
    {
      key: "outlet_id",
      label: "Outlet",
      tipe: "pilihan",
      opsi: [{ value: "", label: "—" }, ...outlets.map((o) => ({ value: o.id, label: o.name }))],
    },
    { key: "tanggal", label: "Tanggal Permintaan", tipe: "tanggal" },
    {
      key: "urgensi",
      label: "Urgensi",
      tipe: "pilihan",
      opsi: (Object.keys(LABEL_URGENSI_INTERVENSI) as UrgensiIntervensi[]).map((v) => ({
        value: v,
        label: LABEL_URGENSI_INTERVENSI[v],
      })),
    },
    {
      key: "gejala",
      label: "Yang Terlihat Turun",
      tipe: "panjang",
      span: 3,
      hint: "Contoh: penjualan kanal Instagram turun tiga bulan berturut-turut; laporan mingguan sering terlambat.",
    },
    { key: "tindakan", label: "Tindakan Human Capital", tipe: "panjang", span: 3 },
    {
      key: "status",
      label: "Status",
      tipe: "pilihan",
      opsi: (Object.keys(LABEL_STATUS_INTERVENSI) as StatusIntervensi[]).map((v) => ({
        value: v,
        label: LABEL_STATUS_INTERVENSI[v],
      })),
    },
    { key: "catatan", label: "Catatan", tipe: "panjang", span: 3 },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile icon={LifeBuoy} label="Total Permintaan" value={rows.length} sub="seluruh periode" />
        <StatTile icon={AlertTriangle} label="Belum Ditangani" value={belum} sub="baru masuk" />
        <StatTile icon={TrendingDown} label="Sedang Diproses" value={jalan} sub="intervensi berjalan" />
        <StatTile icon={ShieldCheck} label="Dari Owner" value={dariOwner} sub="menyangkut head divisi" />
      </div>

      <p className="rounded-xl border border-border bg-muted/30 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
        Permintaan datang dari <b className="text-foreground">satu lapis di atas</b> orang yang bersangkutan: kalau yang
        kinerjanya turun anggota tim, head divisinya yang meminta; kalau yang turun head divisinya sendiri, permintaan
        datang dari Owner.
      </p>

      <RekamanBoard
        tabel="hc_interventions"
        rute="/hc-mos/kinerja"
        tableId="hcmos-intervensi"
        rows={rows}
        bolehUbah={bolehUbah}
        labelTambah="Request Intervensi"
        searchPlaceholder="Cari nama, pemohon…"
        bawaan={{
          scope: "manajemen",
          status: "baru",
          urgensi: "normal",
          peran_pemohon: peranPemohonUntuk("anggota"),
        }}
        columns={kolom}
        bidang={bidang}
      />
    </div>
  );
}
