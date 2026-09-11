"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { type ColumnDef } from "@tanstack/react-table";
import { CalendarRange, ClipboardList, ClipboardCheck, Coins, ListChecks, Lock, PiggyBank, ReceiptText, Store, Trash2, UtensilsCrossed } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Combobox } from "@/components/ui/combobox";
import { DataTable } from "@/components/ui/data-table";
import { Progress } from "@/components/ui/progress";
import { GrafikMingguan, KpiIndicatorDonut, KpiPerformanceChart, type LaluIndikator } from "./kpi-charts";
import { TabMinggu } from "./tabel-minggu";
import { DialogInput, bentukIsian, type OutletRingkas } from "./dialog-input";
import { DialogPengaturan } from "./dialog-pengaturan";
import { FormEfisiensi, FormFee, FormKegiatan, FormMenuPasar, type MenuEsb, type OpsiKegiatan } from "./form-tabel";
import { TabelHpp, TabelHygiene, TabelNetProfit, bagianDari } from "./tabel-monitor";
import { DialogLaporanKpi } from "./laporan-pdf";
import { DialogPanduan } from "./panduan";
import type { JenisEntri } from "@/lib/kpi/indikator";
import { skemaEntri } from "@/lib/kpi/entri-skema";
import { actualBersatuan, angka, bersatuan, persen } from "@/lib/kpi/satuan";
import { BULAN, periodeDari, tahunPilihan } from "./periode";
import { hapusEntriAction, hapusMenuPasarAction } from "@/lib/actions/kpi";
import { SEMUA_PIC } from "@/lib/kpi/semua-pic";
import type { BarisKpi, BarisEfisiensi } from "@/lib/kpi/hitung";
import type { DetailFee, DetailPasar, EntriKpi, LaporanKpi } from "@/lib/data/kpi";
import type { Indikator } from "@/lib/kpi/indikator";
import { formatDate, formatIDR } from "@/lib/utils";
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

/** Jenis catatan yang tiap barisnya wajib berlampiran — sama dengan server. */
const WAJIB_BUKTI_ENTRI: JenisEntri[] = ["hygiene_cctv", "cctv_qc"];



/**
 * Status satu indikator dalam satu kata yang bisa dibaca sekilas.
 *
 * Kolom Persentase sudah memuat angkanya, tapi angka menuntut pembacanya
 * menetapkan sendiri di mana batas "cukup" — dan tiap orang menetapkannya
 * berbeda. Batasnya dipasang di sini supaya satu-satunya jawabannya sama untuk
 * semua yang membaca.
 *
 * "Belum terukur" SENGAJA dibedakan dari "Belum tercapai": yang pertama berarti
 * datanya belum ada, yang kedua berarti sudah diukur dan hasilnya kurang. Dua
 * hal itu menuntut tindakan yang berbeda — yang satu mengisi data, yang lain
 * memperbaiki kerja.
 */
export function statusCapaian(persentase: number | null): { label: string; tone: "success" | "warning" | "danger" | "neutral" } {
  if (persentase === null) return { label: "Belum terukur", tone: "neutral" };
  if (persentase >= 100) return { label: "Tercapai", tone: "success" };
  if (persentase >= 80) return { label: "Hampir tercapai", tone: "warning" };
  return { label: "Belum tercapai", tone: "danger" };
}

export interface OpsiPosisi {
  value: string;
  label: string;
}

type Tampilan = "indikator" | "efisiensi" | "fee" | "pasar" | "hygiene" | "minggu" | "netprofit" | "hpp" | "riwayat";

export function PapanKpi({
  laporan,
  lalu,
  indikator,
  namaPosisi,
  namaDepartemen,
  pic,
  picOpsi,
  perPic,
  posisiOpsi,
  outlets,
  tenggatHari,
  bolehAtur,
  bolehAngkaOutlet,
  menuEsb,
}: {
  laporan: LaporanKpi;
  lalu: Record<string, LaluIndikator>;
  indikator: Indikator[];
  namaPosisi: string;
  namaDepartemen: string;
  pic: string[];
  /** Pilihan PIC di bilah saringan — nilainya bisa berupa ID, bukan nama. */
  picOpsi: OpsiPosisi[];
  /** Posisi ini dinilai per orang; PIC-nya dipilih di bilah saringan. */
  perPic: boolean;
  posisiOpsi: OpsiPosisi[];
  outlets: OutletRingkas[];
  tenggatHari: number[];
  bolehAtur: boolean;
  /** Gross Sales & Harga Pokok Penjualan hanya boleh diubah super admin. */
  bolehAngkaOutlet: boolean;
  /** Katalog menu ESB — hanya terisi untuk posisi yang menilai Keberhasilan Pasar. */
  menuEsb: MenuEsb[];
}) {
  const router = useRouter();
  const { baris, ringkas } = laporan;
  const bobotTimpang = Math.abs(ringkas.bobotTotal - 100) > 0.001;

  const [tampilan, setTampilan] = React.useState<Tampilan>("indikator");

  // "Semua" hanya untuk membaca gabungannya; angka yang disimpan atasnya tidak
  // menempel pada siapa pun dan tidak akan pernah bisa ditelusuri.
  const bolehSimpan = !perPic || (laporan.pic !== "" && laporan.pic !== SEMUA_PIC);

  // Pilihan tabel dibangun dari panel yang benar-benar ada. Menuliskannya
  // sebagai daftar tetap berarti suatu saat ada tombol menuju tabel kosong.
  const pilihanTabel = React.useMemo(() => {
    const out: { id: Tampilan; label: string; icon: LucideIcon }[] = [{ id: "indikator", label: "Indikator", icon: ListChecks }];
    if (laporan.efisiensi) out.push({ id: "efisiensi", label: "Efisiensi Beban", icon: Store });
    if (laporan.fee) out.push({ id: "fee", label: "Management Fee", icon: ReceiptText });
    if (laporan.pasar) out.push({ id: "pasar", label: "Keberhasilan Pasar", icon: UtensilsCrossed });
    // Tiga tabel pemantauan: apa yang SUDAH masuk, bukan berapa skornya.
    // Muncul hanya bila posisinya memang dinilai atas angka itu — pilihan yang
    // menuju tabel kosong lebih buruk daripada tidak ada pilihannya.
    const dariEntri = indikator.filter(
      (i) => i.actual.sumber === "entri" || i.actual.sumber === "pengurang" || i.actual.sumber === "harian",
    );
    const jenisBukti = dariEntri
      .map((i) => (i.actual as { entri: JenisEntri }).entri)
      .filter((j) => WAJIB_BUKTI_ENTRI.includes(j));
    const adaHygiene = jenisBukti.length > 0;
    if (adaHygiene) {
      out.push({
        id: "hygiene",
        label: jenisBukti.includes("hygiene_cctv") ? "Detail Hygiene Audit/CCTV" : "Detail Monitoring CCTV",
        icon: ClipboardCheck,
      });
    }
    // Detail Mingguan — bentuk yang sama persis dengan KPI Manajemen, hanya
    // outletnya dibatasi ke area orang ini. Muncul hanya bila ESB sudah menarik
    // minggunya; tombol menuju tabel kosong lebih buruk daripada tidak ada.
    if (laporan.ca?.minggu) {
      out.push({ id: "minggu", label: "Detail Mingguan", icon: CalendarRange });
    }
    if (laporan.ca && indikator.some((i) => i.key === "net_profit")) {
      out.push({ id: "netprofit", label: "Detail Net Profit", icon: PiggyBank });
    }
    if (laporan.ca && indikator.some((i) => i.key === "hpp")) {
      out.push({ id: "hpp", label: "Detail Harga Pokok Penjualan", icon: Coins });
    }
    // Riwayat Input hanya untuk posisi yang catatannya BELUM punya tabel
    // sendiri. Pada Coordinator Area satu-satunya catatan adalah Hygiene
    // Audit/CCTV, dan tabel detailnya sudah memuat baris yang sama persis —
    // dua tombol menuju isi yang sama membuat orang mengira ada dua daftar.
    // Posisi lain tetap memerlukannya: di sanalah satu-satunya tempat catatan
    // bisa dilihat dan dihapus.
    //
    // Posisi yang SELURUH indikatornya otomatis tidak punya riwayat input sama
    // sekali: tidak ada satu pun catatan yang bisa dilihat atau dihapus di
    // sana. Tombolnya dulu tetap muncul karena syaratnya diperiksa dari sisi
    // "apakah semua catatan sudah punya tabel sendiri" — dan pada posisi tanpa
    // catatan, jawabannya kebetulan juga "belum".
    const semuaTercakup = adaHygiene && dariEntri.every((i) => WAJIB_BUKTI_ENTRI.includes((i.actual as { entri: JenisEntri }).entri));
    if (dariEntri.length > 0 && !semuaTercakup) out.push({ id: "riwayat", label: "Riwayat Input", icon: ClipboardList });
    return out;
  }, [laporan.efisiensi, laporan.fee, laporan.pasar, laporan.ca, indikator]);

  // Nama outlet untuk tabel yang isinya hanya menyimpan id-nya.
  const namaOutlet = React.useMemo(() => new Map(outlets.map((o) => [o.id, o.nama])), [outlets]);

  const entriHygiene = React.useMemo(
    () => laporan.entri.filter((e) => WAJIB_BUKTI_ENTRI.includes(e.jenis)),
    [laporan.entri],
  );

  // Rasio target per outlet dibaca dari indikatornya sendiri, bukan ditulis
  // ulang sebagai angka di sini. Kalau suatu saat target Net Profit berubah
  // dari 30%, satu-satunya tempat yang perlu diubah tetap satu.
  const rasioNetProfit = React.useMemo(() => {
    const t = indikator.find((i) => i.key === "net_profit")?.target;
    return t && t.jenis === "porsi" ? t.rasio : 30;
  }, [indikator]);
  const rasioHpp = React.useMemo(() => {
    const t = indikator.find((i) => i.key === "hpp")?.target;
    return t && t.jenis === "tetap" ? t.nilai : 40;
  }, [indikator]);

  const [laporanTerbuka, setLaporanTerbuka] = React.useState(false);

  // Nama PIC untuk laporan cetak. `laporan.pic` menyimpan ID barisnya di basis
  // data — "usr_1b4f1440-05e6…" pada dokumen resmi tidak berarti apa pun bagi
  // yang membacanya, dan tidak bisa dicocokkan dengan siapa pun tanpa membuka
  // basis data.
  const namaPic = React.useMemo(() => {
    if (!perPic || !laporan.pic) return "";
    if (laporan.pic === SEMUA_PIC) return "Semua";
    return picOpsi.find((o) => o.value === laporan.pic)?.label ?? laporan.pic;
  }, [perPic, laporan.pic, picOpsi]);

  // Indikator yang dihitung dari jumlah kegiatan — itulah yang bisa diisi
  // sekaligus lewat tabel. Yang lain (temuan, tenggat, angka) punya bentuk
  // isiannya sendiri di dialog Input.
  const opsiKegiatan = React.useMemo<OpsiKegiatan[]>(() => {
    const out: OpsiKegiatan[] = indikator
      // Selain catatan biasa, ikut di sini: indikator yang dinilai per HARI
      // (monitoring uptime) dan indikator PENGURANG yang punya bentuk tabelnya
      // sendiri (SLA). Keduanya diisi berbaris tanggal, persis seperti catatan
      // biasa — memberinya form sendiri berarti dua pintu masuk ke satu tujuan.
      .filter(
        (i) =>
          i.actual.sumber === "entri" ||
          i.actual.sumber === "harian" ||
          (i.actual.sumber === "pengurang" && !!skemaEntri(i.actual.entri)),
      )
      .map((i) => ({
        jenis: (i.actual as { entri: JenisEntri }).entri,
        label: i.label,
        // Dua jenis catatan ini WAJIB berbukti: keduanya menyatakan bahwa
        // sebuah pemeriksaan benar-benar dilakukan, dan pernyataan tanpa bukti
        // tidak bisa dibedakan dari yang tidak dilakukan sama sekali.
        bukti: WAJIB_BUKTI_ENTRI.includes((i.actual as { entri: JenisEntri }).entri),
      }));
    // Angka bulanan per outlet ikut di sini supaya tidak ada dua pintu masuk
    // ke tujuan yang sama.
    // Penjualan, laba, dan harga pokok adalah angka yang MENILAI Coordinator
    // Area. Pilihannya tidak ditampilkan kepada yang tidak berhak supaya tidak
    // ada yang mengisi sampai penuh lalu ditolak di ujung.
    const punya = (k: string) => indikator.some((i) => i.key === k);
    if (bolehAngkaOutlet) {
      if (punya("net_profit")) out.push({ jenis: "net_profit", label: "Net Profit (per outlet)" });
      if (punya("hpp")) out.push({ jenis: "hpp", label: "Harga Pokok Penjualan (per outlet)" });
      if (laporan.ca && laporan.ca.detail.some((o) => !o.dariEsb)) {
        out.push({ jenis: "gross_manual", label: "Gross Sales manual (outlet tanpa ESB)" });
      }
    }
    return out;
  }, [indikator, laporan.ca, bolehAngkaOutlet]);

  // Kolom Kategori hanya berguna bagi posisi yang indikatornya berkelompok.
  // Untuk yang tidak, isinya satu kolom penuh tanda pisah — bukan sekadar
  // mubazir, melainkan memakan lebar yang dibutuhkan kolom yang berisi.
  const adaKategori = baris.some((b) => b.kategori);

  // Indikator yang masih perlu tombol Input: yang bisa diisi tapi bentuknya
  // bukan kegiatan, jadi tidak tercakup form tabel.
  const perluDialogInput = React.useMemo(
    () => indikator.some((i) => bentukIsian(i) !== "otomatis" && bentukIsian(i) !== "kegiatan"),
    [indikator],
  );

  const kolom = React.useMemo<ColumnDef<BarisKpi>[]>(
    () => [
      {
        accessorKey: "label",
        header: "Indikator",
        // Penjelasan rumus TIDAK ikut di sini. Ia sama tiap bulan dan sama
        // untuk semua orang, jadi mengulanginya di tiap baris hanya memakan
        // lebar yang dibutuhkan angkanya — tempatnya sekarang di tombol
        // Panduan. Yang tetap ditulis hanya `alasan`: itu berubah-ubah dan
        // menjelaskan kenapa baris INI belum punya angka.
        cell: ({ row }) => (
          <div className="min-w-0 max-w-[20rem]">
            <p className="truncate font-medium text-foreground">{row.original.label}</p>
            {row.original.alasan && <p className="truncate text-[11px] text-muted-foreground">{row.original.alasan}</p>}
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
        // Kosong ditulis 0, bukan tanda pisah — lihat `actualBersatuan`.
        cell: ({ row }) => <span className="tabular-nums text-foreground/80">{actualBersatuan(row.original.actual, row.original.satuan)}</span>,
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
          {/* Angka per outlet menempel pada outlet dan bulan, bukan pada orangnya,
              jadi tetap bisa diisi sambil melihat gabungan seluruh Coordinator
              Area. Yang tidak bisa hanya catatan kegiatan — itu memang milik
              seseorang. */}
          <DialogPanduan indikator={indikator} perOutlet={!!laporan.ca} />
          {/* Tanpa satu pun indikator yang boleh diisi orang ini, tombolnya
              tidak ditampilkan sama sekali — dialog berisi dropdown kosong
              lebih membingungkan daripada tombol yang memang tidak ada. */}
          {!laporan.dikunci && opsiKegiatan.length > 0 && (
            <FormKegiatan
              posisi={laporan.posisi}
              periode={laporan.periode}
              pic={laporan.pic}
              picOpsi={pic}
              opsi={opsiKegiatan}
              outlet={laporan.ca?.detail ?? []}
              outletSemua={outlets}
              bulanKosong={laporan.ca?.bulanKosong ?? []}
              bolehKegiatan={bolehSimpan}
              onPeriode={(p) => pindah(`/kpi/${laporan.posisi}?periode=${p}${laporan.pic ? `&pic=${encodeURIComponent(laporan.pic)}` : ""}`)}
            />
          )}
          {/* Tombol Input hanya muncul bila masih ADA yang belum tercakup form
              tabel. Dua pintu ke tujuan yang sama membuat orang bertanya-tanya
              mana yang benar, dan angka yang sama bisa masuk dua kali lewat
              jalan yang berbeda. */}
          {!laporan.dikunci && bolehSimpan && perluDialogInput && (
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

      {/* Grafik + donat — grid yang sama dengan Work Tracker.
          Grafiknya IKUT TAB YANG DIBUKA, seperti di KPI Manajemen: yang dicari
          orang di Detail Mingguan bukan lagi capaian per indikator melainkan
          bentuk bulan berjalan. Donatnya sengaja tidak ikut berganti — ia
          menjawab pertanyaan lain, dari mana skor orang ini datang, dan itu
          tidak berubah karena tabel di bawahnya berganti. */}
      <div className="mb-4 grid items-stretch gap-4 lg:grid-cols-[minmax(0,1fr)_23rem]">
        {tampilan === "minggu" && laporan.ca?.minggu?.korporat ? (
          <GrafikMingguan judul="Omzet Mingguan" minggu={laporan.ca.minggu.minggu} baris={laporan.ca.minggu.korporat} />
        ) : (
          <KpiPerformanceChart baris={baris} lalu={lalu} />
        )}
        <KpiIndicatorDonut baris={baris} />
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
          // Tombol unduh di tabel ini mengeluarkan LAPORAN, bukan spreadsheet —
          // alasannya ada di `laporan-pdf.tsx`. Letaknya sengaja tidak digeser:
          // orang sudah tahu ikon unduh ada di sebelah kolom cari.
          onExport={() => setLaporanTerbuka(true)}
          exportTitle="Unduh laporan KPI (PDF)"
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
      {tampilan === "hygiene" && (
        <TabelHygiene
          entri={entriHygiene}
          namaOutlet={namaOutlet}
          posisi={laporan.posisi}
          periode={laporan.periode}
          pic={laporan.pic}
          bolehHapus={!laporan.dikunci && bolehSimpan}
          toolbar={toolbar}
        />
      )}
      {tampilan === "minggu" && laporan.ca?.minggu && (
        <TabMinggu
          detail={laporan.ca.minggu}
          tableId="kpi-ca-minggu"
          judul="Seluruh outlet area"
          toolbar={toolbar}
          onExport={() => setLaporanTerbuka(true)}
        />
      )}
      {tampilan === "netprofit" && laporan.ca && <TabelNetProfit detail={laporan.ca.detail} rasio={rasioNetProfit} toolbar={toolbar} />}
      {tampilan === "hpp" && laporan.ca && <TabelHpp detail={laporan.ca.detail} rasio={rasioHpp} toolbar={toolbar} />}
      {tampilan === "riwayat" && (
        <TabelRiwayat
          entri={laporan.entri}
          posisi={laporan.posisi}
          periode={laporan.periode}
          pic={laporan.pic}
          namaOutlet={namaOutlet}
          toolbar={toolbar}
        />
      )}

      <Ringkasan tampilan={tampilan} laporan={laporan} rasioNetProfit={rasioNetProfit} rasioHpp={rasioHpp} />

      <DialogLaporanKpi
        open={laporanTerbuka}
        onOpenChange={setLaporanTerbuka}
        laporan={laporan}
        lalu={lalu}
        namaPosisi={namaPosisi}
        namaDepartemen={namaDepartemen}
        namaPic={namaPic}
      />
    </div>
  );
}

/* ─────────────────────────── pengalih tabel ─────────────────────────── */

/**
 * Pengalih tabel — bentuknya persis pengalih Table/Kanban di Work Tracker.
 *
 * MENGGULIR MENDATAR, TIDAK DIBAGI RATA. Sebelumnya tiap tombol memakai lebar
 * yang sama besar, jadi begitu pilihannya bertambah jadi tujuh, "Detail Harga
 * Pokok Penjualan" diperas sampai tulisannya menabrak ikon tetangganya — dan
 * seluruh bilahnya jadi selebar barisnya, mendorong tombol unduh turun ke baris
 * berikutnya. Sekarang tiap tombol selebar tulisannya sendiri dan bilahnya
 * digeser bila tidak muat.
 */
export function PilihTabel<T extends string>({
  pilihan,
  nilai,
  onNilai,
}: {
  pilihan: { id: T; label: string; icon: LucideIcon }[];
  nilai: T;
  onNilai: (v: T) => void;
}) {
  return (
    // TIGA LAPIS, dan tiap lapis punya satu tugas.
    //
    // Terluar memegang bingkai dan lengkungnya, serta memotong isinya mengikuti
    // lengkung itu — jadi tombol yang tergeser keluar hilang di balik sudut
    // membulat, bukan terpenggal garis lurus.
    //
    // Tengah adalah kotak guliran. Ia diberi bantalan di KEEMPAT sisi supaya
    // cincin dan bayangan tombol terpilih — keduanya digambar di LUAR kotak
    // tombol — punya ruang dan tidak terpangkas tepi kotak guliran sendiri.
    //
    // Lengkung tombol dibuat lebih kecil daripada lengkung bingkainya. Dua
    // lengkung berbeda pusat yang saling memotong itulah yang membuat sudut
    // tombol terlihat tergigit rata, dan jarak sebesar bantalan ini menjauhkan
    // keduanya.
    <div className="max-w-full overflow-hidden rounded-2xl border border-border bg-muted/50">
      <div className="scroll-fade-x flex items-center gap-1 p-1.5">
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
                "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
              // Cincinnya dipasang di dalam supaya tidak pernah keluar dari
              // kotak tombol dan tidak bisa terpangkas kotak guliran.
                on ? "bg-background text-foreground shadow-sm ring-1 ring-inset ring-border" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-3.5 shrink-0" />
              {p.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Keterangan di bawah tabel — menjelaskan angka tabel yang sedang tampil. */
function Ringkasan({ tampilan, laporan, rasioNetProfit, rasioHpp }: { tampilan: Tampilan; laporan: LaporanKpi; rasioNetProfit: number; rasioHpp: number }) {
  let teks: React.ReactNode = null;

  // Tabel indikator TIDAK diberi keterangan di bawahnya. Skor bulan ini sudah
  // tertulis besar-besar di kartu ringkasan, dan rumus "actual ÷ target" sudah
  // terbaca dari kolom-kolomnya sendiri — mengulanginya sebagai paragraf hanya
  // menambah teks yang tidak dibaca siapa pun.
  if (tampilan === "efisiensi" && laporan.efisiensi) {
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
  } else if (tampilan === "hygiene") {
    // Indikatornya dicari lewat kuncinya masing-masing: Coordinator Area
    // memakai "hygiene_cctv", Quality Assurance & Control memakai "qc_cctv".
    const b = laporan.baris.find((x) => x.key === "hygiene_cctv" || x.key === "qc_cctv");
    const lampir = laporan.entri
      .filter((e) => WAJIB_BUKTI_ENTRI.includes(e.jenis))
      .reduce((a, e) => a + e.lampiran.length, 0);
    teks = (
      <>
        {angka(b?.actual ?? 0)} submit dari target {angka(b?.target ?? null)} ={" "}
        <b className="text-foreground">{persen(b?.persentase ?? null)}</b> · {lampir} berkas bukti terlampir.
      </>
    );
  } else if ((tampilan === "netprofit" || tampilan === "hpp") && laporan.ca) {
    // Persentasenya dihitung dari JUMLAH kedua kolomnya, bukan dari rata-rata
    // persentase tiap outlet. Rata-rata persentase memberi bobot yang sama
    // kepada outlet sepuluh juta dan outlet dua ratus juta — dan hasilnya
    // tidak akan pernah cocok dengan angka indikator di tabel sebelah.
    const ikut = laporan.ca.detail.filter((o) => o.ikut);
    const ambil = (o: (typeof ikut)[number]) => (tampilan === "netprofit" ? o.netProfit : o.hppNominal);
    const berisi = ikut.filter((o) => ambil(o) !== null && o.gross !== null);
    const totalNilai = berisi.reduce((a, o) => a + (ambil(o) ?? 0), 0);
    const totalGross = berisi.reduce((a, o) => a + (o.gross ?? 0), 0);
    const nama = tampilan === "netprofit" ? "Net profit" : "Harga pokok penjualan";
    const rasio = tampilan === "netprofit" ? rasioNetProfit : rasioHpp;
    const totalTarget = (totalGross * rasio) / 100;
    teks = (
      <>
        {nama} {formatIDR(totalNilai)} dari gross sales {formatIDR(totalGross)} ={" "}
        <b className="text-foreground">{persen(bagianDari(totalNilai, totalGross || null))}</b> ·{" "}
        {tampilan === "netprofit" ? "target" : "batas"} {rasio}% = {formatIDR(totalTarget)} · {berisi.length} dari {ikut.length}{" "}
        outlet yang dinilai sudah terisi.
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
  cctv_qc: "Monitoring CCTV",
  quality_control: "Quality Control",
  riset_menu: "Riset Menu Baru",
  event: "Event / Program",
  faktur: "Faktur Pajak",
  penyampaian: "Penyampaian Data",
  temuan: "Temuan Head",
  pelunasan: "Pelunasan",
  pos_masterdata: "Master Data Menu & Promo",
  pos_sla: "SLA Deployment",
  pos_refresh: "Refreshment Kasir",
  pos_uptime: "Monitoring ESB",
  laporan_owner: "Laporan ke Owner",
};

function TabelRiwayat({
  entri,
  posisi,
  periode,
  pic,
  namaOutlet,
  toolbar,
}: {
  entri: EntriKpi[];
  posisi: string;
  periode: string;
  pic: string;
  namaOutlet: Map<string, string>;
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
        // Kategori lebih dulu: pada catatan berkategori, `judul` memang kosong
        // — kolomnya akan penuh tanda pisah padahal barisnya berisi.
        cell: ({ row }) => (
          <div className="min-w-0 max-w-[22rem]">
            <p className="truncate font-medium text-foreground">{row.original.kategori || row.original.judul || "—"}</p>
            {row.original.deskripsi && <p className="truncate text-[11px] text-muted-foreground">{row.original.deskripsi}</p>}
          </div>
        ),
      },
      {
        id: "cakupan",
        header: "Outlet",
        enableSorting: false,
        cell: ({ row }) =>
          row.original.semuaOutlet ? (
            <Badge tone="brand">Semua Outlet</Badge>
          ) : (
            <span className="text-foreground/80">{row.original.outletId ? namaOutlet.get(row.original.outletId) ?? "—" : "—"}</span>
          ),
      },
      {
        accessorKey: "hariLewat",
        header: "Hari Terlewat",
        cell: ({ row }) => {
          const n = row.original.hariLewat;
          if (row.original.selesai === null && n === null) return <span className="text-muted-foreground">—</span>;
          return (
            <span className={cn("tabular-nums", (n ?? 0) > 0 ? "text-rose-600 dark:text-rose-400" : "text-foreground/80")}>
              {n ?? 0}
            </span>
          );
        },
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
    [posisi, periode, pic, namaOutlet, router],
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
