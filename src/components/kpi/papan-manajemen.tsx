"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { type ColumnDef } from "@tanstack/react-table";
import { Building2, ListChecks, Loader2, Plus, Save, Store, Table2, Trash2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { DataTable } from "@/components/ui/data-table";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { KpiIndicatorDonut, KpiPerformanceChart } from "./kpi-charts";
import { InputRupiah } from "./form-tabel";
import { PilihTabel, statusCapaian } from "./papan-kpi";
import { DialogPanduanManajemen } from "./panduan";
import { BULAN, labelPeriode, periodeDari, tahunPilihan } from "./periode";
import { simpanManajemenAction } from "@/lib/actions/kpi-manajemen";
import { BOBOT, PERTUMBUHAN, TARGET_MARGIN, UMUR_SAME_STORE, type DivisiKpi } from "@/lib/kpi/manajemen";
import type { BarisKpi } from "@/lib/kpi/hitung";
import type { DetailManajemen } from "@/lib/data/kpi-manajemen";
import { formatIDR, formatNumber } from "@/lib/utils";

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
 * bukan sederet indikator milik satu orang.
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

const num = (v: string): number | null => {
  const t = String(v).replace(/[^\d.-]/g, "");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

type Tampilan = "komponen" | "outlet" | "divisi";

export function PapanManajemen({ detail }: { detail: DetailManajemen }) {
  const router = useRouter();
  const { skor } = detail;
  const [tampilan, setTampilan] = React.useState<Tampilan>("komponen");

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
      satuan: BarisKpi["satuan"],
      penjelasan: string,
    ): BarisKpi => ({
      key,
      label,
      bobot,
      target,
      actual,
      persentase: Math.max(0, Math.min(100, capaian * 100)),
      persenActual: skorKomponen,
      penjelasan,
      satuan,
    });
    return [
      buat("a", "Gross Sales Corporate", BOBOT.a, skor.a.target, skor.a.actual, skor.a.capaian, skor.a.skor, "rupiah",
        `Target = rata-rata omzet tiga bulan sebelumnya + ${PERTUMBUHAN}%. Seluruh outlet ikut, termasuk yang baru buka.`),
      buat("b", "Same Store Sales", BOBOT.b, skor.b.target, skor.b.actual, skor.b.capaian, skor.b.skor, "rupiah",
        `Hanya outlet berumur di atas ${UMUR_SAME_STORE} bulan. Target tiap outlet = rata-rata tiga bulan sebelumnya + ${PERTUMBUHAN}%.`),
      buat("c", "EBITDA Same Store", BOBOT.c, TARGET_MARGIN, skor.c.margin, skor.c.capaian, skor.c.skor, "persen",
        `Margin laba bersih terhadap sales same store, target ${TARGET_MARGIN}%. Berjenjang, bukan lulus-atau-tidak.`),
      buat("d", "KPI All Division", BOBOT.d, 100, skor.d.rata, skor.d.rata / 100, skor.d.skor, "angka",
        "Rata-rata nilai KPI seluruh divisi, semuanya berbobot sama."),
    ];
  }, [skor]);

  const pilihanTabel = React.useMemo<{ id: Tampilan; label: string; icon: LucideIcon }[]>(
    () => [
      { id: "komponen", label: "Komponen", icon: ListChecks },
      { id: "outlet", label: "Detail Same Store", icon: Store },
      { id: "divisi", label: "Detail KPI Divisi", icon: Building2 },
    ],
    [],
  );

  const toolbar = <PilihTabel pilihan={pilihanTabel} nilai={tampilan} onNilai={setTampilan} />;

  const kolomKomponen = React.useMemo<ColumnDef<BarisKpi>[]>(
    () => [
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
    ],
    [],
  );

  const kolomOutlet = React.useMemo<ColumnDef<(typeof skor.b.baris)[number]>[]>(
    () => [
      {
        id: "no",
        header: "#",
        enableSorting: false,
        cell: ({ row, table }) => (
          <span className="tabular-nums text-muted-foreground">
            {table.getSortedRowModel().rows.findIndex((r) => r.id === row.id) + 1}
          </span>
        ),
      },
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
      {
        id: "capaian",
        header: "% thd Target",
        accessorFn: (o) => (o.target > 0 ? (o.actual / o.target) * 100 : null),
        cell: ({ getValue }) => {
          const v = getValue<number | null>();
          if (v === null) return <span className="text-[11px] text-muted-foreground">—</span>;
          return (
            <div className="flex w-28 items-center gap-2">
              <Progress value={Math.min(100, Math.round(v))} tone={v >= 100 ? "success" : "brand"} />
              <span className="w-12 text-right text-[11px] tabular-nums text-muted-foreground">{persen(v, 1)}</span>
            </div>
          );
        },
      },
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

  const kolomDivisi = React.useMemo<ColumnDef<DivisiKpi>[]>(() => {
    const otomatis = new Set(detail.divisiOtomatis);
    return [
      {
        accessorKey: "nama",
        header: "Divisi",
        cell: ({ getValue }) => <span className="font-medium text-foreground">{getValue<string>()}</span>,
      },
      {
        id: "sumber",
        header: "Sumber",
        accessorFn: (d) => (otomatis.has(d.nama) ? "Modul KPI" : "Diketik"),
        cell: ({ row }) =>
          otomatis.has(row.original.nama) ? <Badge tone="brand">Modul KPI</Badge> : <Badge tone="neutral">Diketik</Badge>,
      },
      {
        accessorKey: "nilai",
        header: "Nilai KPI",
        cell: ({ getValue }) => {
          const v = getValue<number>();
          return (
            <div className="flex w-40 items-center gap-2">
              <Progress value={Math.min(100, v)} tone={v >= 85 ? "success" : v >= 70 ? "warning" : "danger"} />
              <span className="w-12 text-right text-[11px] tabular-nums text-muted-foreground">{angka(v)}</span>
            </div>
          );
        },
      },
    ];
  }, [detail.divisiOtomatis]);

  return (
    <div>
      {/* Bilah saringan — bentuknya sama dengan halaman KPI posisi. */}
      <div className="scroll-fade-x -mx-1 mb-4 flex items-center gap-2 px-1 py-0.5">
        <Combobox portal searchable={false} className="w-28 shrink-0" value={tahun} onChange={(v) => pindah(periodeDari(v, bulan))} options={tahunPilihan()} />
        <Combobox portal searchable={false} className="w-40 shrink-0" value={bulan} onChange={(v) => pindah(periodeDari(tahun, v))} options={BULAN} />
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Badge tone={skor.peringkat.tone}>{skor.peringkat.label}</Badge>
          <DialogPanduanManajemen />
          <DialogAngka detail={detail} />
        </div>
      </div>

      {/* Grafik + donat — grid yang sama dengan halaman KPI posisi. */}
      <div className="mb-4 grid items-stretch gap-4 lg:grid-cols-[minmax(0,1fr)_23rem]">
        <KpiPerformanceChart baris={baris} lalu={detail.lalu} />
        <KpiIndicatorDonut baris={baris} />
      </div>

      {tampilan === "komponen" && (
        <DataTable
          tableId="kpi-manajemen"
          columns={kolomKomponen}
          data={baris}
          searchPlaceholder="Cari komponen…"
          stickyHeader={false}
          showExport={false}
          toolbar={toolbar}
        />
      )}
      {tampilan === "outlet" && (
        <DataTable
          tableId="kpi-manajemen-outlet"
          columns={kolomOutlet}
          data={skor.b.baris}
          searchPlaceholder="Cari outlet…"
          stickyHeader={false}
          toolbar={toolbar}
        />
      )}
      {tampilan === "divisi" && (
        <DataTable
          tableId="kpi-manajemen-divisi"
          columns={kolomDivisi}
          data={skor.d.divisi}
          searchPlaceholder="Cari divisi…"
          stickyHeader={false}
          toolbar={toolbar}
        />
      )}

      <Ringkasan tampilan={tampilan} detail={detail} />
    </div>
  );
}

/** Keterangan di bawah tabel — bentuknya sama dengan halaman KPI posisi. */
function Ringkasan({ tampilan, detail }: { tampilan: Tampilan; detail: DetailManajemen }) {
  const { skor } = detail;
  let teks: React.ReactNode = null;

  if (tampilan === "outlet") {
    teks = (
      <>
        {skor.b.jumlahIkut} outlet dihitung, {skor.b.jumlahBaru} dikecualikan · target {formatIDR(skor.b.target)} ·
        actual {formatIDR(skor.b.actual)} = <b className="text-foreground">{persen(skor.b.capaian * 100)}</b>
      </>
    );
  } else if (tampilan === "divisi") {
    teks = (
      <>
        Rata-rata {skor.d.divisi.length} divisi <b className="text-foreground">{angka(skor.d.rata)}</b> dari 100 ·{" "}
        {detail.divisiOtomatis.length} di antaranya diambil otomatis dari modul KPI-nya sendiri. Nilai yang diketik
        ulang menang atas angka otomatis.
      </>
    );
  } else if (detail.catatan) {
    teks = <>{detail.catatan}</>;
  }

  if (!teks) return null;
  return <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">{teks}</p>;
}

/* ────────────────────────────── isian angka ────────────────────────────── */

/**
 * Satu pintu untuk seluruh angka yang memang diketik.
 *
 * Bentuknya mengikuti "Catat Kegiatan" di halaman KPI posisi: tabelnya hanya
 * membaca, isiannya di dalam dialog. Menaruh kotak isian langsung di dalam
 * tabel membuat halaman yang sebagian besarnya laporan terlihat seperti
 * formulir.
 */
function DialogAngka({ detail }: { detail: DetailManajemen }) {
  const router = useRouter();
  const [buka, setBuka] = React.useState(false);
  const [sibuk, setSibuk] = React.useState(false);
  const [divisi, setDivisi] = React.useState<DivisiKpi[]>(detail.skor.d.divisi);
  const [laba, setLaba] = React.useState(String(detail.labaBersih));
  const [sales, setSales] = React.useState(detail.salesManual === null ? "" : String(detail.salesManual));
  const [catatan, setCatatan] = React.useState(detail.catatan);
  const otomatis = new Set(detail.divisiOtomatis);

  function bukaForm() {
    setDivisi(detail.skor.d.divisi);
    setLaba(String(detail.labaBersih));
    setSales(detail.salesManual === null ? "" : String(detail.salesManual));
    setCatatan(detail.catatan);
    setBuka(true);
  }

  async function simpan() {
    setSibuk(true);
    const res = await simpanManajemenAction({
      periode: detail.periode,
      divisi,
      labaBersih: num(laba),
      salesManual: num(sales),
      catatan,
    });
    setSibuk(false);
    if (res.error) return toast.error(res.error);
    toast.success("Tersimpan");
    setBuka(false);
    router.refresh();
  }

  return (
    <>
      <Button size="sm" variant="outline" className="gap-1.5" onClick={bukaForm}>
        <Table2 className="size-4" /> Isi Angka
      </Button>

      <Dialog open={buka} onOpenChange={setBuka}>
        <DialogContent
          title="Isi Angka KPI Manajemen"
          description={`${labelPeriode(detail.periode)} — hanya angka yang memang tidak punya sumbernya sendiri`}
          align="center"
          className="max-w-3xl"
        >
          <div className="flex max-h-[75vh] flex-col gap-4 overflow-auto p-5">
            <section>
              <h4 className="mb-2 text-[12.5px] font-semibold text-foreground">EBITDA Same Store</h4>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-[11.5px] text-muted-foreground">Laba bersih same store</span>
                  <InputRupiah nilai={laba} onUbah={setLaba} className="h-9" izinkanMinus />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11.5px] text-muted-foreground">
                    Sales same store — kosong = pakai total actual komponen B
                  </span>
                  <InputRupiah nilai={sales} onUbah={setSales} className="h-9" placeholder={formatNumber(detail.skor.b.actual)} />
                </label>
              </div>
            </section>

            <section>
              <h4 className="mb-1 text-[12.5px] font-semibold text-foreground">KPI All Division</h4>
              <p className="mb-2 text-[11.5px] leading-relaxed text-muted-foreground">
                Divisi bertanda <b>Modul KPI</b> nilainya datang dari halaman KPI-nya sendiri. Mengetiknya di sini
                menimpa angka itu — dan yang diketik akan menang seterusnya sampai dikosongkan lagi.
              </p>
              <div className="space-y-1.5">
                {divisi.map((d, i) => (
                  <div key={`${d.nama}-${i}`} className="flex items-center gap-2">
                    <Input
                      className="h-9 min-w-0 flex-1"
                      value={d.nama}
                      placeholder="Nama divisi"
                      onChange={(e) => setDivisi((s) => s.map((x, n) => (n === i ? { ...x, nama: e.target.value } : x)))}
                    />
                    <Input
                      inputMode="numeric"
                      className="h-9 w-20 shrink-0 text-right tabular-nums"
                      value={String(d.nilai)}
                      onChange={(e) => setDivisi((s) => s.map((x, n) => (n === i ? { ...x, nilai: num(e.target.value) ?? 0 } : x)))}
                    />
                    {otomatis.has(d.nama) ? (
                      <span className="w-9 shrink-0" />
                    ) : (
                      <button
                        type="button"
                        aria-label={`Hapus ${d.nama || "divisi"}`}
                        onClick={() => setDivisi((s) => s.filter((_, n) => n !== i))}
                        className="grid size-9 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-red-600 dark:hover:text-red-400"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setDivisi((s) => [...s, { nama: "", nilai: 0 }])}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Plus className="size-3.5" /> Tambah divisi
                </button>
              </div>
            </section>

            <label className="block">
              <span className="mb-1 block text-[11.5px] text-muted-foreground">Catatan bulan ini</span>
              <textarea
                value={catatan}
                onChange={(e) => setCatatan(e.target.value)}
                rows={2}
                placeholder="Opsional — konteks yang perlu diingat saat angka ini dibaca ulang bulan depan."
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              />
            </label>
          </div>

          <div className="flex shrink-0 justify-end gap-2 border-t border-border p-4">
            <Button variant="ghost" onClick={() => setBuka(false)} disabled={sibuk}>
              Batal
            </Button>
            <Button onClick={simpan} disabled={sibuk} className="gap-1.5">
              {sibuk ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Simpan
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
