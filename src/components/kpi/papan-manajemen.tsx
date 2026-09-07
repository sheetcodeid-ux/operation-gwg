"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { type ColumnDef } from "@tanstack/react-table";
import { Building2, FileDown, Hash, ListChecks, Percent, Store, TrendingUp, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { DataTable } from "@/components/ui/data-table";
import { Progress } from "@/components/ui/progress";
import { KpiIndicatorDonut, KpiPerformanceChart, type LaluIndikator } from "./kpi-charts";
import { DialogLaporanKpi } from "./laporan-pdf";
import { PilihTabel, statusCapaian } from "./papan-kpi";
import { DialogPanduanManajemen } from "./panduan";
import { BULAN, periodeDari, tahunPilihan } from "./periode";
import { BOBOT, PERTUMBUHAN, TARGET_MARGIN, UMUR_SAME_STORE, type DepartemenKpi } from "@/lib/kpi/manajemen";
import { ringkasKpi, type BarisKpi } from "@/lib/kpi/hitung";
import type { BarisEbitda, DetailManajemen } from "@/lib/data/kpi-manajemen";
import type { LaporanKpi } from "@/lib/data/kpi";
import { cn, formatIDR, formatNumber } from "@/lib/utils";

/**
 * Kalkulator KPI Manajemen.
 *
 * BENTUKNYA SAMA PERSIS dengan halaman KPI posisi: bilah saringan, grafik kiri
 * + donat kanan pada grid yang sama, pengalih tabel, lalu tabel dengan kolom
 * yang sama urutannya. Modul yang tampil beda sendiri memaksa orang belajar
 * dua kali untuk membaca hal yang sama — dan yang dibaca di sini justru angka
 * yang paling sering dibandingkan dengan halaman sebelahnya.
 *
 * Yang membedakan hanya ISINYA: empat komponen berbobot milik perusahaan,
 * bukan sederet indikator milik satu orang. Seluruh angkanya otomatis; tidak
 * ada satu pun yang diketik, jadi tidak ada bulan yang kosong hanya karena
 * tidak ada yang ingat mengisinya.
 */

const persen = (n: number | null, digit = 2) =>
  n === null ? "—" : `${formatNumber(n, { minimumFractionDigits: digit, maximumFractionDigits: digit })}%`;

const angka = (n: number | null) => (n === null ? "—" : formatNumber(n, { maximumFractionDigits: 2 }));

const bersatuan = (n: number | null, satuan?: "angka" | "rupiah" | "persen") => {
  if (n === null) return "—";
  if (satuan === "rupiah") return formatIDR(n);
  if (satuan === "persen") return persen(n, 0);
  return angka(n);
};

type Tampilan = "komponen" | "gross" | "outlet" | "ebitda" | "divisi";
type Satuan = "persen" | "angka";

/** Pengalih persen/angka — bentuknya sama dengan yang ada di kartu grafik. */
function PilihSatuan({ nilai, onNilai }: { nilai: Satuan; onNilai: (v: Satuan) => void }) {
  const opsi: { id: Satuan; label: string; icon: LucideIcon }[] = [
    { id: "persen", label: "Persen", icon: Percent },
    { id: "angka", label: "Angka", icon: Hash },
  ];
  return (
    <div className="inline-flex shrink-0 gap-1 rounded-lg border border-border bg-muted/50 p-1">
      {opsi.map((m) => {
        const on = nilai === m.id;
        const Icon = m.icon;
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => onNilai(m.id)}
            aria-pressed={on}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
              on ? "bg-background text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-3.5 shrink-0" />
            {m.label}
          </button>
        );
      })}
    </div>
  );
}

export function PapanManajemen({ detail }: { detail: DetailManajemen }) {
  const router = useRouter();
  const { skor } = detail;
  const [tampilan, setTampilan] = React.useState<Tampilan>("komponen");
  const [satuan, setSatuan] = React.useState<Satuan>("persen");
  const [pdf, setPdf] = React.useState(false);

  const [tahun, bulan] = detail.periode.split("-");
  const pindah = (p: string) => router.push(`/kpi/manajemen?periode=${p}`);

  /**
   * Keempat komponen dibentuk jadi baris KPI biasa.
   *
   * Bukan demi menghemat kode, melainkan supaya grafik, donat, dan tabelnya
   * memakai komponen yang sama persis dengan halaman KPI posisi — termasuk
   * kolom Status dan cara satuannya ditulis.
   */
  const baris = React.useMemo<BarisKpi[]>(() => {
    const buat = (
      key: string,
      label: string,
      bobot: number,
      target: number | null,
      actual: number | null,
      capaian: number,
      skorKomponen: number,
      satuanBaris: BarisKpi["satuan"],
      penjelasan: string,
      nominal?: { actual: number; target: number },
    ): BarisKpi => ({
      key,
      label,
      bobot,
      target,
      actual,
      persentase: Math.max(0, Math.min(100, capaian * 100)),
      persenActual: skorKomponen,
      penjelasan,
      satuan: satuanBaris,
      actualNominal: nominal?.actual,
      targetNominal: nominal?.target,
    });
    return [
      buat("a", "Gross Sales Corporate", BOBOT.a, skor.a.target, skor.a.actual, skor.a.capaian, skor.a.skor, "rupiah",
        `Target = rata-rata omzet tiga bulan sebelumnya + ${PERTUMBUHAN}%. Seluruh outlet ikut, termasuk yang baru buka.`),
      buat("b", "Same Store Sales", BOBOT.b, skor.b.target, skor.b.actual, skor.b.capaian, skor.b.skor, "rupiah",
        `Hanya outlet berumur di atas ${UMUR_SAME_STORE} bulan. Target tiap outlet = rata-rata tiga bulan sebelumnya + ${PERTUMBUHAN}%.`),
      // EBITDA aslinya rasio. Nominalnya dibawa terpisah supaya mode Angka
      // menampilkan rupiah laba bersih, bukan "30%" di bawah tombol Angka.
      buat("c", "EBITDA Same Store", BOBOT.c, TARGET_MARGIN, skor.c.margin, skor.c.capaian, skor.c.skor, "persen",
        `Margin laba bersih terhadap sales same store, target ${TARGET_MARGIN}%. Berjenjang, bukan lulus-atau-tidak.`,
        { actual: skor.c.labaBersih, target: (skor.c.sales * TARGET_MARGIN) / 100 }),
      buat("d", "KPI All Division", BOBOT.d, 100, skor.d.rata, skor.d.rata / 100, skor.d.skor, "angka",
        "Rata-rata nilai tiap departemen; tiap departemen bersuara sekali, berapa pun jumlah posisinya."),
    ];
  }, [skor]);

  const pilihanTabel = React.useMemo<{ id: Tampilan; label: string; icon: LucideIcon }[]>(
    () => [
      { id: "komponen", label: "Komponen", icon: ListChecks },
      { id: "gross", label: "Detail Gross Sales Corporate", icon: TrendingUp },
      { id: "outlet", label: "Detail Same Store", icon: Store },
      { id: "ebitda", label: "Detail EBITDA Same Store", icon: Wallet },
      { id: "divisi", label: "Detail KPI Divisi", icon: Building2 },
    ],
    [],
  );

  const toolbar = (
    <div className="flex min-w-0 items-center gap-2">
      <PilihTabel pilihan={pilihanTabel} nilai={tampilan} onNilai={setTampilan} />
      {tampilan === "komponen" && <PilihSatuan nilai={satuan} onNilai={setSatuan} />}
    </div>
  );

  /**
   * Isi grafik mengikuti tab yang dibuka.
   *
   * Yang dicari orang saat membuka Detail Gross Sales bukan lagi empat batang
   * komponen melainkan outlet mana yang paling jauh dari targetnya. Donatnya
   * SENGAJA tidak ikut berganti: ia menjawab pertanyaan lain — dari mana skor
   * perusahaan ini datang — dan pertanyaan itu tidak berubah karena tabel di
   * bawahnya berganti.
   */
  const grafik = React.useMemo<{ judul: string; baris: BarisKpi[]; lalu: Record<string, LaluIndikator> }>(() => {
    /**
     * Urutan grafik SAMA dengan urutan tabel di bawahnya.
     *
     * Dua urutan berbeda pada satu layar membuat orang mengira grafiknya
     * memuat outlet yang lain — baris pertama tabel dicari di ujung kiri
     * grafik dan tidak ada di sana.
     */
    const dariOutlet = (
      sumber: { id: string; kode: string; nama: string; target: number; actual: number }[],
      judul: string,
      urut: "omzet" | "capaian",
    ) => ({
      judul,
      baris: sumber
        .filter((o) => o.target > 0 || o.actual > 0)
        .map((o) => ({
          key: o.id,
          label: o.kode,
          bobot: 0,
          target: o.target,
          actual: o.actual,
          persentase: o.target > 0 ? Math.max(0, Math.min(100, (o.actual / o.target) * 100)) : null,
          persenActual: null,
          penjelasan: o.nama,
          satuan: "rupiah" as const,
        }))
        .sort((a, b) =>
          urut === "omzet" ? (b.actual ?? 0) - (a.actual ?? 0) : (b.persentase ?? -1) - (a.persentase ?? -1),
        ),
      lalu: {},
    });

    if (tampilan === "gross") return dariOutlet(skor.b.baris, "Omzet per Outlet", "omzet");
    if (tampilan === "outlet") return dariOutlet(skor.b.baris.filter((o) => o.ikut), "Capaian per Outlet Same Store", "capaian");
    if (tampilan === "ebitda") {
      return {
        judul: "Margin per Outlet",
        baris: detail.ebitda
          .filter((e) => e.margin !== null)
          .map((e) => ({
            key: e.outletId,
            label: e.kode,
            bobot: 0,
            target: TARGET_MARGIN,
            actual: e.margin,
            persentase: Math.max(0, Math.min(100, ((e.margin ?? 0) / TARGET_MARGIN) * 100)),
            persenActual: null,
            penjelasan: e.nama,
            satuan: "persen" as const,
            actualNominal: e.labaBersih ?? undefined,
            targetNominal: (e.sales * TARGET_MARGIN) / 100,
          }))
          .sort((a, b) => (b.persentase ?? -1) - (a.persentase ?? -1)),
        lalu: {},
      };
    }
    if (tampilan === "divisi") {
      return {
        judul: "Capaian per Departemen",
        // Departemen tanpa nilai DIKELUARKAN dari grafik, bukan digambar nol —
        // garis yang jatuh ke dasar terbaca sebagai "gagal total", padahal
        // modulnya memang belum ada. Tabelnya tetap mendaftarnya.
        baris: skor.d.departemen.filter((d) => d.rata !== null).map((d) => ({
          key: d.kode,
          label: d.singkat,
          bobot: 0,
          target: 100,
          actual: d.rata,
          persentase: d.rata,
          persenActual: null,
          penjelasan: `${d.posisi.length} posisi`,
          satuan: "angka" as const,
        })),
        lalu: Object.fromEntries(skor.d.departemen.map((d) => [d.kode, { persen: d.lalu, actual: d.lalu }])),
      };
    }
    return { judul: "Capaian per Indikator", baris, lalu: detail.lalu };
  }, [tampilan, skor, detail.ebitda, detail.lalu, baris]);

  const kolomKomponen = React.useMemo<ColumnDef<BarisKpi>[]>(
    () => {
      // Mode Angka memakai nominal bila indikatornya punya — EBITDA menampilkan
      // rupiah laba bersih, bukan persentase yang sama dengan mode sebelahnya.
      const nilai = (b: BarisKpi, sisi: "target" | "actual"): { n: number | null; s: BarisKpi["satuan"] } => {
        const nominal = sisi === "target" ? b.targetNominal : b.actualNominal;
        if (satuan === "angka" && nominal !== undefined && nominal !== null) return { n: nominal, s: "rupiah" };
        return { n: sisi === "target" ? b.target : b.actual, s: b.satuan };
      };
      return [
        {
          accessorKey: "label",
          header: "Komponen",
          cell: ({ row }) => (
            <div className="min-w-0 max-w-[22rem]">
              <p className="truncate font-medium text-foreground">{row.original.label}</p>
              <p className="truncate text-[11px] text-muted-foreground">{row.original.penjelasan}</p>
            </div>
          ),
        },
        {
          accessorKey: "bobot",
          header: "Bobot",
          cell: ({ getValue }) => <span className="tabular-nums text-muted-foreground">{persen(getValue<number>(), 0)}</span>,
        },
        {
          accessorKey: "target",
          header: "Target",
          cell: ({ row }) => {
            const v = nilai(row.original, "target");
            return <span className="tabular-nums text-foreground/80">{bersatuan(v.n, v.s)}</span>;
          },
        },
        {
          accessorKey: "actual",
          header: "Actual",
          cell: ({ row }) => {
            const v = nilai(row.original, "actual");
            return <span className="tabular-nums text-foreground/80">{bersatuan(v.n, v.s)}</span>;
          },
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
          header: "Skor",
          cell: ({ row }) => (
            <span className="font-semibold tabular-nums text-foreground">
              {angka(row.original.persenActual)}
              <span className="ml-0.5 text-[11px] font-medium text-muted-foreground">/ {row.original.bobot}</span>
            </span>
          ),
        },
        {
          id: "status",
          header: "Status",
          accessorFn: (b) => statusCapaian(b.persentase).label,
          cell: ({ row }) => {
            const st = statusCapaian(row.original.persentase);
            return <Badge tone={st.tone}>{st.label}</Badge>;
          },
        },
      ];
    },
    [satuan],
  );

  const kolomOutlet = React.useMemo<ColumnDef<(typeof skor.b.baris)[number]>[]>(
    () => [
      kolomNo(),
      { accessorKey: "kode", header: "Kode", cell: ({ getValue }) => <span className="font-mono text-[11.5px] text-muted-foreground">{getValue<string>()}</span> },
      {
        accessorKey: "nama",
        header: "Outlet",
        cell: ({ getValue }) => <span className="truncate font-medium text-foreground">{getValue<string>()}</span>,
      },
      {
        id: "target",
        header: `Target (avg 3 bln +${PERTUMBUHAN}%)`,
        accessorFn: (o) => o.target,
        cell: ({ getValue }) => <span className="tabular-nums text-muted-foreground">{formatIDR(getValue<number>())}</span>,
      },
      {
        accessorKey: "actual",
        header: "Actual",
        cell: ({ getValue }) => <span className="tabular-nums text-foreground/80">{formatIDR(getValue<number>())}</span>,
      },
      barisPersen("capaian", "% thd Target", (o) => (o.target > 0 ? (o.actual / o.target) * 100 : null)),
      {
        id: "status",
        header: "Status",
        accessorFn: (o) => (o.ikut ? "Dihitung" : "Dikecualikan"),
        cell: ({ row }) =>
          row.original.ikut ? <Badge tone="success">Dihitung</Badge> : <Badge tone="neutral">Dikecualikan</Badge>,
      },
    ],
    [],
  );

  const kolomGross = React.useMemo<ColumnDef<(typeof skor.b.baris)[number]>[]>(() => {
    const total = skor.a.actual;
    return [
      kolomNo(),
      { accessorKey: "kode", header: "Kode", cell: ({ getValue }) => <span className="font-mono text-[11.5px] text-muted-foreground">{getValue<string>()}</span> },
      {
        accessorKey: "nama",
        header: "Outlet",
        cell: ({ getValue }) => <span className="truncate font-medium text-foreground">{getValue<string>()}</span>,
      },
      {
        accessorKey: "actual",
        header: "Omzet Bulan Ini",
        cell: ({ getValue }) => <span className="tabular-nums text-foreground/80">{formatIDR(getValue<number>())}</span>,
      },
      barisPersen("kontribusi", "% thd Korporat", (o) => (total > 0 ? (o.actual / total) * 100 : null), 100),
    ];
  }, [skor.a.actual]);

  const kolomEbitda = React.useMemo<ColumnDef<BarisEbitda>[]>(
    () => [
      kolomNo(),
      { accessorKey: "kode", header: "Kode", cell: ({ getValue }) => <span className="font-mono text-[11.5px] text-muted-foreground">{getValue<string>()}</span> },
      {
        accessorKey: "nama",
        header: "Outlet",
        cell: ({ getValue }) => <span className="truncate font-medium text-foreground">{getValue<string>()}</span>,
      },
      {
        accessorKey: "sales",
        header: "Sales",
        cell: ({ getValue }) => <span className="tabular-nums text-muted-foreground">{formatIDR(getValue<number>())}</span>,
      },
      {
        accessorKey: "labaBersih",
        header: "Laba Bersih",
        cell: ({ getValue }) => {
          const v = getValue<number | null>();
          return <span className="tabular-nums text-foreground/80">{v === null ? "—" : formatIDR(v)}</span>;
        },
      },
      barisPersen("margin", `Margin (target ${TARGET_MARGIN}%)`, (e) => e.margin, TARGET_MARGIN),
      {
        id: "status",
        header: "Status",
        accessorFn: (e) => (e.margin === null ? "Belum diisi" : e.margin >= TARGET_MARGIN ? "Tercapai" : "Belum tercapai"),
        cell: ({ row }) => {
          const m = row.original.margin;
          if (m === null) return <Badge tone="neutral">Belum diisi</Badge>;
          return m >= TARGET_MARGIN ? <Badge tone="success">Tercapai</Badge> : <Badge tone="warning">Belum tercapai</Badge>;
        },
      },
    ],
    [],
  );

  const kolomDivisi = React.useMemo<ColumnDef<DepartemenKpi>[]>(
    () => [
      {
        accessorKey: "nama",
        header: "Departemen",
        cell: ({ row }) => (
          <div className="min-w-0 max-w-[22rem]">
            <p className="truncate font-medium text-foreground">{row.original.nama}</p>
            <p className="truncate text-[11px] text-muted-foreground">
              {row.original.posisi.length === 0
                ? "belum ada posisi ber-modul"
                : row.original.posisi.map((p) => `${p.nama} ${p.nilai === null ? "—" : angka(p.nilai)}`).join(" · ")}
            </p>
          </div>
        ),
      },
      {
        id: "posisi",
        header: "Posisi",
        accessorFn: (d) => d.posisi.length,
        cell: ({ getValue }) => <span className="tabular-nums text-muted-foreground">{getValue<number>()}</span>,
      },
      {
        id: "lalu",
        header: "Bulan Lalu",
        accessorFn: (d) => d.lalu,
        cell: ({ getValue }) => <span className="tabular-nums text-muted-foreground">{angka(getValue<number | null>())}</span>,
      },
      {
        id: "ini",
        header: "Bulan Ini",
        accessorFn: (d) => d.rata,
        cell: ({ getValue }) => {
          const v = getValue<number | null>();
          if (v === null) return <span className="text-[11px] text-muted-foreground">belum ada data</span>;
          return (
            <div className="flex w-40 items-center gap-2">
              <Progress value={Math.min(100, v)} tone={v >= 85 ? "success" : v >= 70 ? "warning" : "danger"} />
              <span className="w-12 text-right text-[11px] tabular-nums text-muted-foreground">{angka(v)}</span>
            </div>
          );
        },
      },
      {
        id: "selisih",
        header: "Perbandingan",
        accessorFn: (d) => (d.rata === null || d.lalu === null ? null : d.rata - d.lalu),
        cell: ({ getValue }) => {
          const v = getValue<number | null>();
          if (v === null) return <span className="text-[11px] text-muted-foreground">—</span>;
          const naik = v > 0.005;
          const turun = v < -0.005;
          return (
            <Badge tone={naik ? "success" : turun ? "danger" : "neutral"}>
              {naik ? "▲" : turun ? "▼" : "—"} {angka(Math.abs(v))}
            </Badge>
          );
        },
      },
    ],
    [],
  );

  /**
   * Laporan tiruan untuk dialog PDF.
   *
   * Dialognya milik halaman KPI posisi dan menerima bentuk `LaporanKpi`.
   * Membuat versi keduanya khusus untuk halaman ini berarti dua tata letak
   * cetak yang harus dirawat bersamaan — dan yang kedua selalu yang tertinggal
   * saat yang pertama dirapikan.
   */
  const laporan = React.useMemo<LaporanKpi>(
    () => ({
      posisi: "operational_ca",
      periode: detail.periode,
      pic: "",
      baris,
      ringkas: ringkasKpi(baris),
      dikunci: false,
      efisiensi: null,
      pasar: null,
      fee: null,
      entri: [],
      ca: null,
    }),
    [baris, detail.periode],
  );

  return (
    <div>
      {/* Bilah saringan — bentuknya sama dengan halaman KPI posisi. */}
      <div className="scroll-fade-x -mx-1 mb-4 flex items-center gap-2 px-1 py-0.5">
        <Combobox portal searchable={false} className="w-28 shrink-0" value={tahun} onChange={(v) => pindah(periodeDari(v, bulan))} options={tahunPilihan()} />
        <Combobox portal searchable={false} className="w-40 shrink-0" value={bulan} onChange={(v) => pindah(periodeDari(tahun, v))} options={BULAN} />
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Badge tone={skor.peringkat.tone}>{skor.peringkat.label}</Badge>
          <DialogPanduanManajemen />
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setPdf(true)}>
            <FileDown className="size-4" /> Unduh PDF
          </Button>
        </div>
      </div>

      {/* Grafik + donat — grid yang sama dengan halaman KPI posisi. */}
      <div className="mb-4 grid items-stretch gap-4 lg:grid-cols-[minmax(0,1fr)_23rem]">
        <KpiPerformanceChart judul={grafik.judul} baris={grafik.baris} lalu={grafik.lalu} />
        <KpiIndicatorDonut baris={baris} />
      </div>

      {tampilan === "komponen" && (
        <DataTable tableId="kpi-manajemen" columns={kolomKomponen} data={baris} searchPlaceholder="Cari komponen…" stickyHeader={false} showExport={false} toolbar={toolbar} />
      )}
      {tampilan === "gross" && (
        <DataTable tableId="kpi-manajemen-gross" columns={kolomGross} data={urutTurun(skor.b.baris)} searchPlaceholder="Cari outlet…" stickyHeader={false} toolbar={toolbar} />
      )}
      {tampilan === "outlet" && (
        <DataTable tableId="kpi-manajemen-outlet" columns={kolomOutlet} data={urutCapaian(skor.b.baris)} searchPlaceholder="Cari outlet…" stickyHeader={false} toolbar={toolbar} />
      )}
      {tampilan === "ebitda" && (
        <DataTable tableId="kpi-manajemen-ebitda" columns={kolomEbitda} data={urutMargin(detail.ebitda)} searchPlaceholder="Cari outlet…" stickyHeader={false} toolbar={toolbar} />
      )}
      {tampilan === "divisi" && (
        <DataTable tableId="kpi-manajemen-divisi" columns={kolomDivisi} data={skor.d.departemen} searchPlaceholder="Cari departemen…" stickyHeader={false} toolbar={toolbar} />
      )}

      <Ringkasan tampilan={tampilan} detail={detail} />

      <DialogLaporanKpi
        open={pdf}
        onOpenChange={setPdf}
        laporan={laporan}
        lalu={detail.lalu}
        namaPosisi="KPI Manajemen"
        namaDepartemen="Korporat"
        namaPic=""
      />
    </div>
  );
}

/** Nomor baris yang mengikuti urutan tampil, bukan urutan data. */
function kolomNo<T>(): ColumnDef<T> {
  return {
    id: "no",
    header: "#",
    enableSorting: false,
    cell: ({ row, table }) => (
      <span className="tabular-nums text-muted-foreground">
        {table.getSortedRowModel().rows.findIndex((r) => r.id === row.id) + 1}
      </span>
    ),
  };
}

/** Kolom persentase berbentuk bilah — dipakai berulang di tiga tabel. */
function barisPersen<T>(id: string, header: string, nilai: (b: T) => number | null, penuh = 100): ColumnDef<T> {
  return {
    id,
    header,
    accessorFn: (b) => nilai(b),
    cell: ({ getValue }) => {
      const v = getValue<number | null>();
      if (v === null) return <span className="text-[11px] text-muted-foreground">—</span>;
      const rasio = (v / penuh) * 100;
      return (
        <div className="flex w-28 items-center gap-2">
          <Progress value={Math.min(100, Math.round(rasio))} tone={rasio >= 100 ? "success" : "brand"} />
          <span className="w-12 text-right text-[11px] tabular-nums text-muted-foreground">{persen(v, 1)}</span>
        </div>
      );
    },
  };
}

const urutTurun = <T extends { actual: number }>(baris: T[]): T[] => [...baris].sort((a, b) => b.actual - a.actual);

const urutCapaian = <T extends { target: number; actual: number }>(baris: T[]): T[] =>
  [...baris].sort((a, b) => (b.target > 0 ? b.actual / b.target : -1) - (a.target > 0 ? a.actual / a.target : -1));

const urutMargin = (baris: BarisEbitda[]): BarisEbitda[] =>
  [...baris].sort((a, b) => (b.margin ?? -1) - (a.margin ?? -1));

/** Keterangan di bawah tabel — bentuknya sama dengan halaman KPI posisi. */
function Ringkasan({ tampilan, detail }: { tampilan: Tampilan; detail: DetailManajemen }) {
  const { skor } = detail;
  let teks: React.ReactNode = null;

  if (tampilan === "gross") {
    teks = (
      <>
        {skor.b.baris.filter((o) => o.actual > 0).length} outlet berjualan · omzet korporat{" "}
        <b className="text-foreground">{formatIDR(skor.a.actual)}</b> · target {formatIDR(skor.a.target)} ={" "}
        {persen(skor.a.capaian * 100)}
      </>
    );
  } else if (tampilan === "outlet") {
    teks = (
      <>
        {skor.b.jumlahIkut} outlet dihitung, {skor.b.jumlahBaru} dikecualikan · target {formatIDR(skor.b.target)} ·
        actual {formatIDR(skor.b.actual)} = <b className="text-foreground">{persen(skor.b.capaian * 100)}</b>
      </>
    );
  } else if (tampilan === "ebitda") {
    const kosong = detail.ebitda.filter((e) => e.labaBersih === null).length;
    teks = (
      <>
        Laba bersih {formatIDR(skor.c.labaBersih)} ÷ sales {formatIDR(skor.c.sales)} ={" "}
        <b className="text-foreground">{persen(skor.c.margin)}</b> dari target {TARGET_MARGIN}%
        {kosong > 0 ? ` · ${kosong} outlet belum diisi laba bersihnya oleh Coordinator Area` : ""}
      </>
    );
  } else if (tampilan === "divisi") {
    const terisi = skor.d.departemen.filter((d) => d.rata !== null).length;
    teks = (
      <>
        Rata-rata {terisi} departemen <b className="text-foreground">{angka(skor.d.rata)}</b> dari 100. Nilai tiap
        departemen adalah rata-rata posisinya sendiri, jadi departemen berposisi banyak tidak berbobot lebih besar.
        Seluruhnya otomatis dari modul KPI masing-masing.
      </>
    );
  }

  if (!teks) return null;
  return <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">{teks}</p>;
}
