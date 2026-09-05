"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { Download, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { Progress } from "@/components/ui/progress";
import { buatZip } from "@/lib/zip";
import type { DetailOutletCa, EntriKpi } from "@/lib/data/kpi";
import { formatDate, formatIDR, formatNumber } from "@/lib/utils";

/**
 * Tiga tabel pemantauan Coordinator Area — Hygiene Audit/CCTV, Net Profit, dan
 * Harga Pokok Penjualan.
 *
 * KENAPA TERPISAH DARI TABEL INDIKATOR. Tabel indikator menjawab "berapa
 * skornya"; tabel-tabel ini menjawab "dari mana angkanya". Satu baris
 * "Net Profit 74%" tidak bisa dibantah maupun dibetulkan oleh siapa pun,
 * sementara daftar per outlet bisa langsung ditunjuk: outlet mana yang belum
 * disetor, mana yang angkanya janggal.
 *
 * Semuanya HANYA BACA. Isiannya tetap satu pintu, lewat Catat Kegiatan — dua
 * pintu ke angka yang sama membuat orang mengisi dua kali tanpa sadar.
 */

const persen = (n: number | null, digit = 2) =>
  n === null ? "—" : `${formatNumber(n, { minimumFractionDigits: digit, maximumFractionDigits: digit })}%`;

function Rp({ v, muted }: { v: number | null; muted?: boolean }) {
  if (v === null) return <span className="text-[11px] text-muted-foreground">belum diisi</span>;
  return <span className={muted ? "tabular-nums text-muted-foreground" : "tabular-nums text-foreground/80"}>{formatIDR(v)}</span>;
}

/** Bagian satu angka terhadap gross sales — dasar keduanya sama, jadi satu fungsi. */
export function bagianDari(nilai: number | null, gross: number | null): number | null {
  if (nilai === null || gross === null || gross <= 0) return null;
  return (nilai / gross) * 100;
}

/* ─────────────────────────── hygiene audit / cctv ─────────────────────────── */

/** Satu bukti yang bisa diunduh — bentuk yang dipakai tabel maupun unduhan massal. */
interface Bukti {
  entriId: string;
  path: string;
  name: string;
}

const buktiDari = (entri: EntriKpi[]): Bukti[] =>
  entri.flatMap((e) => e.lampiran.map((l) => ({ entriId: e.id, path: l.path, name: l.name })));

const tautanBukti = (b: Bukti, opsi = "") =>
  `/api/berkas/kpi/${encodeURIComponent(b.entriId)}?p=${encodeURIComponent(b.path)}${opsi}`;

/**
 * Unduh seluruh bukti bulan ini sebagai satu arsip, dengan bar persen.
 *
 * SATU ARSIP, BUKAN EMPAT PULUH UNDUHAN. Empat puluh berkas yang dikirim
 * beruntun memicu peringatan "unduh banyak berkas?" di peramban, lalu berserak
 * di folder Unduhan tercampur dengan yang lain — dan tidak ada yang tahu mana
 * yang gagal di tengah jalan.
 *
 * Barnya menghitung BERKAS yang sudah masuk, bukan byte. Ukuran tiap berkas
 * tidak diketahui sebelum diambil, dan bar yang melompat dari 0 ke 100 di
 * detik terakhir lebih membingungkan daripada tidak ada bar sama sekali.
 */
function UnduhMassal({ bukti, periode }: { bukti: Bukti[]; periode: string }) {
  const [sibuk, setSibuk] = React.useState(false);
  const [selesai, setSelesai] = React.useState(0);

  async function unduh() {
    if (bukti.length === 0) return;
    setSibuk(true);
    setSelesai(0);
    const isi: { name: string; data: Uint8Array<ArrayBuffer> }[] = [];
    const gagal: string[] = [];
    for (const b of bukti) {
      try {
        const res = await fetch(tautanBukti(b, "&isi=1"));
        if (!res.ok) throw new Error(String(res.status));
        isi.push({ name: b.name, data: new Uint8Array(await res.arrayBuffer()) });
      } catch {
        // Satu berkas yang gagal TIDAK membatalkan sisanya. Bukti yang lain
        // tetap berguna, dan yang gagal disebutkan namanya supaya bisa dicari
        // satu per satu.
        gagal.push(b.name);
      }
      setSelesai((n) => n + 1);
    }
    setSibuk(false);
    if (isi.length === 0) {
      toast.error("Tidak ada bukti yang berhasil diambil.");
      return;
    }
    const url = URL.createObjectURL(buatZip(isi));
    const a = document.createElement("a");
    a.href = url;
    a.download = `bukti-hygiene-${periode}.zip`;
    a.click();
    URL.revokeObjectURL(url);
    if (gagal.length > 0) toast.warning(`${gagal.length} bukti gagal diambil: ${gagal.slice(0, 3).join(", ")}${gagal.length > 3 ? "…" : ""}`);
    else toast.success(`${isi.length} bukti terunduh.`);
  }

  const nilai = bukti.length ? (selesai / bukti.length) * 100 : 0;

  return (
    <div className="flex min-w-0 items-center gap-2">
      <button
        type="button"
        onClick={unduh}
        disabled={sibuk || bukti.length === 0}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
      >
        {sibuk ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
        Unduh semua bukti{bukti.length > 0 && !sibuk ? ` (${bukti.length})` : ""}
      </button>
      {sibuk && (
        <div className="flex min-w-[9rem] flex-1 items-center gap-2">
          <Progress value={nilai} className="flex-1" />
          <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
            {Math.round(nilai)}% · {selesai}/{bukti.length}
          </span>
        </div>
      )}
    </div>
  );
}

export function TabelHygiene({
  entri,
  namaOutlet,
  periode,
  toolbar,
}: {
  entri: EntriKpi[];
  namaOutlet: Map<string, string>;
  periode: string;
  toolbar: React.ReactNode;
}) {
  const bukti = React.useMemo(() => buktiDari(entri), [entri]);
  const kolom = React.useMemo<ColumnDef<EntriKpi>[]>(
    () => [
      {
        accessorKey: "tanggal",
        header: "Tanggal",
        cell: ({ getValue }) => <span className="whitespace-nowrap text-foreground/80">{formatDate(getValue<string>())}</span>,
      },
      {
        id: "outlet",
        header: "Outlet",
        accessorFn: (e) => (e.outletId ? namaOutlet.get(e.outletId) ?? e.outletId : "—"),
        cell: ({ getValue }) => <span className="font-medium text-foreground">{getValue<string>()}</span>,
      },
      { accessorKey: "picNama", header: "PIC", cell: ({ getValue }) => <span className="text-foreground/80">{getValue<string>()}</span> },
      {
        id: "bukti",
        header: "Bukti Submit",
        enableSorting: false,
        accessorFn: (e) => e.lampiran.map((l) => l.name).join("; "),
        cell: ({ row }) =>
          row.original.lampiran.length === 0 ? (
            <Badge tone="danger">tanpa bukti</Badge>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {row.original.lampiran.map((l) => (
                <a
                  key={l.path}
                  href={tautanBukti({ entriId: row.original.id, path: l.path, name: l.name })}
                  target="_blank"
                  rel="noreferrer"
                  title={l.name}
                  className="inline-flex max-w-[12rem] items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <FileText className="size-3 shrink-0" />
                  <span className="truncate">{l.name}</span>
                </a>
              ))}
            </div>
          ),
      },
      {
        accessorKey: "deskripsi",
        header: "Keterangan",
        cell: ({ getValue }) => (
          <span className="block max-w-[20rem] truncate text-foreground/80">{getValue<string>() || "—"}</span>
        ),
      },
    ],
    [namaOutlet],
  );

  return (
    <DataTable
      tableId="kpi-hygiene"
      columns={kolom}
      data={entri}
      searchPlaceholder="Cari bukti…"
      stickyHeader={false}
      showExport={false}
      toolbar={
        <div className="flex flex-wrap items-center gap-2">
          {toolbar}
          <UnduhMassal bukti={bukti} periode={periode} />
        </div>
      }
    />
  );
}

/* ───────────────────────── net profit & harga pokok ───────────────────────── */

/**
 * Satu bentuk tabel untuk Net Profit dan Harga Pokok Penjualan.
 *
 * Kolomnya sama persis — outlet, gross sales, nominalnya, lalu bagiannya
 * terhadap gross sales. Menyalinnya jadi dua komponen hanya menyiapkan dua
 * tempat yang harus diubah serempak setiap kali kolomnya bergeser.
 */
function TabelAngkaOutlet({
  detail,
  tableId,
  judulNominal,
  judulPersen,
  toolbar,
  nilai,
}: {
  detail: DetailOutletCa[];
  tableId: string;
  judulNominal: string;
  judulPersen: string;
  toolbar: React.ReactNode;
  nilai: (o: DetailOutletCa) => number | null;
}) {
  const kolom = React.useMemo<ColumnDef<DetailOutletCa>[]>(
    () => [
      {
        accessorKey: "outletNama",
        header: "Outlet",
        cell: ({ row }) => (
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate font-medium text-foreground">{row.original.outletNama}</span>
            {/* Outlet yang belum genap tiga bulan tetap DITAMPILKAN — angkanya
                sudah masuk dan orang perlu melihatnya — tapi ditandai, karena
                ia tidak ikut menghitung skor. */}
            {!row.original.ikut && <Badge tone="neutral">belum 3 bulan</Badge>}
          </div>
        ),
      },
      { accessorKey: "gross", header: "Gross Sales", cell: ({ getValue }) => <Rp v={getValue<number | null>()} muted /> },
      { id: "nominal", header: judulNominal, accessorFn: nilai, cell: ({ getValue }) => <Rp v={getValue<number | null>()} /> },
      {
        id: "bagian",
        header: judulPersen,
        accessorFn: (o) => bagianDari(nilai(o), o.gross),
        cell: ({ getValue }) => {
          const v = getValue<number | null>();
          return <span className={v === null ? "text-[11px] text-muted-foreground" : "font-medium tabular-nums text-foreground"}>{persen(v)}</span>;
        },
      },
    ],
    [judulNominal, judulPersen, nilai],
  );

  return (
    <DataTable
      tableId={tableId}
      columns={kolom}
      data={detail}
      searchPlaceholder="Cari outlet…"
      stickyHeader={false}
      toolbar={toolbar}
    />
  );
}

export function TabelNetProfit({ detail, toolbar }: { detail: DetailOutletCa[]; toolbar: React.ReactNode }) {
  return (
    <TabelAngkaOutlet
      detail={detail}
      tableId="kpi-net-profit"
      judulNominal="Net Profit"
      judulPersen="% terhadap Gross Sales"
      toolbar={toolbar}
      nilai={(o) => o.netProfit}
    />
  );
}

export function TabelHpp({ detail, toolbar }: { detail: DetailOutletCa[]; toolbar: React.ReactNode }) {
  return (
    <TabelAngkaOutlet
      detail={detail}
      tableId="kpi-hpp"
      judulNominal="Harga Pokok Penjualan"
      judulPersen="% terhadap Gross Sales"
      toolbar={toolbar}
      nilai={(o) => o.hppNominal}
    />
  );
}
