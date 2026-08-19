"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { CalendarCheck, CalendarClock, CheckCircle2, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StatTile } from "@/components/ui/stat";
import { RekamanBoard, type BarisRekaman, type Bidang } from "./rekaman";
import { SCOPE_LABEL } from "@/lib/hcmos/pillars";
import { STATUS_SESI, type StatusSesi } from "@/lib/hcmos/penilaian";
import { formatDate } from "@/lib/utils";

/**
 * Appraisal Review — sesi peninjauan hasil penilaian bersama atasan langsung.
 *
 * Pesertanya ditulis sebagai KELOMPOK ("Seluruh Supervisor Outlet"), bukan
 * daftar nama. Yang dijadwalkan memang sesi untuk sekelompok orang; memaksanya
 * jadi daftar nama berarti seratus nama dipilih satu per satu, dan daftar itu
 * sudah basi begitu ada yang masuk atau keluar sebelum harinya tiba.
 */

const t = (r: BarisRekaman, k: string) => (r[k] === null || r[k] === undefined ? "" : String(r[k]));

/** Hari ini dalam bentuk yang sebanding dengan kolom tanggal (YYYY-MM-DD). */
const hariIni = () => new Date().toISOString().slice(0, 10);

export function AppraisalBoard({ rows, bolehUbah }: { rows: BarisRekaman[]; bolehUbah: boolean }) {
  const hari = hariIni();
  const terjadwal = rows.filter((r) => t(r, "status") === "terjadwal");
  // "Akan datang" dihitung dari tanggalnya, bukan dari statusnya. Sesi yang
  // tanggalnya sudah lewat tapi statusnya belum diubah bukan sesi mendatang —
  // ia justru yang perlu ditagih.
  const akanDatang = terjadwal.filter((r) => t(r, "tanggal") >= hari).length;
  const lewatTenggat = terjadwal.filter((r) => t(r, "tanggal") && t(r, "tanggal") < hari).length;
  const selesai = rows.filter((r) => t(r, "status") === "selesai").length;

  const kolom: ColumnDef<BarisRekaman>[] = [
    {
      accessorKey: "tanggal",
      header: "Tanggal",
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-foreground">
          {t(row.original, "tanggal") ? formatDate(t(row.original, "tanggal")) : "—"}
        </span>
      ),
    },
    {
      accessorKey: "peserta",
      header: "Peserta",
      cell: ({ row }) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{t(row.original, "peserta") || "—"}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {SCOPE_LABEL[(t(row.original, "scope") as "manajemen" | "outlet") || "manajemen"]}
          </p>
        </div>
      ),
    },
    {
      accessorKey: "reviewer",
      header: "Reviewer",
      cell: ({ row }) => <span className="text-muted-foreground">{t(row.original, "reviewer") || "—"}</span>,
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const s = (t(row.original, "status") || "terjadwal") as StatusSesi;
        const meta = STATUS_SESI[s];
        const telat = s === "terjadwal" && !!t(row.original, "tanggal") && t(row.original, "tanggal") < hari;
        return (
          <Badge tone={telat ? "danger" : (meta?.tone ?? "neutral")} dot>
            {telat ? "Lewat tenggat" : (meta?.label ?? s)}
          </Badge>
        );
      },
    },
  ];

  const bidang: Bidang[] = [
    { key: "tanggal", label: "Tanggal Sesi", tipe: "tanggal", wajib: true },
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
      key: "peserta",
      label: "Peserta",
      tipe: "teks",
      wajib: true,
      span: 2,
      hint: "Tulis kelompoknya, bukan nama satu per satu — misalnya “Seluruh Supervisor Outlet”.",
    },
    { key: "reviewer", label: "Reviewer", tipe: "teks", span: 2 },
    {
      key: "status",
      label: "Status",
      tipe: "pilihan",
      opsi: (Object.keys(STATUS_SESI) as StatusSesi[]).map((v) => ({ value: v, label: STATUS_SESI[v].label })),
    },
    { key: "catatan", label: "Catatan Hasil Sesi", tipe: "panjang", span: 3 },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile icon={CalendarClock} label="Sesi Akan Datang" value={akanDatang} sub="masih terjadwal" />
        <StatTile
          icon={CalendarCheck}
          label="Lewat Tenggat"
          value={lewatTenggat}
          sub={lewatTenggat === 0 ? "tidak ada yang tertinggal" : "tanggalnya lewat, statusnya belum diubah"}
        />
        <StatTile icon={CheckCircle2} label="Sesi Selesai" value={selesai} sub="sudah ditinjau" />
        <StatTile icon={Users} label="Total Sesi" value={rows.length} sub="seluruh periode" />
      </div>

      <RekamanBoard
        tabel="hc_appraisal_sessions"
        rute="/hc-mos/appraisal"
        tableId="hcmos-appraisal"
        rows={rows}
        bolehUbah={bolehUbah}
        labelTambah="Jadwal Review"
        searchPlaceholder="Cari peserta, reviewer…"
        bawaan={{ scope: "manajemen", status: "terjadwal" }}
        columns={kolom}
        bidang={bidang}
      />
    </div>
  );
}
