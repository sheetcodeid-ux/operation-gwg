"use client";

import * as React from "react";
import Link from "next/link";
import { type ColumnDef } from "@tanstack/react-table";
import { BookOpen, Building2, Clock, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { StatTile } from "@/components/ui/stat";
import { GrafikBatang } from "./grafik";
import { SCOPE_LABEL, type HcScope } from "@/lib/hcmos/pillars";
import {
  STATUS_MODUL_META,
  jumlahPeserta,
  ringkasModul,
  type BarisModul,
  type RekamanPelatihan,
} from "@/lib/hcmos/pelatihan";

/**
 * Modul Pelatihan (LMS).
 *
 * Kurikulumnya tetap; yang berubah adalah pelaksanaannya. Karena itu tabel ini
 * SELALU menampilkan seluruh modul — termasuk yang belum pernah dijadwalkan —
 * alih-alih hanya modul yang sudah ada pesertanya. Tabel yang hanya memuat
 * modul terpakai menyembunyikan justru hal yang paling perlu dilihat Learning &
 * Development: modul mana yang belum pernah jalan.
 */
export function ModulPelatihanBoard({ rekaman }: { rekaman: RekamanPelatihan[] }) {
  const [scope, setScope] = React.useState<HcScope>("manajemen");

  const baris = React.useMemo(() => ringkasModul(scope, rekaman), [scope, rekaman]);
  const aktif = baris.filter((m) => m.status !== "belum");

  // Partisipan dihitung hanya dari catatan yang materinya memang ada di
  // kurikulum scope ini — kalau tidak, angka "Total Partisipan" pada tab
  // Manajemen ikut menghitung crew outlet, dan sebaliknya.
  const rekamanScope = React.useMemo(() => {
    const judul = new Set(baris.map((m) => m.judul.trim().toLowerCase()));
    return rekaman.filter((r) => judul.has(r.materi.trim().toLowerCase()));
  }, [rekaman, baris]);
  const totalMenit = baris.reduce((a, m) => a + m.menit, 0);

  const kolom = React.useMemo<ColumnDef<BarisModul>[]>(
    () => [
      {
        accessorKey: "judul",
        header: "Modul",
        cell: ({ row }) => (
          <div className="flex min-w-0 items-start gap-2.5">
            <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-lg bg-muted text-[11px] font-semibold tabular-nums text-foreground">
              {row.original.no}
            </span>
            <span className="min-w-0">
              <span className="block truncate font-medium text-foreground">{row.original.judul}</span>
              <span className="block text-[11px] text-muted-foreground">{row.original.menit} menit</span>
            </span>
          </div>
        ),
      },
      {
        accessorKey: "target",
        header: "Target Peserta",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate text-muted-foreground">{row.original.target}</p>
            <p className="text-[11px] text-muted-foreground">
              {row.original.peserta === 0
                ? "belum ada peserta tercatat"
                : `${row.original.peserta} tercatat · ${row.original.lulus} lulus`}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "bentuk",
        header: "Format",
        cell: ({ getValue }) => <Badge tone="neutral">{getValue<string>()}</Badge>,
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const meta = STATUS_MODUL_META[row.original.status];
          return (
            <Badge tone={meta.tone} dot>
              {meta.label}
            </Badge>
          );
        },
      },
    ],
    [],
  );

  return (
    <div className="space-y-4">
      <SegmentedTabs
        className="max-w-md"
        value={scope}
        onChange={(v) => setScope(v as HcScope)}
        items={[
          { value: "manajemen", label: SCOPE_LABEL.manajemen, icon: Building2 },
          { value: "outlet", label: SCOPE_LABEL.outlet, icon: Users },
        ]}
      />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile icon={BookOpen} label="Modul Aktif" value={aktif.length} sub={`dari ${baris.length} modul kurikulum`} />
        <StatTile
          icon={Users}
          label="Total Partisipan"
          value={jumlahPeserta(rekamanScope)}
          sub="orang berbeda, bukan jumlah baris"
        />
        <StatTile
          icon={Clock}
          label="Total Durasi"
          value={`${Math.round((totalMenit / 60) * 10) / 10} jam`}
          sub={`${totalMenit} menit seluruh modul`}
        />
        <StatTile
          icon={BookOpen}
          label="Belum Dijadwalkan"
          value={baris.length - aktif.length}
          sub="modul tanpa peserta tercatat"
        />
      </div>

      <div>
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold text-foreground">Modul Terjadwal</h2>
          <p className="text-[11px] text-muted-foreground">
            Kurikulum {SCOPE_LABEL[scope]} — status dihitung dari peserta yang tercatat
          </p>
        </div>
        <DataTable
          columns={kolom}
          data={baris}
          tableId={`hcmos-modul-${scope}`}
          searchPlaceholder="Cari modul…"
          pageSize={10}
        />
      </div>

      <GrafikBatang
        judul="Partisipan per Modul"
        subjudul="Sumber: catatan pelatihan — jumlah peserta yang tercatat di tiap modul"
        data={baris.map((m) => ({ nama: m.judul, nilai: m.peserta }))}
        satuan="orang"
        pesanKosong="Belum ada peserta pelatihan yang tercatat untuk kurikulum ini."
      />

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Daftar modul di atas adalah kurikulum resmi Learning &amp; Development, jadi seluruhnya tetap muncul walau belum
        pernah dijadwalkan. Angka peserta dan statusnya dihitung dari catatan pelatihan — tidak ada satu pun yang
        diketik di halaman ini. Pesertanya dicatat di{" "}
        <Link href="/hc-mos/fast-track" className="text-primary hover:underline">
          Fast Start &amp; Fast Track
        </Link>
        , dan karyawan mengerjakan materinya di{" "}
        <Link href="/elearning" className="text-primary hover:underline">
          Self-Learning
        </Link>
        .
      </p>
    </div>
  );
}
