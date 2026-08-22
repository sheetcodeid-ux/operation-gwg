"use client";

// Dikecualikan dari React Compiler.
//
// Antrian System dan Antrian IT Help Desk berulang kali menabrak React error
// #310 di produksi — jumlah hook yang dirender berubah antar-render. Pemeriksa
// aturan hook TIDAK menemukan satu pun pelanggaran di berkas-berkas ini, jadi
// urutan hook di sumbernya memang benar; yang berbeda adalah keluaran
// kompilernya. Berkas ini juga memakai TanStack Table, yang kompilernya sendiri
// tandai "incompatible library".
//
// Dilepas dari kompiler, bukan ditambal dengan penjaga: menambal gejalanya
// berarti menebak, sementara yang pasti adalah halamannya harus berhenti
// mogok untuk orang yang mengerjakan tiket sehari-hari.
"use no memo";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { CircleCheckBig, Clock4, Inbox, Star, Timer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { StatTile } from "@/components/ui/stat";
import { Combobox } from "@/components/ui/combobox";
import { CategoryBarChart } from "@/components/charts/charts";
import {
  SYS_SATISFACTION_META,
  SYS_STATUS_META,
  SYS_TYPE_LABEL,
  SYS_URGENCY_META,
  selisihMs,
  selisihSingkat,
  type SysStatus,
  type SystemRequest,
} from "@/lib/system-shared";

/**
 * Papan tiket IT Help Desk.
 *
 * Antrian yang sudah ada berbentuk daftar-dan-rincian: bagus untuk MENGERJAKAN
 * satu tiket, tapi tidak menjawab pertanyaan yang muncul tiap pagi — mana yang
 * belum disentuh, siapa pegang apa, dan berapa lama orang menunggu. Tampilan
 * ini yang menjawab itu, memakai tabel dan grafik yang sama dengan modul lain
 * supaya tidak ada yang perlu dipelajari ulang.
 *
 * Dua angka yang paling menentukan ada di sini dan tidak ada di tempat lain:
 *
 *  • Respons pertama — jarak dari tiket masuk sampai ADA yang menyentuhnya.
 *    Ini yang membedakan tiket lama karena sulit dari tiket lama karena
 *    terlupakan. Yang kedua jauh lebih perlu diketahui, dan hanya angka ini
 *    yang bisa menunjukkannya.
 *  • Kepuasan pelapor — tiket ditutup oleh yang menangani, jadi tanpa nilai
 *    dari pelapor tidak ada yang tahu apakah masalahnya benar-benar beres.
 */

function fmtWaktu(iso: string) {
  return new Date(iso).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Rata-rata durasi dalam bentuk singkat; null kalau belum ada yang terukur. */
function rataDurasi(nilai: (number | null)[]): string {
  const ada = nilai.filter((n): n is number => n !== null);
  if (ada.length === 0) return "—";
  const rata = ada.reduce((a, b) => a + b, 0) / ada.length;
  const patokan = new Date(0).toISOString();
  return selisihSingkat(patokan, new Date(rata).toISOString()) ?? "—";
}

export function HelpdeskTabel({ rows }: { rows: SystemRequest[] }) {
  const [status, setStatus] = React.useState<SysStatus | "all">("all");
  const [agen, setAgen] = React.useState("all");
  const [puas, setPuas] = React.useState("all");

  const agenOptions = React.useMemo(() => {
    const nama = [...new Set(rows.map((r) => r.handlerName).filter((n): n is string => !!n))].sort();
    return [{ value: "all", label: "Semua agen" }, ...nama.map((n) => ({ value: n, label: n }))];
  }, [rows]);

  const tersaring = React.useMemo(
    () =>
      rows.filter((r) => {
        if (status !== "all" && r.status !== status) return false;
        if (agen !== "all" && r.handlerName !== agen) return false;
        if (puas === "belum" && r.satisfaction !== null) return false;
        if (puas === "sudah" && r.satisfaction === null) return false;
        return true;
      }),
    [rows, status, agen, puas],
  );

  const ringkas = React.useMemo(() => {
    const belum = rows.filter((r) => r.status === "waiting").length;
    const jalan = rows.filter((r) => r.status === "processing").length;
    const selesai = rows.filter((r) => r.status === "done").length;
    const respons = rows.map((r) => selisihMs(r.createdAt, r.firstResponseAt));
    const rampung = rows.map((r) => selisihMs(r.createdAt, r.completedAt));
    const nilai = rows.map((r) => r.satisfaction).filter((n): n is number => n !== null);
    return {
      belum,
      jalan,
      selesai,
      respons: rataDurasi(respons),
      rampung: rataDurasi(rampung),
      // Rata-rata kepuasan hanya bermakna kalau ADA yang menilai. Menampilkan
      // "0,0" saat belum ada penilaian akan terbaca sebagai nilai terburuk,
      // padahal artinya "belum terukur".
      puas: nilai.length ? `${(nilai.reduce((a, b) => a + b, 0) / nilai.length).toFixed(1)} / 5` : "—",
      penilai: nilai.length,
    };
  }, [rows]);

  const perKategori = React.useMemo(() => {
    const peta = new Map<string, number>();
    for (const r of rows) {
      const label = SYS_TYPE_LABEL[r.requestType] ?? r.requestType;
      peta.set(label, (peta.get(label) ?? 0) + 1);
    }
    return [...peta].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  }, [rows]);

  const columns = React.useMemo<ColumnDef<SystemRequest>[]>(
    () => [
      {
        accessorKey: "ticketNo",
        header: "No. Tiket",
        cell: ({ row }) => (
          <span className="whitespace-nowrap font-mono text-xs text-foreground">{row.original.ticketNo ?? "—"}</span>
        ),
      },
      {
        accessorKey: "title",
        header: "Kendala",
        cell: ({ row }) => (
          <div className="min-w-[200px] max-w-[320px]">
            <p className="truncate text-sm font-medium text-foreground">{row.original.title}</p>
            <p className="truncate text-xs text-muted-foreground">
              {SYS_TYPE_LABEL[row.original.requestType]} · {row.original.outletName || "Kantor Pusat"}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const m = SYS_STATUS_META[row.original.status];
          return <Badge tone={m.tone}>{m.label}</Badge>;
        },
      },
      {
        accessorKey: "urgency",
        header: "Urgensi",
        cell: ({ row }) => {
          const m = SYS_URGENCY_META[row.original.urgency];
          return <Badge tone={m.tone}>{m.label}</Badge>;
        },
      },
      {
        accessorKey: "handlerName",
        header: "Agen",
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-sm text-foreground">{row.original.handlerName ?? "—"}</span>
        ),
      },
      {
        accessorKey: "requesterName",
        header: "Pelapor",
        cell: ({ row }) => (
          <div className="min-w-[120px]">
            <p className="truncate text-sm text-foreground">{row.original.requesterName}</p>
            <p className="truncate text-xs text-muted-foreground">{row.original.position}</p>
          </div>
        ),
      },
      {
        id: "respons",
        header: "Respons Pertama",
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-sm text-muted-foreground">
            {selisihSingkat(row.original.createdAt, row.original.firstResponseAt) ?? "—"}
          </span>
        ),
      },
      {
        id: "rampung",
        header: "Waktu Selesai",
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-sm text-muted-foreground">
            {selisihSingkat(row.original.createdAt, row.original.completedAt) ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "satisfaction",
        header: "Kepuasan",
        cell: ({ row }) => {
          const n = row.original.satisfaction;
          if (n === null) {
            return <span className="text-xs text-muted-foreground">{row.original.status === "done" ? "Belum dinilai" : "—"}</span>;
          }
          const m = SYS_SATISFACTION_META[n];
          return <Badge tone={m.tone}>{m.label}</Badge>;
        },
      },
      {
        accessorKey: "createdAt",
        header: "Masuk",
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-xs text-muted-foreground">{fmtWaktu(row.original.createdAt)}</span>
        ),
      },
    ],
    [],
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatTile icon={Inbox} label="Belum Ditangani" value={ringkas.belum} sub={`${rows.length} tiket total`} />
        <StatTile icon={Clock4} label="Sedang Dikerjakan" value={ringkas.jalan} />
        <StatTile icon={CircleCheckBig} label="Selesai" value={ringkas.selesai} />
        <StatTile icon={Timer} label="Rata-rata Respons" value={ringkas.respons} sub="dari tiket masuk sampai disentuh" />
        <StatTile
          icon={Star}
          label="Kepuasan Pelapor"
          value={ringkas.puas}
          sub={ringkas.penilai ? `${ringkas.penilai} penilaian` : "belum ada yang menilai"}
        />
      </div>

      {perKategori.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="mb-3 text-sm font-semibold text-foreground">Kendala Terbanyak</p>
          <CategoryBarChart data={perKategori} height={220} />
        </div>
      )}

      <DataTable
        columns={columns}
        data={tersaring}
        tableId="helpdesk-tiket"
        searchPlaceholder="Cari nomor tiket, kendala, atau pelapor…"
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <Combobox
              value={status}
              onChange={(v) => setStatus(v as SysStatus | "all")}
              options={[
                { value: "all", label: "Semua status" },
                { value: "waiting", label: "Menunggu" },
                { value: "processing", label: "Diproses" },
                { value: "done", label: "Selesai" },
              ]}
              className="w-40"
            />
            <Combobox value={agen} onChange={setAgen} options={agenOptions} className="w-44" searchPlaceholder="Cari agen…" />
            <Combobox
              value={puas}
              onChange={setPuas}
              options={[
                { value: "all", label: "Semua penilaian" },
                { value: "sudah", label: "Sudah dinilai" },
                { value: "belum", label: "Belum dinilai" },
              ]}
              className="w-44"
            />
          </div>
        }
      />
    </div>
  );
}
