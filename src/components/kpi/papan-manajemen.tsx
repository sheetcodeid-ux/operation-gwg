"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { type ColumnDef } from "@tanstack/react-table";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { Building2, CalendarRange, ChevronRight, Hash, Info, ListChecks, Loader2, Minus, Percent, Save, Settings2, Store, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { DataTable } from "@/components/ui/data-table";
import { Progress } from "@/components/ui/progress";
import { GrafikHarian, KpiIndicatorDonut, KpiPerformanceChart, type LaluIndikator } from "./kpi-charts";
import { DialogLaporanKpi } from "./laporan-pdf";
import { PilihTabel, statusCapaian } from "./papan-kpi";
import { TabMinggu } from "./tabel-minggu";
import { DialogPanduanManajemen } from "./panduan";
import { BULAN, periodeDari, tahunPilihan } from "./periode";
import { type BarisOutletB, type DepartemenKpi, type SetelanManajemen } from "@/lib/kpi/manajemen";
import { ringkasKpi, type BarisKpi } from "@/lib/kpi/hitung";
import type { BarisEbitda, DetailManajemen } from "@/lib/data/kpi-manajemen";
import type { LaporanKpi } from "@/lib/data/kpi";
import { merekOutlet } from "@/lib/kpi/merek";
import { simpanSetelanManajemenAction } from "@/lib/actions/kpi-manajemen";
import { cn, formatIDR, formatNumber } from "@/lib/utils";
import { actualBersatuan, angka, bersatuan, persen } from "@/lib/kpi/satuan";

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


/** Satu outlet dalam tabel Same Store — dipakai juga tabel Gross Sales. */
type BarisOutlet = BarisOutletB;

/** Satu baris tabel KPI Divisi: departemennya sendiri, atau posisi di bawahnya. */
interface BarisDivisi {
  id: string;
  jenis: "dept" | "posisi";
  nama: string;
  dept: DepartemenKpi;
  lalu: number | null;
  ini: number | null;
}

/** Ambang batas warna persentase: di atas ini hijau, di bawahnya merah. */
const AMBANG_HIJAU = 80;

type Tampilan = "komponen" | "gross" | "outlet" | "ebitda" | "minggu" | "divisi";
type Satuan = "persen" | "angka";

/** Pengalih persen/angka — bentuknya sama dengan yang ada di kartu grafik. */
function PilihSatuan({ nilai, onNilai }: { nilai: Satuan; onNilai: (v: Satuan) => void }) {
  const opsi: { id: Satuan; label: string; icon: LucideIcon }[] = [
    { id: "persen", label: "Persen", icon: Percent },
    { id: "angka", label: "Angka", icon: Hash },
  ];
  return (
    // Bentuk dan tinggi PERSIS sama dengan pengalih tabel di sebelahnya —
    // dua kotak sejenis yang berbeda tinggi terbaca sebagai dua hal yang
    // berbeda derajatnya, padahal keduanya sama-sama saklar tampilan.
    <div className="inline-flex shrink-0 items-center gap-1 overflow-hidden rounded-2xl border border-border bg-muted/50 p-1.5">
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
              "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
              on ? "bg-background text-foreground shadow-sm ring-1 ring-inset ring-border" : "text-muted-foreground hover:text-foreground",
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

export function PapanManajemen({ detail, bolehAtur }: { detail: DetailManajemen; bolehAtur: boolean }) {
  const st = detail.setelan;
  const router = useRouter();
  const { skor } = detail;
  const [tampilan, setTampilan] = React.useState<Tampilan>("komponen");
  const [satuan, setSatuan] = React.useState<Satuan>("persen");
  const [pdf, setPdf] = React.useState(false);
  const [buka, setBuka] = React.useState<Set<string>>(new Set());
  const alih = React.useCallback(
    (kode: string) =>
      setBuka((k) => {
        const baru = new Set(k);
        if (!baru.delete(kode)) baru.add(kode);
        return baru;
      }),
    [],
  );

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
      buat("a", "Gross Sales Corporate", st.bobot.a, skor.a.target, skor.a.actual, skor.a.capaian, skor.a.skor, "rupiah",
        `Target = rata-rata omzet tiga bulan sebelumnya + ${st.pertumbuhan}%. Seluruh outlet ikut, termasuk yang baru buka.`),
      buat("b", "Same Store Sales", st.bobot.b, skor.b.target, skor.b.actual, skor.b.capaian, skor.b.skor, "rupiah",
        `Hanya outlet berumur di atas ${st.umurSameStore} bulan. Target tiap outlet = rata-rata tiga bulan sebelumnya + ${st.pertumbuhan}%.`),
      // EBITDA aslinya rasio. Nominalnya dibawa terpisah supaya mode Angka
      // menampilkan rupiah laba bersih, bukan "30%" di bawah tombol Angka.
      buat("c", "EBITDA Same Store", st.bobot.c, st.targetMargin, skor.c.margin, skor.c.capaian, skor.c.skor, "persen",
        `Margin laba bersih terhadap sales same store, target ${st.targetMargin}%. Berjenjang, bukan lulus-atau-tidak.`,
        { actual: skor.c.labaBersih, target: (skor.c.sales * st.targetMargin) / 100 }),
      buat("d", "KPI All Division", st.bobot.d, 100, skor.d.rata, skor.d.rata / 100, skor.d.skor, "angka",
        "Rata-rata nilai tiap departemen; tiap departemen bersuara sekali, berapa pun jumlah posisinya."),
    ];
  }, [skor, st]);

  const pilihanTabel = React.useMemo<{ id: Tampilan; label: string; icon: LucideIcon }[]>(
    () => [
      { id: "komponen", label: "Komponen", icon: ListChecks },
      { id: "gross", label: "Detail Gross Sales Corporate", icon: TrendingUp },
      { id: "outlet", label: "Detail Same Store", icon: Store },
      { id: "ebitda", label: "Detail EBITDA Same Store", icon: Wallet },
      { id: "minggu", label: "Detail Mingguan", icon: CalendarRange },
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
  /**
   * Isi grafik mengikuti tab yang dibuka.
   *
   * Tiga tab detail memakai GRAFIK HARIAN: yang dicari orang saat membuka
   * rincian penjualan bukan lagi urutan outlet melainkan bentuk bulan
   * berjalan — hari mana yang jatuh, dan apakah sisa harinya masih cukup.
   * Donatnya SENGAJA tidak ikut berganti: ia menjawab pertanyaan lain, dari
   * mana skor perusahaan ini datang, dan itu tidak berubah karena tabel di
   * bawahnya berganti.
   */
  const harian = React.useMemo<{ judul: string; target: number | null } | null>(() => {
    if (tampilan === "gross") return { judul: "Omzet Harian", target: skor.a.target };
    if (tampilan === "outlet") return { judul: "Omzet Harian", target: skor.b.target };
    if (tampilan === "ebitda") return { judul: "Omzet Harian", target: skor.b.target };
    if (tampilan === "minggu") return { judul: "Omzet Harian", target: skor.a.target };
    return null;
  }, [tampilan, skor.a.target, skor.b.target]);

  const grafik = React.useMemo<{ judul: string; baris: BarisKpi[]; lalu: Record<string, LaluIndikator> }>(() => {
    if (tampilan === "divisi") {
      return {
        judul: "Capaian per Departemen",
        // Departemen tanpa nilai DIKELUARKAN dari grafik, bukan digambar nol —
        // garis yang jatuh ke dasar terbaca sebagai "gagal total", padahal
        // modulnya memang belum ada. Tabelnya tetap mendaftarnya.
        baris: skor.d.departemen.filter((d) => d.rata !== null).map((d) => ({
          key: d.kode,
          label: d.singkat,
          labelPenuh: d.nama,
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
  }, [tampilan, skor.d.departemen, detail.lalu, baris]);

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
            <div className="flex min-w-0 max-w-[22rem] items-center gap-1.5">
              <span className="truncate font-medium text-foreground">{row.original.label}</span>
              <Keterangan teks={row.original.penjelasan} />
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
          // Kosong ditulis 0, bukan tanda pisah — lihat `actualBersatuan`.
          cell: ({ row }) => {
            const v = nilai(row.original, "actual");
            return <span className="tabular-nums text-foreground/80">{actualBersatuan(v.n, v.s)}</span>;
          },
        },
        {
          accessorKey: "persentase",
          header: "Persentase",
          cell: ({ row }) => <BarPersen nilai={row.original.persentase} />,
        },
        {
          accessorKey: "persenActual",
          header: "%",
          // Bobot keempat komponen berjumlah 100, jadi skornya MEMANG persentase
          // — "33,23 / 40" menuntut pembacanya membagi sendiri untuk tahu
          // sumbangannya ke skor perusahaan, padahal angkanya sudah itu.
          // Warna disimpan untuk bilah Persentase saja. Dua kolom berwarna
          // bersebelahan membuat keduanya berebut perhatian, dan kolom ini
          // hanya menyebut sumbangan — bukan hal yang perlu diperingatkan.
          cell: ({ row }) => <span className="tabular-nums text-foreground/80">{persen(row.original.persenActual)}</span>,
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

  /**
   * Tiga tabel detail memakai KERANGKA KOLOM YANG SAMA.
   *
   * Gross Sales, Same Store, dan EBITDA menjawab tiga pertanyaan berbeda tapi
   * bentuk barisnya identik: satu outlet, angkanya bulan lalu, angkanya bulan
   * ini, dan seberapa jauh geraknya. Menyusun tiganya berbeda memaksa orang
   * mencari ulang kolom yang sama tiap kali berpindah tab.
   */
  const kolomDetail = React.useCallback(
    <T,>(opsi: {
      lalu: (b: T) => number | null;
      ini: (b: T) => number | null;
      satuanNilai: "rupiah" | "persen";
      status: (b: T) => { label: string; tone: "success" | "warning" | "danger" | "neutral" | "brand" };
    }): ColumnDef<T>[] => [
      kolomNo(),
      {
        id: "nama",
        header: "Outlet",
        accessorFn: (b: T) => (b as { nama: string }).nama,
        cell: ({ getValue }) => <span className="truncate font-medium text-foreground">{getValue<string>()}</span>,
      },
      {
        id: "merek",
        header: "Brand",
        accessorFn: (b: T) => merekOutlet((b as { nama: string }).nama)?.label ?? "—",
        cell: ({ row }) => {
          const m = merekOutlet((row.original as { nama: string }).nama);
          return m ? <Badge tone={m.tone}>{m.label}</Badge> : <span className="text-[11px] text-muted-foreground">—</span>;
        },
      },
      {
        id: "lalu",
        header: "Bulan Lalu",
        accessorFn: (b: T) => opsi.lalu(b),
        cell: ({ getValue }) => <span className="tabular-nums text-muted-foreground">{bersatuan(getValue<number | null>(), opsi.satuanNilai)}</span>,
      },
      {
        id: "ini",
        header: "Bulan Ini",
        accessorFn: (b: T) => opsi.ini(b),
        cell: ({ getValue }) => <span className="tabular-nums text-foreground/80">{bersatuan(getValue<number | null>(), opsi.satuanNilai)}</span>,
      },
      {
        id: "banding",
        header: "Perbandingan",
        accessorFn: (b: T) => bandingPersen(opsi.lalu(b), opsi.ini(b)),
        cell: ({ getValue }) => <Selisih nilai={getValue<number | null>()} />,
      },
      {
        id: "status",
        header: "Status",
        accessorFn: (b: T) => opsi.status(b).label,
        cell: ({ row }) => {
          const st = opsi.status(row.original);
          return <Badge tone={st.tone}>{st.label}</Badge>;
        },
      },
    ],
    [],
  );


  const kolomGross = React.useMemo<ColumnDef<BarisOutlet>[]>(() => {
    return kolomDetail<BarisOutlet>({
      lalu: (o) => o.bulanLalu[2],
      ini: (o) => o.actual,
      satuanNilai: "rupiah",
      status: (o) => arahStatus(bandingPersen(o.bulanLalu[2], o.actual)),
    });
  }, [kolomDetail]);

  const kolomOutlet = React.useMemo<ColumnDef<BarisOutlet>[]>(
    () =>
      kolomDetail<BarisOutlet>({
        lalu: (o) => o.bulanLalu[2],
        ini: (o) => o.actual,
        satuanNilai: "rupiah",
          status: (o) => (o.ikut ? { label: "Dihitung", tone: "success" } : { label: "Dikecualikan", tone: "neutral" }),
      }),
    [kolomDetail],
  );

  const kolomEbitda = React.useMemo<ColumnDef<BarisEbitda>[]>(
    () =>
      kolomDetail<BarisEbitda>({
        lalu: (e) => e.labaLalu,
        ini: (e) => e.labaBersih,
        satuanNilai: "rupiah",
        // Ambangnya 85% DARI TARGET, bukan target penuh. Margin adalah hasil
        // puluhan keputusan kecil sepanjang bulan; menuntut 30% persis membuat
        // outlet yang meleset setengah persen dinilai sama dengan yang meleset
        // sepuluh persen, dan status yang hampir selalu merah berhenti dibaca.
        status: (e) =>
          e.margin === null
            ? { label: "Belum diisi", tone: "neutral" }
            : e.margin >= st.targetMargin * (st.ambangEbitda / 100)
              ? { label: "Tercapai", tone: "success" }
              : { label: "Belum tercapai", tone: "danger" },
      }),
    [kolomDetail, st],
  );

  /**
   * Departemen dan posisinya dalam SATU daftar datar.
   *
   * Rinciannya muncul di bawah barisnya sendiri, bukan di jendela terpisah.
   * Jendela menutupi tabelnya, jadi yang membandingkan satu departemen dengan
   * departemen lain harus membuka-tutup berulang kali; sisipan di bawah baris
   * membuat keduanya terbaca sekaligus.
   */
  const barisDivisi = React.useMemo<BarisDivisi[]>(
    () =>
      skor.d.departemen.flatMap((d) => {
        const induk: BarisDivisi = { id: d.kode, jenis: "dept", nama: d.nama, dept: d, lalu: d.lalu, ini: d.rata };
        if (!buka.has(d.kode)) return [induk];
        return [
          induk,
          ...d.posisi.map<BarisDivisi>((pos) => ({
            id: `${d.kode}/${pos.kode}`,
            jenis: "posisi",
            nama: pos.nama,
            dept: d,
            lalu: pos.lalu,
            ini: pos.nilai,
          })),
        ];
      }),
    [skor.d.departemen, buka],
  );

  const kolomDivisi = React.useMemo<ColumnDef<BarisDivisi>[]>(
    () => [
      {
        accessorKey: "nama",
        header: "Departemen",
        cell: ({ row }) => {
          const b = row.original;
          if (b.jenis === "posisi") {
            return (
              <span className="block truncate pl-9 text-foreground/80">{b.nama}</span>
            );
          }
          const kosong = b.dept.posisi.length === 0;
          const terbuka = buka.has(b.dept.kode);
          return (
            <button
              type="button"
              disabled={kosong}
              onClick={() => alih(b.dept.kode)}
              aria-expanded={terbuka}
              className="flex min-w-0 items-center gap-2 text-left disabled:cursor-default"
            >
              <ChevronRight className={cn("size-4 shrink-0 text-muted-foreground transition-transform", terbuka && "rotate-90", kosong && "opacity-0")} />
              <span className="min-w-0">
                <span className="block truncate font-medium text-foreground">{b.nama}</span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {kosong ? "belum ada posisi ber-modul" : `${b.dept.posisi.length} posisi`}
                </span>
              </span>
            </button>
          );
        },
      },
      {
        id: "lalu",
        header: "Bulan Lalu",
        accessorFn: (b) => b.lalu,
        cell: ({ row }) => <Nilai n={row.original.lalu} tebal={false} />,
      },
      {
        id: "ini",
        header: "Bulan Ini",
        accessorFn: (b) => b.ini,
        cell: ({ row }) => <Nilai n={row.original.ini} tebal={row.original.jenis === "dept"} />,
      },
      {
        id: "selisih",
        header: "Perbandingan",
        accessorFn: (b) => (b.ini === null || b.lalu === null ? null : b.ini - b.lalu),
        cell: ({ getValue }) => <Selisih nilai={getValue<number | null>()} satuan="poin" />,
      },
    ],
    [buka, alih],
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
          {bolehAtur && <DialogSetelan setelan={st} />}
        </div>
      </div>

      {/* Grafik + donat — grid yang sama dengan halaman KPI posisi. */}
      <div className="mb-4 grid items-stretch gap-4 lg:grid-cols-[minmax(0,1fr)_23rem]">
        {harian ? (
          <GrafikHarian judul={harian.judul} periode={detail.periode} hari={detail.harian} targetBulan={harian.target} />
        ) : (
          <KpiPerformanceChart judul={grafik.judul} baris={grafik.baris} lalu={grafik.lalu} />
        )}
        <KpiIndicatorDonut baris={baris} />
      </div>

      {tampilan === "komponen" && (
        <DataTable tableId="kpi-manajemen" columns={kolomKomponen} data={baris} searchPlaceholder="Cari komponen…" stickyHeader={false} toolbar={toolbar} onExport={() => setPdf(true)} exportTitle="Unduh laporan PDF" />
      )}
      {tampilan === "gross" && (
        <DataTable tableId="kpi-manajemen-gross" columns={kolomGross} data={urutTurun(skor.b.baris)} searchPlaceholder="Cari outlet…" stickyHeader={false} toolbar={toolbar} onExport={() => setPdf(true)} exportTitle="Unduh laporan PDF" />
      )}
      {tampilan === "outlet" && (
        <DataTable tableId="kpi-manajemen-outlet" columns={kolomOutlet} data={urutCapaian(skor.b.baris)} searchPlaceholder="Cari outlet…" stickyHeader={false} toolbar={toolbar} onExport={() => setPdf(true)} exportTitle="Unduh laporan PDF" />
      )}
      {tampilan === "ebitda" && (
        <DataTable tableId="kpi-manajemen-ebitda" columns={kolomEbitda} data={urutMargin(detail.ebitda)} searchPlaceholder="Cari outlet…" stickyHeader={false} toolbar={toolbar} onExport={() => setPdf(true)} exportTitle="Unduh laporan PDF" />
      )}
      {tampilan === "minggu" &&
        (detail.minggu ? (
          <TabMinggu detail={detail.minggu} tableId="kpi-manajemen-minggu" judul="Seluruh outlet" toolbar={toolbar} onExport={() => setPdf(true)} />
        ) : (
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="mb-3">{toolbar}</div>
            <p className="text-[13px] text-muted-foreground">
              Rincian mingguan bulan ini belum ditarik dari ESB. Penarikannya berjalan sendiri tiap jam — satu panggilan
              per outlet per minggu — dan tabel ini terisi begitu minggu pertama selesai.
            </p>
          </div>
        ))}
      {tampilan === "divisi" && (
        <DataTable tableId="kpi-manajemen-divisi" columns={kolomDivisi} data={barisDivisi} searchPlaceholder="Cari departemen…" stickyHeader={false} toolbar={toolbar} onExport={() => setPdf(true)} exportTitle="Unduh laporan PDF" />
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



/** Selisih dua bulan dalam persen; null bila salah satunya belum ada. */
function bandingPersen(lalu: number | null, ini: number | null): number | null {
  if (lalu === null || ini === null || lalu === 0) return null;
  return ((ini - lalu) / Math.abs(lalu)) * 100;
}

/** Arah gerak sebagai status — dipakai tabel yang tidak punya target sendiri. */
function arahStatus(v: number | null): { label: string; tone: "success" | "danger" | "neutral" } {
  if (v === null) return { label: "Belum ada pembanding", tone: "neutral" };
  if (v > 0.05) return { label: "Naik", tone: "success" };
  if (v < -0.05) return { label: "Turun", tone: "danger" };
  return { label: "Tetap", tone: "neutral" };
}

/** Lencana selisih — bentuk yang sama dipakai tabel outlet maupun departemen. */
function Selisih({ nilai, satuan = "%" }: { nilai: number | null; satuan?: string }) {
  if (nilai === null) return <span className="text-[11px] text-muted-foreground">—</span>;
  const naik = nilai > 0.005;
  const turun = nilai < -0.005;
  // Ikon tren, bukan segitiga: segitiga hanya menyatakan arah, sedangkan garis
  // yang mendaki atau menukik menyatakan arah SEKALIGUS memberi bentuk yang
  // terbaca sekilas dari seberang meja.
  const Ikon = naik ? TrendingUp : turun ? TrendingDown : Minus;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[12px] font-medium tabular-nums",
        naik ? "text-emerald-600 dark:text-emerald-400" : turun ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground",
      )}
    >
      <Ikon className="size-3.5 shrink-0" />
      {angka(Math.abs(nilai))}
      {satuan === "%" ? "%" : ` ${satuan}`}
    </span>
  );
}

/**
 * Nilai KPI sebagai persentase polos.
 *
 * Bilah dipakai di tabel outlet karena yang dibandingkan di sana satu angka
 * terhadap targetnya. Di sini yang dibandingkan angka terhadap ANGKA LAIN —
 * bulan ini dengan bulan lalu — dan dua bilah bersebelahan justru menyamarkan
 * selisih kecil yang jadi inti tabelnya.
 */
function Nilai({ n, tebal }: { n: number | null; tebal: boolean }) {
  if (n === null) return <span className="text-[11px] text-muted-foreground">belum terukur</span>;
  return (
    <span className={cn("tabular-nums", tebal ? "font-semibold text-foreground" : "text-foreground/80")}>
      {formatNumber(n, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
    </span>
  );
}

/**
 * Keterangan yang muncul saat kursor diarahkan.
 *
 * Kalimat penjelas di bawah tiap nama komponen memakan setengah tinggi baris
 * dan tetap terpotong di tengah kata. Yang membacanya sudah tahu isinya
 * setelah sekali baca; yang belum tahu tinggal mengarahkan kursor.
 *
 * DIGAMBAR DI LUAR TABEL lewat portal, dengan posisi tetap dari layar. Tabel
 * punya kotak bergulir sendiri, dan apa pun yang digambar di dalamnya akan
 * terpotong tepi kotak itu — keterangan yang terpotong separuh justru lebih
 * membingungkan daripada tidak ada keterangan sama sekali.
 */
function Keterangan({ teks }: { teks: string }) {
  const [posisi, setPosisi] = React.useState<{ atas: number; kiri: number } | null>(null);
  const acuan = React.useRef<HTMLButtonElement>(null);

  const buka = React.useCallback(() => {
    const k = acuan.current?.getBoundingClientRect();
    if (k) setPosisi({ atas: k.bottom + 8, kiri: k.left + k.width / 2 });
  }, []);
  const tutup = React.useCallback(() => setPosisi(null), []);

  if (!teks) return null;
  return (
    <>
      <button
        ref={acuan}
        type="button"
        aria-label={teks}
        onMouseEnter={buka}
        onMouseLeave={tutup}
        onFocus={buka}
        onBlur={tutup}
        className="shrink-0 text-muted-foreground/70 transition-colors hover:text-foreground focus-visible:text-foreground"
      >
        <Info className="size-3.5" />
      </button>
      {posisi !== null &&
        typeof document !== "undefined" &&
        createPortal(
          <span
            role="tooltip"
            style={{ top: posisi.atas, left: posisi.kiri }}
            className="pointer-events-none fixed z-[100] w-72 -translate-x-1/2 rounded-lg border border-border bg-card px-3 py-2 text-[11.5px] leading-relaxed text-muted-foreground shadow-lg"
          >
            {teks}
          </span>,
          document.body,
        )}
    </>
  );
}

/**
 * Satu isian angka bersatuan.
 *
 * Ditulis DI LUAR dialognya, bukan di dalam: komponen yang dibuat ulang tiap
 * render membuat React menganggapnya komponen baru, memasang ulang kotak
 * isiannya, dan fokus keyboard lepas tiap satu huruf diketik.
 */
function IsianAngka({
  label,
  nilai,
  ubah,
  satuan,
  catatan,
}: {
  label: string;
  nilai: number;
  ubah: (v: number) => void;
  satuan: string;
  catatan?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11.5px] text-muted-foreground">{label}</span>
      <span className="relative block">
        <Input
          value={String(nilai)}
          onChange={(e) => {
            const t = e.target.value.replace(",", ".").replace(/[^\d.-]/g, "");
            const x = Number(t);
            ubah(Number.isFinite(x) ? x : 0);
          }}
          inputMode="decimal"
          className="h-9 pr-24 tabular-nums"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">{satuan}</span>
      </span>
      {catatan ? <span className="mt-1 block text-[11px] leading-relaxed text-muted-foreground">{catatan}</span> : null}
    </label>
  );
}

/**
 * Bobot dan target — satu-satunya angka di halaman ini yang memang diketik.
 *
 * Bukan data bulanan melainkan KEBIJAKAN: berlaku untuk seluruh bulan sekaligus
 * dan hanya berubah saat manajemen memutuskan mengubahnya. Karena itu ia duduk
 * di dialog tersendiri, bukan tercampur dengan angka bulan berjalan, dan hanya
 * master admin yang melihat tombolnya.
 */
function DialogSetelan({ setelan }: { setelan: SetelanManajemen }) {
  const router = useRouter();
  const [buka, setBuka] = React.useState(false);
  const [sibuk, setSibuk] = React.useState(false);
  // Isian disetel ulang saat dialognya DIBUKA, bukan lewat efek yang mengintip
  // propnya: efek semacam itu berjalan setelah render dan memicu render kedua
  // tiap kali halaman menyegarkan dirinya, sementara yang sedang mengetik
  // kehilangan ketikannya di tengah jalan.
  const [n, setN] = React.useState(setelan);
  const bukaForm = () => {
    setN(setelan);
    setBuka(true);
  };

  const totalBobot = n.bobot.a + n.bobot.b + n.bobot.c + n.bobot.d;
  const timpang = Math.abs(totalBobot - 100) > 0.001;

  async function simpan() {
    setSibuk(true);
    const res = await simpanSetelanManajemenAction(n);
    setSibuk(false);
    if (res.error) return toast.error(res.error);
    toast.success("Bobot dan target tersimpan");
    setBuka(false);
    router.refresh();
  }

  return (
    <>
      <Button size="sm" variant="outline" className="gap-1.5" onClick={bukaForm}>
        <Settings2 className="size-4" /> Pengaturan
      </Button>

      <Dialog open={buka} onOpenChange={setBuka}>
        <DialogContent title="Pengaturan KPI Manajemen" description="Bobot dan target yang berlaku untuk seluruh bulan" align="center" className="max-w-2xl">
          <div className="flex max-h-[75vh] flex-col gap-5 overflow-auto p-5">
            <section>
              <h4 className="mb-2 text-[12.5px] font-semibold text-foreground">Bobot komponen</h4>
              <div className="grid gap-3 sm:grid-cols-4">
                <IsianAngka label="Gross Sales Corporate" nilai={n.bobot.a} satuan="%" ubah={(v) => setN({ ...n, bobot: { ...n.bobot, a: v } })} />
                <IsianAngka label="Same Store Sales" nilai={n.bobot.b} satuan="%" ubah={(v) => setN({ ...n, bobot: { ...n.bobot, b: v } })} />
                <IsianAngka label="EBITDA Same Store" nilai={n.bobot.c} satuan="%" ubah={(v) => setN({ ...n, bobot: { ...n.bobot, c: v } })} />
                <IsianAngka label="KPI All Division" nilai={n.bobot.d} satuan="%" ubah={(v) => setN({ ...n, bobot: { ...n.bobot, d: v } })} />
              </div>
              <p className={cn("mt-2 text-[11.5px]", timpang ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground")}>
                Jumlah bobot {angka(totalBobot)} dari 100
                {timpang ? " — skor tertinggi ikut bergeser dan perusahaan akan tampak gagal padahal pembaginya yang salah." : "."}
              </p>
            </section>

            <section>
              <h4 className="mb-2 text-[12.5px] font-semibold text-foreground">Target dan ambang</h4>
              <div className="grid gap-3 sm:grid-cols-2">
                <IsianAngka
                  label="Pertumbuhan penjualan"
                  nilai={n.pertumbuhan}
                  satuan="%"
                  ubah={(v) => setN({ ...n, pertumbuhan: v })}
                  catatan="Ditambahkan ke rata-rata tiga bulan, untuk Gross Sales Corporate maupun Same Store."
                />
                <IsianAngka
                  label="Target margin EBITDA"
                  nilai={n.targetMargin}
                  satuan="%"
                  ubah={(v) => setN({ ...n, targetMargin: v })}
                  catatan="Laba bersih dibagi sales same store."
                />
                <IsianAngka
                  label="Ambang EBITDA tercapai"
                  nilai={n.ambangEbitda}
                  satuan="% dari target"
                  ubah={(v) => setN({ ...n, ambangEbitda: v })}
                  catatan="Outlet yang mencapai sebanyak ini dari target margin sudah dihitung tercapai."
                />
                <IsianAngka
                  label="Umur minimum same store"
                  nilai={n.umurSameStore}
                  satuan="bulan"
                  ubah={(v) => setN({ ...n, umurSameStore: v })}
                  catatan="Outlet yang lebih muda dikecualikan dari Same Store Sales, bukan dinilai nol."
                />
              </div>
            </section>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-border p-4">
            <Button variant="ghost" size="sm" onClick={() => setN(setelan)} disabled={sibuk}>
              Batalkan perubahan
            </Button>
            <Button size="sm" onClick={simpan} disabled={sibuk || timpang} className="gap-1.5">
              {sibuk ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Simpan
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
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

/**
 * Persentase berbentuk bilah, warnanya menyusul angkanya.
 *
 * Hijau begitu mendekati target, merah selama masih jauh. Angkanya diberi
 * warna yang sama dan TIDAK ditebalkan: tebal membuat seluruh kolom berteriak
 * sama keras, sedangkan yang perlu menonjol hanya yang merah.
 */
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

const urutTurun = <T extends { actual: number }>(baris: T[]): T[] => [...baris].sort((a, b) => b.actual - a.actual);

const urutCapaian = <T extends { target: number; actual: number }>(baris: T[]): T[] =>
  [...baris].sort((a, b) => (b.target > 0 ? b.actual / b.target : -1) - (a.target > 0 ? a.actual / a.target : -1));

const urutMargin = (baris: BarisEbitda[]): BarisEbitda[] =>
  [...baris].sort((a, b) => (b.margin ?? -1) - (a.margin ?? -1));

/** Keterangan di bawah tabel — bentuknya sama dengan halaman KPI posisi. */
function Ringkasan({ tampilan, detail }: { tampilan: Tampilan; detail: DetailManajemen }) {
  const { skor } = detail;
  let teks: React.ReactNode = null;

  if (tampilan === "outlet") {
    teks = (
      <>
        Kolom % = capaian terhadap target outlet itu sendiri · {skor.b.jumlahIkut} outlet dihitung,{" "}
        {skor.b.jumlahBaru} dikecualikan · target {formatIDR(skor.b.target)} ·
        actual {formatIDR(skor.b.actual)} = <b className="text-foreground">{persen(skor.b.capaian * 100)}</b>
      </>
    );
  } else if (tampilan === "ebitda") {
    const kosong = detail.ebitda.filter((e) => e.labaBersih === null).length;
    teks = (
      <>
        Margin outlet terhadap target {detail.setelan.targetMargin}%; {detail.setelan.ambangEbitda}% ke atas sudah
        dihitung tercapai · laba bersih {formatIDR(skor.c.labaBersih)} ÷ sales{" "}
        {formatIDR(skor.c.sales)} ={" "}
        <b className="text-foreground">{persen(skor.c.margin)}</b>
        {kosong > 0 ? ` · ${kosong} outlet belum diisi laba bersihnya oleh Coordinator Area` : ""}
      </>
    );
  } else if (tampilan === "divisi") {
    const terisi = skor.d.departemen.filter((d) => d.rata !== null).length;
    teks = (
      <>
        Tekan nama departemen untuk membuka posisinya. Rata-rata {terisi} departemen <b className="text-foreground">{angka(skor.d.rata)}</b> dari 100. Nilai tiap
        departemen adalah rata-rata posisinya sendiri, jadi departemen berposisi banyak tidak berbobot lebih besar.
        Seluruhnya otomatis dari modul KPI masing-masing.
      </>
    );
  }

  if (!teks) return null;
  return <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">{teks}</p>;
}
