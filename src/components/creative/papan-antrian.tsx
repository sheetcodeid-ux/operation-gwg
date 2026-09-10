"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { Gauge, ListChecks, UserRound, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { PilihTabel } from "@/components/kpi/papan-kpi";
import { HcRequestReview } from "@/components/hc/request-review";
import { PapanDesign } from "./papan-design";
import { merekOutlet } from "@/lib/kpi/merek";
import type { SumberAntrian } from "@/lib/actions/hc-requests";
import type { BarisKerjaCreative, BarisRaporPeminta, BarisSebaran, RingkasDesign } from "@/lib/data/design-rapor";
import { cn, formatNumber } from "@/lib/utils";

/**
 * Halaman antrian design sebagai TIGA HALAMAN dalam satu.
 *
 * Sebelumnya papan angka ditumpuk di atas antriannya. Yang membuka halaman ini
 * untuk MENGERJAKAN harus menggulir melewati lima kartu dan dua tabel yang
 * tidak sedang ia butuhkan; yang membukanya untuk MENILAI harus menggulir
 * melewati antrian panjang untuk sampai ke angkanya. Keduanya membayar ongkos
 * kebutuhan orang lain.
 *
 * Pengalihnya memakai komponen yang sama persis dengan breadcrumb halaman KPI —
 * bukan yang mirip. Dua pengalih berbeda untuk hal yang sama membuat orang
 * belajar dua kali untuk gerakan yang identik.
 */
type Tab = "antrian" | "performa" | "pemohon";

const angka = (n: number) => formatNumber(n, { maximumFractionDigits: 0 });

export function PapanAntrianDesign({
  sumber,
  papan,
  picOptions,
  kelola,
  meId,
}: {
  sumber: SumberAntrian;
  /** Null bila yang membuka bukan pengelola antrian — ia tidak melihat rapot rekannya. */
  papan: { ringkas: RingkasDesign; peminta: BarisRaporPeminta[]; creative: BarisKerjaCreative[]; sebaranBrand: BarisSebaran[]; sebaranJenis: BarisSebaran[] } | null;
  picOptions: { id: string; name: string; jabatan: string | null }[];
  kelola: boolean;
  meId: string;
}) {
  const [tab, setTab] = React.useState<Tab>("antrian");

  const pilihan = React.useMemo<{ id: Tab; label: string; icon: LucideIcon }[]>(() => {
    const out: { id: Tab; label: string; icon: LucideIcon }[] = [{ id: "antrian", label: "Antrian", icon: ListChecks }];
    // Dua tab angka hanya untuk yang mengelola antrian. Yang mengerjakan
    // melihat pekerjaannya sendiri; menampilkan rapot rekan sedivisi kepadanya
    // mengubah alat kerja jadi papan pengumuman siapa yang tertinggal.
    if (papan) {
      out.push({ id: "performa", label: "Performa Designer", icon: Gauge });
      out.push({ id: "pemohon", label: "Kebiasaan Pemohon", icon: UserRound });
    }
    return out;
  }, [papan]);

  return (
    <div className="flex flex-col gap-3">
      {papan && (
        <div className="flex min-w-0 items-center gap-2">
          <PilihTabel pilihan={pilihan} nilai={tab} onNilai={setTab} />
        </div>
      )}

      {tab === "antrian" && (
        <HcRequestReview mode="hc" kind="design" sumber={sumber} picOptions={picOptions} kelola={kelola} meId={meId} />
      )}

      {tab === "performa" && papan && (
        <>
          <PapanDesign ringkas={papan.ringkas} creative={papan.creative} />
          <div className="grid gap-3 lg:grid-cols-2">
            <Sebaran judul="Permintaan per Brand" baris={papan.sebaranBrand} tableId="design-sebaran-brand" berwarna />
            <Sebaran judul="Permintaan per Jenis Materi" baris={papan.sebaranJenis} tableId="design-sebaran-jenis" />
          </div>
        </>
      )}

      {tab === "pemohon" && papan && <PapanDesign peminta={papan.peminta} />}
    </div>
  );
}

/**
 * Sebaran permintaan — dari mana bebannya datang, dan di mana ia telat.
 *
 * Kolom telat dibawa berdampingan karena beban dan keterlambatan TIDAK selalu
 * menumpuk di tempat yang sama: brand paling ramai belum tentu brand yang
 * paling sering lewat tenggat, dan menambah orang di tempat yang salah tidak
 * memperbaiki apa pun.
 */
function Sebaran({
  judul,
  baris,
  tableId,
  berwarna,
}: {
  judul: string;
  baris: BarisSebaran[];
  tableId: string;
  /** Labelnya nama brand ⇒ digambar sebagai lencana berwarna. */
  berwarna?: boolean;
}) {
  const total = baris.reduce((s, b) => s + b.total, 0);
  const kolom = React.useMemo<ColumnDef<BarisSebaran>[]>(
    () => [
      {
        accessorKey: "label",
        header: judul.replace("Permintaan per ", ""),
        cell: ({ getValue }) => {
          const v = getValue<string>();
          const m = berwarna ? merekOutlet(v) : null;
          return m ? <Badge tone={m.tone}>{m.label}</Badge> : <span className="font-medium text-foreground">{v}</span>;
        },
      },
      {
        accessorKey: "total",
        header: "Permintaan",
        cell: ({ getValue }) => {
          const v = getValue<number>();
          return (
            <span className="tabular-nums text-foreground/80">
              {angka(v)}
              <span className="ml-1.5 text-[11px] text-muted-foreground">
                {total > 0 ? `${Math.round((v / total) * 100)}%` : "—"}
              </span>
            </span>
          );
        },
      },
      {
        accessorKey: "lewatDeadline",
        header: "Lewat Tenggat",
        cell: ({ getValue }) => {
          const v = getValue<number>();
          return <span className={cn("tabular-nums", v > 0 ? "text-rose-600 dark:text-rose-400" : "text-foreground/80")}>{angka(v)}</span>;
        },
      },
    ],
    [judul, berwarna, total],
  );

  if (baris.length === 0) return null;
  return (
    <div>
      <h3 className="mb-2 text-[13px] font-semibold text-foreground">{judul}</h3>
      <DataTable tableId={tableId} columns={kolom} data={baris} stickyHeader={false} showExport={false} showSearch={false} />
    </div>
  );
}
