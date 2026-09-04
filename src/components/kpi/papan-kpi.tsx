"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { type ColumnDef } from "@tanstack/react-table";
import { ClipboardList, ListChecks, Lock, ReceiptText, Store, Trash2, UtensilsCrossed } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Combobox } from "@/components/ui/combobox";
import { DataTable } from "@/components/ui/data-table";
import { Progress } from "@/components/ui/progress";
import { KpiIndicatorDonut, KpiPerformanceChart } from "./kpi-charts";
import { DialogInput, type OutletRingkas } from "./dialog-input";
import { DialogPengaturan } from "./dialog-pengaturan";
import { FormEfisiensi, FormFee, FormKegiatan, FormMenuPasar, type MenuEsb, type OpsiKegiatan } from "./form-tabel";
import { BULAN, labelPeriode, periodeDari, tahunPilihan } from "./periode";
import { hapusEntriAction, hapusMenuPasarAction } from "@/lib/actions/kpi";
import type { BarisKpi, BarisEfisiensi } from "@/lib/kpi/hitung";
import type { DetailFee, DetailPasar, EntriKpi, LaporanKpi } from "@/lib/data/kpi";
import type { Indikator } from "@/lib/kpi/indikator";
import { formatDate, formatIDR, formatNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";

/**
 * Halaman KPI satu posisi — SATU komponen untuk sepuluh posisi.
 *
 * Susunannya mengikuti Work Tracker baris demi baris: bilah saringan, grafik
 * kiri + donat kanan pada grid `minmax(0,1fr) 23rem`, lalu tabel dengan
 * pengurutan, pencarian, dan penomoran halaman yang sama.
 *
 * SATU TABEL DI LAYAR, DIPILIH LEWAT TOMBOL. Sebelumnya tiga tabel ditumpuk ke
 * bawah dalam satu halaman dan yang membacanya harus menggulir jauh untuk tahu
 * ada apa saja. Sekarang bentuknya sama dengan pengalih Table/Kanban di Work
 * Tracker: satu pilihan, satu tabel.
 *
 * PANEL TIDAK PERNAH TERCAMPUR. Efisiensi Beban Operasional dan Keberhasilan
 * Pasar hanya untuk posisi PDQ yang memang dinilai atasnya; Invoice Management
 * Fee hanya untuk Accounting. Server yang menentukan — panel yang tidak dipakai
 * datang sebagai `null` dan tidak punya jalan untuk tampil.
 */

const persen = (n: number | null, digit = 2) =>
  n === null ? "—" : `${formatNumber(n, { minimumFractionDigits: digit, maximumFractionDigits: digit })}%`;

const angka = (n: number | null) => (n === null ? "—" : formatNumber(n, { maximumFractionDigits: 2 }));

/**
 * Angka dengan satuannya.
 *
 * Rp 13.244.543.327 dan "40%" dibaca berbeda dari "13244543327" dan "40" —
 * dan indikator yang salah dibaca satuannya akan disangka meleset jauh padahal
 * tepat. Yang tanpa satuan tetap angka biasa.
 */
const bersatuan = (n: number | null, satuan?: "angka" | "rupiah" | "persen") => {
  if (n === null) return "—";
  if (satuan === "rupiah") return formatIDR(n);
  if (satuan === "persen") return persen(n, 0);
  return angka(n);
};

export interface OpsiPosisi {
  value: string;
  label: string;
}

type Tampilan = "indikator" | "efisiensi" | "fee" | "pasar" | "riwayat";

export function PapanKpi({
  laporan,
  lalu,
  indikator,
  namaPosisi,
  pic,
  picOpsi,
  perPic,
  posisiOpsi,
  outlets,
  tenggatHari,
  bolehAtur,
  menuEsb,
}: {
  laporan: LaporanKpi;
  lalu: Record<string, number | null>;
  indikator: Indikator[];
  namaPosisi: string;
  pic: string[];
  /** Pilihan PIC di bilah saringan — nilainya bisa berupa ID, bukan nama. */
  picOpsi: OpsiPosisi[];
  /** Posisi ini dinilai per orang; PIC-nya dipilih di bilah saringan. */
  perPic: boolean;
  posisiOpsi: OpsiPosisi[];
  outlets: OutletRingkas[];
  tenggatHari: number[];
  bolehAtur: boolean;
  /** Katalog menu ESB — hanya terisi untuk posisi yang menilai Keberhasilan Pasar. */
  menuEsb: MenuEsb[];
}) {
  const router = useRouter();
  const { baris, ringkas } = laporan;
  const subtitle = `${labelPeriode(laporan.periode)} · ${namaPosisi}`;
  const bobotTimpang = Math.abs(ringkas.bobotTotal - 100) > 0.001;

  const [tampilan, setTampilan] = React.useState<Tampilan>("indikator");

  // Pilihan tabel dibangun dari panel yang benar-benar ada. Menuliskannya
  // sebagai daftar tetap berarti suatu saat ada tombol menuju tabel kosong.
  const pilihanTabel = React.useMemo(() => {
    const out: { id: Tampilan; label: string; icon: LucideIcon }[] = [{ id: "indikator", label: "Indikator", icon: ListChecks }];
    if (laporan.efisiensi) out.push({ id: "efisiensi", label: "Efisiensi Beban", icon: Store });
    if (laporan.fee) out.push({ id: "fee", label: "Management Fee", icon: ReceiptText });
    if (laporan.pasar) out.push({ id: "pasar", label: "Keberhasilan Pasar", icon: UtensilsCrossed });
    out.push({ id: "riwayat", label: "Riwayat Input", icon: ClipboardList });
    return out;
  }, [laporan.efisiensi, laporan.fee, laporan.pasar]);

  // Indikator yang dihitung dari jumlah kegiatan — itulah yang bisa diisi
  // sekaligus lewat tabel. Yang lain (temuan, tenggat, angka) punya bentuk
  // isiannya sendiri di dialog Input.
  const opsiKegiatan = React.useMemo<OpsiKegiatan[]>(
    () =>
      indikator
        .filter((i) => i.actual.sumber === "entri")
        .map((i) => ({ jenis: (i.actual as { entri: OpsiKegiatan["jenis"] }).entri, label: i.label })),
    [indikator],
  );

  // Kolom Kategori hanya berguna bagi posisi yang indikatornya berkelompok.
  // Untuk yang tidak, isinya satu kolom penuh tanda pisah — bukan sekadar
  // mubazir, melainkan memakan lebar yang dibutuhkan kolom yang berisi.
  const adaKategori = baris.some((b) => b.kategori);

  const kolom = React.useMemo<ColumnDef<BarisKpi>[]>(
    () => [
      {
        accessorKey: "label",
        header: "Indikator",
        cell: ({ row }) => (
          <div className="min-w-0 max-w-[20rem]">
            <p className="truncate font-medium text-foreground">{row.original.label}</p>
            <p className="truncate text-[11px] text-muted-foreground">{row.original.alasan ?? row.original.penjelasan}</p>
          </div>
        ),
      },
      ...(adaKategori
        ? [
            {
              accessorKey: "kategori",
              header: "Kategori",
              cell: ({ getValue }) => {
                const v = getValue<string | undefined>();
                return v ? <Badge tone="brand">{v}</Badge> : <span className="text-muted-foreground">—</span>;
              },
            } satisfies ColumnDef<BarisKpi>,
          ]
        : []),
      {
        accessorKey: "bobot",
        header: "Bobot",
        cell: ({ getValue }) => <span className="tabular-nums text-muted-foreground">{persen(getValue<number>(), 0)}</span>,
      },
      {
        accessorKey: "target",
        header: "Target",
        cell: ({ row }) => <span className="tabular-nums text-foreground/80">{bersatuan(row.original.target, row.original.satuan)}</span>,
      },
      {
        accessorKey: "actual",
        header: "Actual",
        cell: ({ row }) => <span className="tabular-nums text-foreground/80">{bersatuan(row.original.actual, row.original.satuan)}</span>,
      },
      {
        accessorKey: "persentase",
        header: "Persentase",
        cell: ({ row }) => {
          const p = row.original.persentase;
          if (p === null) return <span className="text-[11px] text-muted-foreground">belum ada data</span>;
          return (
            <div className="flex w-28 items-center gap-2">
              <Progress value={Math.round(p)} tone={p >= 100 ? "success" : "brand"} />
              <span className="w-11 text-right text-[11px] tabular-nums text-muted-foreground">{persen(p, 0)}</span>
            </div>
          );
        },
      },
      {
        accessorKey: "persenActual",
        header: "% Actual",
        cell: ({ getValue }) => (
          <span className="font-semibold tabular-nums text-foreground">{persen(getValue<number | null>())}</span>
        ),
      },
    ],
    [adaKategori],
  );

  function pindah(url: string) {
    router.push(url);
  }

  function gantiPeriode(tahun: string, bulan: string) {
    pindah(`/kpi/${laporan.posisi}?periode=${periodeDari(tahun, bulan)}`);
  }

  const toolbar = (
    <PilihTabel pilihan={pilihanTabel} nilai={tampilan} onNilai={setTampilan} />
  );

  return (
    <div>
      {/* Bilah saringan — bentuknya sama dengan Work Tracker, tapi tahun dan
          bulan berdiri sendiri: "2026-09" memaksa orang menerjemahkan angka
          bulan sendiri. */}
      <div className="scroll-fade-x -mx-1 mb-4 flex items-center gap-2 px-1 py-0.5">
        <Combobox
          portal
          searchable={false}
          className="w-28 shrink-0"
          value={laporan.periode.slice(0, 4)}
          onChange={(v) => gantiPeriode(v, laporan.periode.slice(5, 7))}
          options={tahunPilihan()}
        />
        <Combobox
          portal
          searchable={false}
          className="w-36 shrink-0"
          value={laporan.periode.slice(5, 7)}
          onChange={(v) => gantiPeriode(laporan.periode.slice(0, 4), v)}
          options={BULAN}
        />
        <Combobox
          portal
          searchable={false}
          className="w-56 shrink-0"
          value={laporan.posisi}
          onChange={(v) => pindah(`/kpi/${v}?periode=${laporan.periode}`)}
          options={posisiOpsi}
        />
        {perPic && (
          <Combobox
            portal
            searchable={false}
            className="w-52 shrink-0"
            value={laporan.pic}
            onChange={(v) => pindah(`/kpi/${laporan.posisi}?periode=${laporan.periode}&pic=${encodeURIComponent(v)}`)}
            options={picOpsi}
          />
        )}
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {laporan.dikunci && (
            <Badge tone="neutral">
              <Lock className="size-3" /> Bulan dikunci
            </Badge>
          )}
          {!perPic && pic.length > 0 && (
            <span className="hidden text-[11.5px] text-muted-foreground lg:inline">{pic.join(" · ")}</span>
          )}
          {!laporan.dikunci && (
            <DialogInput
              posisi={laporan.posisi}
              periode={laporan.periode}
              picAktif={laporan.pic}
              indikator={indikator}
              outlets={outlets}
              pic={pic}
              tenggatHari={tenggatHari}
            />
          )}
          {bolehAtur && <DialogPengaturan posisi={laporan.posisi} indikator={indikator} baris={baris} />}
        </div>
      </div>

      {/* Grafik + donat — grid yang sama dengan Work Tracker. */}
      <div className="mb-4 grid items-stretch gap-4 lg:grid-cols-[minmax(0,1fr)_23rem]">
        <KpiPerformanceChart baris={baris} lalu={lalu} subtitle={subtitle} />
        <KpiIndicatorDonut baris={baris} subtitle={subtitle} />
      </div>

      {bobotTimpang && (
        <p className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/[0.07] px-3.5 py-2.5 text-[12.5px] leading-relaxed text-amber-800 dark:text-amber-200">
          Bobot indikator posisi ini berjumlah <b>{persen(ringkas.bobotTotal, 0)}</b>, bukan 100%. Skor tertingginya ikut
          terbatas di angka itu — perbaiki lewat Pengaturan agar setara dengan posisi lain.
        </p>
      )}

      {tampilan === "indikator" && (
        <DataTable
          tableId="kpi-indikator"
          columns={kolom}
          data={baris}
          searchPlaceholder="Cari indikator…"
          stickyHeader={false}
          toolbar={toolbar}
        />
      )}
      {tampilan === "efisiensi" && laporan.efisiensi && (
        <TabelEfisiensi
          data={laporan.efisiensi}
          toolbar={
            <div className="flex flex-wrap items-center gap-2">
              {toolbar}
              {!laporan.dikunci && (
                <FormEfisiensi posisi={laporan.posisi} periode={laporan.periode} pic={laporan.pic} baris={laporan.efisiensi.baris} />
              )}
            </div>
          }
        />
      )}
      {tampilan === "fee" && laporan.fee && (
        <TabelFee
          data={laporan.fee}
          toolbar={
            <div className="flex flex-wrap items-center gap-2">
              {toolbar}
              {!laporan.dikunci && <FormFee posisi={laporan.posisi} periode={laporan.periode} pic={laporan.pic} baris={laporan.fee} />}
            </div>
          }
        />
      )}
      {tampilan === "pasar" && laporan.pasar && (
        <TabelPasar
          data={laporan.pasar}
          posisi={laporan.posisi}
          periode={laporan.periode}
          pic={laporan.pic}
          toolbar={
            <div className="flex flex-wrap items-center gap-2">
              {toolbar}
              {!laporan.dikunci && (
                <FormMenuPasar
                  posisi={laporan.posisi}
                  periode={laporan.periode}
                  pic={laporan.pic}
                  katalog={menuEsb}
                  terpilih={laporan.pasar.baris}
                />
              )}
            </div>
          }
        />
      )}
      {tampilan === "riwayat" && (
        <TabelRiwayat
          entri={laporan.entri}
          posisi={laporan.posisi}
          periode={laporan.periode}
          pic={laporan.pic}
          toolbar={
            <div className="flex flex-wrap items-center gap-2">
              {toolbar}
              {!laporan.dikunci && (
                <FormKegiatan
                  posisi={laporan.posisi}
                  periode={laporan.periode}
                  pic={laporan.pic}
                  picOpsi={pic}
                  opsi={opsiKegiatan}
                />
              )}
            </div>
          }
        />
      )}

      <Ringkasan tampilan={tampilan} laporan={laporan} />
    </div>
  );
}

/* ─────────────────────────── pengalih tabel ─────────────────────────── */

/** Bentuknya persis pengalih Table/Kanban di Work Tracker. */
function PilihTabel({
  pilihan,
  nilai,
  onNilai,
}: {
  pilihan: { id: Tampilan; label: string; icon: LucideIcon }[];
  nilai: Tampilan;
  onNilai: (v: Tampilan) => void;
}) {
  return (
    <div className="inline-grid gap-1 rounded-xl border border-border bg-muted/50 p-1" style={{ gridTemplateColumns: `repeat(${pilihan.length}, minmax(0, 1fr))` }}>
      {pilihan.map((p) => {
        const on = p.id === nilai;
        const Icon = p.icon;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onNilai(p.id)}
            aria-pressed={on}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
              on ? "bg-background text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-3.5 shrink-0" />
            {p.label}
          </button>
        );
      })}
    </div>
  );
}

/** Keterangan di bawah tabel — menjelaskan angka tabel yang sedang tampil. */
function Ringkasan({ tampilan, laporan }: { tampilan: Tampilan; laporan: LaporanKpi }) {
  const { ringkas } = laporan;
  let teks: React.ReactNode = null;

  if (tampilan === "indikator") {
    teks = (
      <>
        Skor bulan ini <b className="text-foreground">{persen(ringkas.skor)}</b> dari bobot {persen(ringkas.bobotTotal, 0)}
        {ringkas.jumlahBelumTerukur > 0 && ` · ${ringkas.jumlahBelumTerukur} indikator belum terukur`}. Persentase = actual ÷
        target, dibatasi 100%; % actual = bobot × persentase.
      </>
    );
  } else if (tampilan === "efisiensi" && laporan.efisiensi) {
    const r = laporan.efisiensi.ringkas;
    teks = (
      <>
        Budget seluruh outlet {formatIDR(r.totalBudget)} · realisasi {formatIDR(r.totalActual)} ·{" "}
        {r.persenActual === null ? (
          "belum ada realisasi yang diisi"
        ) : (
          <>
            {persen(r.persenActual)} dari penjualan —{" "}
            <b className={r.selisih! <= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
              {r.selisih! <= 0 ? "tersisa" : "melebihi"} {persen(Math.abs(r.selisih!))}
            </b>
          </>
        )}{" "}
        · {r.outletTerhitung} outlet terhitung, {r.outletTanpaData} belum diisi.
      </>
    );
  } else if (tampilan === "fee" && laporan.fee) {
    const sesuai = laporan.fee.filter((f) => f.sesuai).length;
    teks = (
      <>
        {sesuai} dari {laporan.fee.length} outlet sudah diceklis sesuai. Management fee seharusnya 5% dari net sales bulan
        ini — ceklisnya dimulai dari nol setiap ganti bulan.
      </>
    );
  } else if (tampilan === "pasar" && laporan.pasar) {
    const p = laporan.pasar;
    teks =
      p.baris.length === 0 ? (
        <>Belum ada menu yang dipilih. Tambah lewat tombol Input — pilih indikator Keberhasilan Pasar.</>
      ) : (
        <>
          {p.baris.length} menu · penjualan {formatIDR(p.total)} dari omset {formatIDR(p.omset)} ={" "}
          <b className="text-foreground">{persen(p.bagianTotal)}</b>
        </>
      );
  } else if (tampilan === "riwayat") {
    teks = (
      <>
        {laporan.entri.length} baris tercatat bulan ini. Setiap baris di sini yang menjadi angka Actual pada indikator yang
        memakainya — menghapusnya ikut menurunkan capaian.
      </>
    );
  }

  if (!teks) return null;
  return <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">{teks}</p>;
}

/* ─────────────────────────────── tabel-tabel ─────────────────────────────── */

function Rp({ v, muted, kosong }: { v: number | null; muted?: boolean; kosong?: string }) {
  if (v === null) return <span className="text-[11px] text-muted-foreground">{kosong ?? "—"}</span>;
  return <span className={muted ? "tabular-nums text-muted-foreground" : "tabular-nums text-foreground/80"}>{formatIDR(v)}</span>;
}

function TabelEfisiensi({ data, toolbar }: { data: NonNullable<LaporanKpi["efisiensi"]>; toolbar: React.ReactNode }) {
  const kolom = React.useMemo<ColumnDef<BarisEfisiensi>[]>(
    () => [
      { accessorKey: "outletNama", header: "Outlet", cell: ({ getValue }) => <span className="font-medium text-foreground">{getValue<string>()}</span> },
      { accessorKey: "average", header: "Average 3 Bln", cell: ({ getValue }) => <Rp v={getValue<number | null>()} /> },
      { accessorKey: "targetWh", header: "Target WH", cell: ({ getValue }) => <Rp v={getValue<number | null>()} muted /> },
      { accessorKey: "targetNonWh", header: "Target Non-WH", cell: ({ getValue }) => <Rp v={getValue<number | null>()} muted /> },
      { accessorKey: "actualWh", header: "Actual WH", cell: ({ getValue }) => <Rp v={getValue<number | null>()} kosong="belum diisi" /> },
      { accessorKey: "actualNonWh", header: "Actual Non-WH", cell: ({ getValue }) => <Rp v={getValue<number | null>()} kosong="belum diisi" /> },
      {
        accessorKey: "persenActual",
        header: "% Actual",
        cell: ({ getValue }) => <span className="tabular-nums text-foreground/80">{persen(getValue<number | null>())}</span>,
      },
      {
        accessorKey: "selisih",
        header: "Status",
        cell: ({ getValue }) => {
          const s = getValue<number | null>();
          if (s === null) return <span className="text-[11px] text-muted-foreground">No Data</span>;
          return (
            <Badge tone={s <= 0 ? "success" : "danger"} dot>
              {s <= 0 ? "Tersisa" : "Melebihi"} {persen(Math.abs(s))}
            </Badge>
          );
        },
      },
    ],
    [],
  );
  return <DataTable tableId="kpi-efisiensi" columns={kolom} data={data.baris} searchPlaceholder="Cari outlet…" stickyHeader={false} toolbar={toolbar} />;
}

function TabelFee({ data, toolbar }: { data: DetailFee[]; toolbar: React.ReactNode }) {
  const kolom = React.useMemo<ColumnDef<DetailFee>[]>(
    () => [
      { accessorKey: "outletNama", header: "Outlet", cell: ({ getValue }) => <span className="font-medium text-foreground">{getValue<string>()}</span> },
      { accessorKey: "netSales", header: "Net Sales", cell: ({ getValue }) => <Rp v={getValue<number | null>()} /> },
      { accessorKey: "feeSeharusnya", header: "Fee Seharusnya (5%)", cell: ({ getValue }) => <Rp v={getValue<number | null>()} /> },
      {
        accessorKey: "sesuai",
        header: "Sesuai",
        cell: ({ getValue }) => (
          <Badge tone={getValue<boolean>() ? "success" : "neutral"} dot>
            {getValue<boolean>() ? "Sesuai" : "Belum"}
          </Badge>
        ),
      },
    ],
    [],
  );
  return <DataTable tableId="kpi-fee" columns={kolom} data={data} searchPlaceholder="Cari outlet…" stickyHeader={false} toolbar={toolbar} />;
}

function TabelPasar({
  data,
  posisi,
  periode,
  pic,
  toolbar,
}: {
  data: DetailPasar;
  posisi: string;
  periode: string;
  pic: string;
  toolbar: React.ReactNode;
}) {
  const router = useRouter();
  const kolom = React.useMemo<ColumnDef<DetailPasar["baris"][number]>[]>(
    () => [
      { accessorKey: "menu", header: "Nama Menu", cell: ({ getValue }) => <span className="font-medium text-foreground">{getValue<string>()}</span> },
      { accessorKey: "penjualan", header: "Penjualan 3 Bulan", cell: ({ getValue }) => <Rp v={getValue<number>()} /> },
      {
        accessorKey: "bagian",
        header: "Bagian dari Omset",
        cell: ({ getValue }) => <span className="tabular-nums text-foreground/80">{persen(getValue<number>())}</span>,
      },
      {
        id: "aksi",
        header: "Aksi",
        enableSorting: false,
        cell: ({ row }) => (
          <TombolHapus
            onHapus={async () => {
              const res = await hapusMenuPasarAction({ posisi, periode, pic, menu: row.original.menu });
              if (res.error) {
                toast.error(res.error);
                return;
              }
              toast.success("Menu dihapus");
              router.refresh();
            }}
          />
        ),
      },
    ],
    [posisi, periode, pic, router],
  );
  return <DataTable tableId="kpi-pasar" columns={kolom} data={data.baris} searchPlaceholder="Cari menu…" stickyHeader={false} showExport={false} toolbar={toolbar} />;
}

const LABEL_ENTRI: Record<string, string> = {
  quality_control: "Quality Control",
  riset_menu: "Riset Menu Baru",
  event: "Event / Program",
  faktur: "Faktur Pajak",
  penyampaian: "Penyampaian Data",
  temuan: "Temuan Head",
  pelunasan: "Pelunasan",
};

function TabelRiwayat({
  entri,
  posisi,
  periode,
  pic,
  toolbar,
}: {
  entri: EntriKpi[];
  posisi: string;
  periode: string;
  pic: string;
  toolbar: React.ReactNode;
}) {
  const router = useRouter();
  const kolom = React.useMemo<ColumnDef<EntriKpi>[]>(
    () => [
      {
        accessorKey: "tanggal",
        header: "Tanggal",
        cell: ({ getValue }) => <span className="whitespace-nowrap text-foreground/80">{formatDate(getValue<string>())}</span>,
      },
      {
        accessorKey: "jenis",
        header: "Jenis",
        cell: ({ getValue }) => <Badge tone="brand">{LABEL_ENTRI[getValue<string>()] ?? getValue<string>()}</Badge>,
      },
      {
        accessorKey: "judul",
        header: "Keterangan",
        cell: ({ row }) => (
          <div className="min-w-0 max-w-[22rem]">
            <p className="truncate font-medium text-foreground">{row.original.judul || "—"}</p>
            {row.original.deskripsi && <p className="truncate text-[11px] text-muted-foreground">{row.original.deskripsi}</p>}
          </div>
        ),
      },
      { accessorKey: "picNama", header: "PIC", cell: ({ getValue }) => <span className="text-foreground/80">{getValue<string>()}</span> },
      {
        accessorKey: "gagal",
        header: "Status",
        cell: ({ getValue }) =>
          getValue<boolean>() ? <Badge tone="danger" dot>Mengurangi poin</Badge> : <Badge tone="success" dot>Menambah poin</Badge>,
      },
      {
        id: "aksi",
        header: "Aksi",
        enableSorting: false,
        cell: ({ row }) => (
          <TombolHapus
            onHapus={async () => {
              const res = await hapusEntriAction({ posisi, periode, pic, id: row.original.id });
              if (res.error) {
                toast.error(res.error);
                return;
              }
              toast.success("Baris dihapus");
              router.refresh();
            }}
          />
        ),
      },
    ],
    [posisi, periode, pic, router],
  );

  return (
    <DataTable
      tableId="kpi-riwayat"
      columns={kolom}
      data={entri}
      searchPlaceholder="Cari catatan…"
      stickyHeader={false}
      toolbar={toolbar}
    />
  );
}

function TombolHapus({ onHapus }: { onHapus: () => Promise<void> }) {
  const [sibuk, setSibuk] = React.useState(false);
  return (
    <button
      type="button"
      disabled={sibuk}
      onClick={async () => {
        setSibuk(true);
        await onHapus();
        setSibuk(false);
      }}
      className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-red-600 disabled:opacity-50 dark:hover:text-red-400"
    >
      <Trash2 className="size-3.5" /> Hapus
    </button>
  );
}
