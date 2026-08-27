"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { Building2, Database, UserMinus, UserPlus, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { StatTile } from "@/components/ui/stat";
import {
  BilahModul,
  KerangkaModul,
  useLayarPenuh,
} from "@/components/hcmos/kit-modul";
import { GrafikBatang, GrafikDonat } from "./grafik";
import { kelompokDari } from "@/lib/hcmos/struktur";
import { formatDate } from "@/lib/utils";
import { SCOPE_LABEL, type HcScope } from "@/lib/hcmos/pillars";
import { STATUS_KONTRAK_META, masaKerja } from "@/lib/hcmos/kontrak";
import type { KontrakRow } from "@/lib/data/hcmos";

export interface KaryawanManajemen {
  id: string;
  nama: string;
  email: string;
  departemen: string;
  jabatan: string;
  aktif: boolean;
  /** Tanggal akun dibuat — dipakai menghitung yang bergabung tahun berjalan. */
  bergabung: string | null;
}

/**
 * Database Karyawan — dua scope, dua sumber, tidak ada daftar ketiga.
 *
 * Manajemen dibaca dari User Management; outlet dari Kontrak Tracker. Halaman
 * ini hanya menyajikan, tidak menyimpan apa pun sendiri — supaya tidak pernah
 * ada versi kedua dari data orang yang sama.
 */
export function KaryawanBoard({
  manajemen,
  outlet,
}: {
  manajemen: KaryawanManajemen[];
  outlet: KontrakRow[];
}) {
  const [scope, setScope] = React.useState<HcScope>("manajemen");
  const [cari, setCari] = React.useState("");
  const { bingkai, layarPenuh, alih } = useLayarPenuh();

  const q = cari.trim().toLowerCase();
  const manajemenTampil = React.useMemo(
    () =>
      q
        ? manajemen.filter((k) => `${k.nama} ${k.email} ${k.departemen} ${k.jabatan}`.toLowerCase().includes(q))
        : manajemen,
    [manajemen, q],
  );
  const cocokOutlet = React.useCallback(
    (k: KontrakRow) => !q || `${k.nama} ${k.outletName} ${k.jabatan ?? ""} ${k.nip ?? ""}`.toLowerCase().includes(q),
    [q],
  );

  const kolomManajemen = React.useMemo<ColumnDef<KaryawanManajemen>[]>(
    () => [
      {
        accessorKey: "nama",
        header: "Nama",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{row.original.nama}</p>
            <p className="truncate text-[11px] text-muted-foreground">{row.original.email}</p>
          </div>
        ),
      },
      { accessorKey: "departemen", header: "Departemen" },
      { accessorKey: "jabatan", header: "Jabatan" },
      {
        accessorKey: "aktif",
        header: "Status",
        cell: ({ getValue }) =>
          getValue<boolean>() ? (
            <Badge tone="success" dot>
              Aktif
            </Badge>
          ) : (
            <Badge tone="neutral" dot>
              Nonaktif
            </Badge>
          ),
      },
    ],
    [],
  );

  const kolomOutlet = React.useMemo<ColumnDef<KontrakRow>[]>(
    () => [
      {
        accessorKey: "nama",
        header: "Nama",
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
        header: "Jenis",
        cell: ({ getValue }) => <span className="text-muted-foreground">{getValue<string | null>() ?? "—"}</span>,
      },
      {
        accessorKey: "status",
        header: "Status Kontrak",
        cell: ({ row }) => {
          const k = row.original;
          if (k.keluar) return <Badge tone="neutral">Sudah keluar</Badge>;
          const m = STATUS_KONTRAK_META[k.status];
          return (
            <Badge tone={m.tone} dot>
              {m.label}
            </Badge>
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
    ],
    [],
  );

  /* ── ringkasan, dihitung dari daftar yang sama dengan tabelnya ─────────── */

  const tahunIni = String(new Date().getFullYear());
  const ringkas = React.useMemo(() => {
    const aktif = manajemen.filter((m) => m.aktif);
    const perKelompok = new Map<string, number>();
    const perJabatan = new Map<string, number>();
    for (const m of aktif) {
      const k = kelompokDari(m.departemen);
      perKelompok.set(k, (perKelompok.get(k) ?? 0) + 1);
      const j = m.jabatan && m.jabatan !== "—" ? m.jabatan : "Belum Diisi";
      perJabatan.set(j, (perJabatan.get(j) ?? 0) + 1);
    }
    const urut = (peta: Map<string, number>) =>
      [...peta.entries()].map(([nama, nilai]) => ({ nama, nilai })).sort((a, b) => b.nilai - a.nilai);
    return {
      aktif: aktif.length,
      nonaktif: manajemen.length - aktif.length,
      bergabung: aktif.filter((m) => (m.bergabung ?? "").startsWith(tahunIni)).length,
      kelompok: urut(perKelompok),
      // Delapan teratas saja: ekor jabatan yang masing-masing berisi satu orang
      // memanjangkan grafiknya tanpa menambah satu pun hal yang bisa dibaca.
      jabatan: urut(perJabatan).slice(0, 8),
    };
  }, [manajemen, tahunIni]);

  const keluarOutlet = React.useMemo(
    () => outlet.filter((k) => k.keluar).sort((a, b) => (b.tglResign ?? "").localeCompare(a.tglResign ?? "")),
    [outlet],
  );

  const outletTampil = React.useMemo(() => outlet.filter(cocokOutlet), [outlet, cocokOutlet]);
  const keluarTampil = React.useMemo(() => keluarOutlet.filter(cocokOutlet), [keluarOutlet, cocokOutlet]);

  const kolomKeluar = React.useMemo<ColumnDef<KontrakRow>[]>(
    () => [
      {
        accessorKey: "nama",
        header: "Nama",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{row.original.nama}</p>
            <p className="truncate text-[11px] text-muted-foreground">{row.original.outletName}</p>
          </div>
        ),
      },
      {
        accessorKey: "jabatan",
        header: "Jabatan",
        cell: ({ row }) => <span className="text-muted-foreground">{row.original.jabatan || "—"}</span>,
      },
      {
        accessorKey: "tglResign",
        header: "Tanggal Keluar",
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted-foreground">
            {row.original.tglResign ? formatDate(row.original.tglResign) : "—"}
          </span>
        ),
      },
      {
        accessorKey: "kategoriTurnover",
        header: "Kategori",
        cell: ({ row }) => <Badge tone="neutral">{row.original.kategoriTurnover || "Tidak Dicatat"}</Badge>,
      },
      {
        accessorKey: "alasanKeluar",
        header: "Alasan",
        cell: ({ row }) => (
          <p className="max-w-xs truncate text-muted-foreground">{row.original.alasanKeluar || "—"}</p>
        ),
      },
    ],
    [],
  );

  return (
    <KerangkaModul ref={bingkai}>
      <BilahModul
        ikon={Database}
        gradien="from-teal-500 via-emerald-500 to-green-600 shadow-emerald-500/20"
        judul="Database Karyawan"
        ringkas={
          <>
            {SCOPE_LABEL[scope]} ·{" "}
            {scope === "manajemen"
              ? `${ringkas.aktif} aktif · ${ringkas.nonaktif} nonaktif · ${ringkas.kelompok.length} kelompok divisi`
              : `${outlet.length} karyawan outlet — sumber Kontrak Tracker`}
          </>
        }
        cari={cari}
        onCari={setCari}
        cariPlaceholder={scope === "manajemen" ? "Cari nama, email, departemen…" : "Cari nama, outlet…"}
        hitung={{
          tampil: scope === "manajemen" ? manajemenTampil.length : outletTampil.length,
          total: scope === "manajemen" ? manajemen.length : outlet.length,
        }}
        menyaring={q !== ""}
        onBersihkan={() => setCari("")}
        panduan="karyawan"
        saringan={
          <SegmentedTabs
            className="w-full sm:w-auto"
            size="sm"
            value={scope}
            onChange={(v) => setScope(v as HcScope)}
            items={[
              { value: "manajemen", label: SCOPE_LABEL.manajemen, icon: Building2 },
              { value: "outlet", label: SCOPE_LABEL.outlet, icon: Users },
            ]}
          />
        }
        layarPenuh={layarPenuh}
        onLayarPenuh={alih}
      />

      <div className="min-h-0 flex-1 space-y-4 overflow-auto p-3">
      {scope === "manajemen" ? (
        <>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile icon={Users} label="Karyawan Aktif" value={ringkas.aktif} sub="Manajemen (GWG)" />
            <StatTile icon={UserMinus} label="Nonaktif" value={ringkas.nonaktif} sub="akun dinonaktifkan" />
            <StatTile icon={UserPlus} label={`Bergabung ${tahunIni}`} value={ringkas.bergabung} sub="sepanjang tahun ini" />
            <StatTile icon={Building2} label="Kelompok Divisi" value={ringkas.kelompok.length} sub="yang terisi orang" />
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)] gap-3 lg:grid-cols-2">
            <GrafikDonat
              judul="Komposisi per Kelompok Divisi"
              subjudul="Karyawan aktif — sumber User Management"
              data={ringkas.kelompok}
              pesanKosong="Belum ada karyawan aktif."
            />
            <GrafikBatang
              judul="Jabatan Terbanyak"
              subjudul="Delapan jabatan dengan karyawan terbanyak"
              data={ringkas.jabatan}
              pesanKosong="Jabatan belum diisi di User Management."
            />
          </div>

          <DataTable
            tableId="hcmos-karyawan-manajemen"
            columns={kolomManajemen}
            data={manajemenTampil}
            showSearch={false}
            maxHeight="none"
          />
          <p className="text-[11px] text-muted-foreground">
            Sumber: User Management. Penambahan, perubahan jabatan, dan penonaktifan dilakukan di sana.
          </p>
        </>
      ) : (
        <>
          <DataTable
            tableId="hcmos-karyawan-outlet"
            columns={kolomOutlet}
            data={outletTampil}
            showSearch={false}
            maxHeight="none"
          />
          <p className="text-[11px] text-muted-foreground">
            Sumber: Kontrak Tracker. Data diisi Supervisor outlet masing-masing.
          </p>

          {keluarOutlet.length > 0 && (
            <>
              <h3 className="pt-2 text-sm font-semibold text-foreground">Karyawan Non-Aktif (Keluar)</h3>
              <DataTable
                tableId="hcmos-karyawan-keluar"
                columns={kolomKeluar}
                data={keluarTampil}
                showSearch={false}
                maxHeight="none"
              />
            </>
          )}
        </>
      )}
      </div>
    </KerangkaModul>
  );
}
