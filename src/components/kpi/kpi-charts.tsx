"use client";

import * as React from "react";
import { Area, Bar, CartesianGrid, Cell, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartPie, Check, Hash, Layers, Percent, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BarisKpi } from "@/lib/kpi/hitung";
import type { BarisMinggu, RentangMinggu } from "@/lib/kpi/minggu";
import { formatIDR, formatNumber } from "@/lib/utils";

/**
 * Dua kartu grafik KPI — dibangun mengikuti Work Tracker.
 *
 * Bentuknya sengaja SAMA PERSIS dengan `work-performance-chart` dan
 * `work-role-donut`: kartu `rounded-2xl border bg-card/40 p-5`, judul 13px,
 * subjudul 11px, batang abu-abu + area biru, dan cincin donat berujung bulat
 * dengan legenda di sampingnya. Modul yang tampil beda sendiri memaksa orang
 * belajar dua kali untuk membaca hal yang sama.
 */

const BLUE = "#3b82f6";
const ABU = "#94a3b8";
const TARGET = "#f59e0b";
const COLORS = ["#3b82f6", "#f59e0b", "#06b6d4", "#8b5cf6", "#10b981", "#f43f5e", "#64748b", "#eab308"];

/**
 * Kartu grafik.
 *
 * TANPA SUBJUDUL. Bulan dan posisinya sudah tertulis di bilah saringan tepat di
 * atas kedua kartu ini; mengulanginya dua kali lagi hanya memakan tinggi yang
 * seharusnya jadi bidang grafiknya.
 */
function Kartu({ title, aksi, children }: { title: string; aksi?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col rounded-2xl border border-border bg-card/40 p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
        {aksi}
      </div>
      {children}
    </div>
  );
}

/** Capaian bulan lalu — persen untuk grafiknya, nominal untuk keterangannya. */
export interface LaluIndikator {
  persen: number | null;
  actual: number | null;
}

type Satuan = "angka" | "rupiah" | "persen" | undefined;

type Titik = {
  name: string;
  full: string;
  ini: number;
  lalu: number;
  target: number;
  satuan: Satuan;
  nIni: number | null;
  nLalu: number | null;
  nTarget: number | null;
};

type Sumbu = "persen" | "angka";

const SUMBU = [
  { id: "persen", label: "Persen", icon: Percent },
  { id: "angka", label: "Angka", icon: Hash },
] as const;

/** Nominal seperti di tabel — rupiah tetap rupiah, persen tetap persen. */
function nominal(v: number | null, satuan: Satuan): string {
  if (v === null) return "—";
  if (satuan === "rupiah") return formatIDR(v);
  if (satuan === "persen") return `${formatNumber(v, { maximumFractionDigits: 2 })}%`;
  return formatNumber(v, { maximumFractionDigits: 2 });
}

/**
 * Nominal yang dipendekkan untuk ditempel di atas titik grafik.
 *
 * "Rp 4.186.500.000" selebar seperlima grafiknya dan akan menabrak label
 * tetangganya; "4,19 M" terbaca sekilas dan tetap cukup untuk membandingkan.
 * Angka penuhnya tetap ada di keterangan yang muncul saat titiknya disentuh.
 */
function ringkas(v: number | null, satuan: Satuan): string {
  if (v === null) return "";
  if (satuan === "persen") return `${formatNumber(v, { maximumFractionDigits: 1 })}%`;
  const abs = Math.abs(v);
  const [bagi, akhiran] = abs >= 1e9 ? [1e9, " M"] : abs >= 1e6 ? [1e6, " jt"] : abs >= 1e4 ? [1e3, " rb"] : [1, ""];
  const angka = formatNumber(v / bagi, { maximumFractionDigits: bagi === 1 ? 0 : 2 });
  return `${satuan === "rupiah" ? "Rp " : ""}${angka}${akhiran}`;
}

function Tip({ active, payload, sumbu }: { active?: boolean; payload?: { payload: Titik }[]; sumbu?: Sumbu }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const baris: [string, string, number, string][] = [
    ["Bulan ini", BLUE, d.ini, nominal(d.nIni, d.satuan)],
    ["Bulan lalu", ABU, d.lalu, nominal(d.nLalu, d.satuan)],
    ["Target", TARGET, d.target, nominal(d.nTarget, d.satuan)],
  ];
  return (
    <div className="rounded-xl border border-border bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-medium text-foreground">{d.full}</p>
      {baris.map(([nama, warna, persen, nom]) => (
        <p key={nama} className="flex items-center gap-2 text-muted-foreground">
          <span className="size-2 shrink-0 rounded-full" style={{ background: warna }} />
          {nama}
          {/* Keduanya selalu tampil — yang sedang dipilih ditebalkan. Angka
              tanpa persennya tidak bisa dibandingkan antar-indikator, dan
              persen tanpa angkanya tidak bisa dicocokkan dengan laporan. */}
          <span className="ml-auto whitespace-nowrap">
            <b className={sumbu === "angka" ? "text-foreground" : "font-normal"}>{nom}</b>
            <span className="mx-1 opacity-40">·</span>
            <b className={sumbu === "persen" ? "text-foreground" : "font-normal"}>{persen}%</b>
          </span>
        </p>
      ))}
    </div>
  );
}

/**
 * Label sumbu X — NAMA PENUH, dipotong dengan elipsis bila tidak muat.
 *
 * Singkatan "GS" dan "HACM" hemat tempat tapi harus dihafal; nama yang
 * terpotong "Harga Pokok Pen…" masih bisa ditebak siapa pun tanpa dijelaskan.
 * Berapa huruf yang muat dihitung dari lebar yang benar-benar tersedia untuk
 * satu label, bukan dari angka tetap yang akan meleset di layar sempit maupun
 * lebar.
 */
function LabelSumbu({
  x,
  y,
  payload,
  index,
  muat,
  muatTepi,
  jumlah,
}: {
  x?: number;
  y?: number;
  payload?: { value: string };
  index?: number;
  /** Berapa huruf yang muat pada label di tengah. */
  muat: number;
  /** Label paling pinggir hanya punya SEPARUH jatah, karena ia dirapatkan ke
   *  dalam dan melebar ke satu arah saja. */
  muatTepi: number;
  jumlah: number;
}) {
  const teks = payload?.value ?? "";
  const diTepi = index === 0 || index === jumlah - 1;
  const batas = diTepi ? muatTepi : muat;
  const potong = teks.length > batas ? `${teks.slice(0, Math.max(1, batas - 1)).trimEnd()}…` : teks;
  return (
    <text x={x} y={(y ?? 0) + 12} textAnchor={tepi(index, jumlah)} fill="var(--foreground)" fontSize={10.5} fontWeight={600}>
      <title>{teks}</title>
      {potong}
    </text>
  );
}

/**
 * Ke mana teks di titik paling pinggir merapat.
 *
 * Label yang selalu ditaruh di tengah titiknya akan menjorok separuh keluar
 * kartu pada titik pertama dan terakhir — dan yang terbaca bukan "Gross Sales"
 * melainkan "oss Sales". Yang di ujung dirapatkan ke dalam; yang di tengah
 * tetap di tengah titiknya.
 */
function tepi(index: number | undefined, jumlah: number): "start" | "middle" | "end" {
  if (index === 0) return "start";
  if (index !== undefined && index === jumlah - 1) return "end";
  return "middle";
}

/**
 * Capaian tiap indikator: bulan lalu, target, dan bulan ini.
 *
 * TIGA GARIS, TANPA BATANG. Batang dan garis dalam satu bidang membuat mata
 * membandingkan dua benda yang bentuknya berbeda — tinggi batang lawan
 * ketinggian titik. Tiga garis sejenis dibaca sekali jalan.
 *
 * GARISNYA TAJAM, bukan melengkung. Lengkungan menyisipkan nilai yang tidak
 * pernah ada di antara dua indikator yang bersebelahan — dan di sini sumbu
 * mendatarnya bukan waktu, melainkan daftar; tidak ada "antara Gross Sales dan
 * Net Profit" yang bisa dilewati.
 *
 * Garis target ADA di 100% pada setiap indikator, bukan karena semua targetnya
 * sama, melainkan karena sumbunya persen — 100% berarti target indikator itu
 * tepat tercapai. Dibuat putus-putus supaya tidak tertukar dengan capaian yang
 * sesungguhnya.
 *
 * DUA SATUAN, SATU GRAFIK. Bentuk garisnya SELALU ditentukan persentase —
 * indikator yang satu dihitung dalam lembar konten dan yang lain dalam miliar
 * rupiah, jadi menaruh keduanya pada satu sumbu angka membuat yang kecil rata
 * dengan garis dasar. Yang ditukar tombol Angka/Persen adalah apa yang
 * TERTULIS: persen di sumbu, atau nominalnya di atas tiap titik.
 */
/** Di atas jumlah ini, kartunya digulir ke samping alih-alih dipadatkan. */
const BATAS_PADAT = 12;

export function KpiPerformanceChart({
  baris,
  lalu,
  judul = "Capaian per Indikator",
}: {
  baris: BarisKpi[];
  /** Capaian bulan lalu per kunci indikator. */
  lalu: Record<string, LaluIndikator>;
  judul?: string;
}) {
  const [sumbu, setSumbu] = React.useState<Sumbu>("persen");
  const kotak = React.useRef<HTMLDivElement>(null);
  const [lebar, setLebar] = React.useState(0);

  // Lebar diukur, tidak ditebak: berapa huruf yang muat pada satu label
  // bergantung pada lebar yang tersisa, dan kartunya melar mengikuti layar.
  React.useEffect(() => {
    const el = kotak.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setLebar(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const data = React.useMemo<Titik[]>(
    () =>
      baris.map((b) => {
        // Indikator yang actual-nya rasio membawa nominal rupiahnya sendiri —
        // itulah yang dipakai kolom Angka. "37,4%" di bawah tombol bernama
        // Angka adalah jawaban untuk pertanyaan yang tidak ditanyakan.
        const pakaiNominal = b.actualNominal !== undefined && b.actualNominal !== null;
        return {
          name: b.label,
          full: b.labelPenuh ?? b.label,
          ini: b.persentase === null ? 0 : Math.round(b.persentase),
          lalu: lalu[b.key]?.persen == null ? 0 : Math.round(lalu[b.key].persen!),
          target: 100,
          satuan: pakaiNominal ? ("rupiah" as const) : b.satuan,
          nIni: pakaiNominal ? b.actualNominal! : b.actual,
          nLalu: pakaiNominal ? null : (lalu[b.key]?.actual ?? null),
          nTarget: pakaiNominal ? (b.targetNominal ?? null) : b.target,
        };
      }),
    [baris, lalu],
  );
  const adaIsi = data.some((d) => d.ini > 0 || d.lalu > 0);

  // ~6,2 px per huruf pada 10,5px tebal. Lebar sumbu Y dan sisipan kiri-kanan
  // dikeluarkan lebih dulu, lalu sisanya dibagi rata jadi jatah tiap label.
  //
  // Label PALING PINGGIR dihitung terpisah: ia dirapatkan ke dalam supaya tidak
  // menjorok keluar kartu, jadi ia melebar ke satu arah saja dan hanya punya
  // separuh jatah ditambah sisipan tepinya. Menyamakan keduanya membuat nama
  // panjang di ujung menabrak tetangganya — persis yang terjadi pada posisi
  // yang indikatornya enam dan namanya panjang-panjang.
  /**
   * Isi yang banyak DIGULIR, bukan dipadatkan.
   *
   * Lima puluh delapan outlet pada satu kartu selebar layar menyisakan tujuh
   * belas piksel per label — labelnya bertumpuk jadi bubur hitam, dan grafik
   * yang tidak terbaca lebih buruk daripada grafik yang harus digeser. Di
   * bawah ambang ini tidak ada yang berubah sama sekali.
   */
  const digulir = data.length > BATAS_PADAT;
  // Lebar satu titik mengikuti label TERPANJANG, bukan angka tetap. Nomor urut
  // butuh seperempat ruang nama outlet; memakai satu angka untuk keduanya
  // membuat grafik bernomor digulir jauh lebih panjang daripada perlunya.
  const hurufTerpanjang = data.reduce((n, d) => Math.max(n, d.name.length), 1);
  const lebarIsi = digulir ? Math.max(lebar, data.length * Math.max(26, hurufTerpanjang * 7 + 14)) : lebar;
  const jatah = (lebarIsi - 64) / Math.max(1, data.length);
  const muat = Math.max(6, Math.floor((jatah - 12) / 6.2));
  const muatTepi = Math.max(6, Math.floor((jatah / 2 + 18) / 6.2));

  return (
    <Kartu
      title={judul}
      aksi={
        <div className="inline-flex gap-1 rounded-lg border border-border bg-muted/50 p-1">
          {SUMBU.map((m) => {
            const on = sumbu === m.id;
            const Icon = m.icon;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setSumbu(m.id)}
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
      }
    >
      <div ref={kotak} className={cn("min-h-[17rem] flex-1", digulir && "overflow-x-auto")} style={{ outline: "none" }}>
        <ResponsiveContainer width={digulir ? lebarIsi : "100%"} height="100%" minWidth={digulir ? lebarIsi : undefined}>
          <ComposedChart data={data} margin={{ top: sumbu === "angka" ? 22 : 10, right: 4, left: 0, bottom: 0 }} accessibilityLayer={false}>
            <defs>
              <linearGradient id="kpiBlue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={BLUE} stopOpacity={0.35} />
                <stop offset="100%" stopColor={BLUE} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="kpiGrey" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#94a3b8" stopOpacity={0.85} />
                <stop offset="100%" stopColor="#94a3b8" stopOpacity={0.3} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.16)" vertical={false} />
            <XAxis
              dataKey="name"
              tick={<LabelSumbu muat={muat} muatTepi={muatTepi} jumlah={data.length} />}
              tickLine={false}
              axisLine={false}
              interval={0}
              height={26}
              // Skala TITIK, bukan pita. Dengan skala pita, tiap indikator
              // memegang satu petak selebar seperlima grafik dan titiknya
              // berdiri di tengah petak — separuh petak di ujung kiri dan kanan
              // tinggal kosong, dan grafiknya berhenti jauh sebelum tepi kartu.
              // Sisipan seukuran setengah batang menjaga batang paling pinggir
              // tetap utuh.
              scale="point"
              padding={{ left: 26, right: 22 }}
            />
            <YAxis
              domain={[0, 110]}
              ticks={[0, 25, 50, 75, 100]}
              tick={{ fill: "var(--foreground)", fontSize: 11, fontWeight: 600 }}
              tickLine={false}
              axisLine={false}
              width={42}
              tickFormatter={(v: number) => `${v}%`}
            />
            <Tooltip cursor={{ stroke: "rgba(148,163,184,0.35)", strokeWidth: 1 }} content={<Tip sumbu={sumbu} />} />
            {/* BULAN LALU BERBENTUK BATANG, bulan ini berbentuk garis. Dua
                garis sejenis yang berdekatan harus dibedakan lewat warna saja;
                dua bentuk yang berbeda langsung terbaca mana yang lampau dan
                mana yang berjalan — dan batang yang berdiri di belakang tidak
                pernah menutupi garis di depannya. */}
            <Bar dataKey="lalu" name="Bulan Lalu" fill="url(#kpiGrey)" radius={[4, 4, 0, 0]} maxBarSize={38} isAnimationActive={false} />
            <Line
              type="linear"
              dataKey="target"
              name="Target"
              stroke={TARGET}
              strokeWidth={2}
              strokeDasharray="6 5"
              dot={false}
              activeDot={false}
              isAnimationActive={false}
            />
            <Area
              type="linear"
              dataKey="ini"
              name="Bulan Ini"
              stroke={BLUE}
              strokeWidth={2.75}
              fill="url(#kpiBlue)"
              dot={{ r: 3, fill: BLUE, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
              className="chart-glow-blue"
              isAnimationActive={false}
              label={
                sumbu === "angka"
                  ? (props: unknown) => {
                      const { x, y, index } = props as { x: number; y: number; index: number };
                      const d = data[index];
                      if (!d) return <g />;
                      // Titik yang mendekati 100% tidak punya ruang di atasnya:
                      // labelnya akan menindih garis target yang juga ada di
                      // situ. Diperiksa dari NILAINYA, bukan dari koordinat —
                      // tinggi kartunya berubah mengikuti layar, koordinatnya
                      // ikut bergeser, sementara "dekat target" tidak.
                      const mepet = d.ini >= 82;
                      return (
                        <text x={x} y={mepet ? y + 17 : y - 9} textAnchor={tepi(index, data.length)} fill="var(--foreground)" fontSize={10} fontWeight={700}>
                          {ringkas(d.nIni, d.satuan)}
                        </text>
                      );
                    }
                  : undefined
              }
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {!adaIsi && (
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          Belum ada capaian pada bulan ini maupun bulan sebelumnya.
        </p>
      )}
    </Kartu>
  );
}

/* ─────────────────────────────────── donat ─────────────────────────────────── */

const R = 66;
const STROKE = 22;
const CIRC = 2 * Math.PI * R;

type Mode = "hasil" | "bobot";
const MODES = [
  { id: "hasil", label: "Actual", icon: ChartPie },
  { id: "bobot", label: "Bobot", icon: Layers },
] as const;
const MODE_TITLE: Record<Mode, string> = { hasil: "Actual", bobot: "Bobot" };

/**
 * Sebaran indikator dalam satu cincin.
 *
 * Dua tampilan yang bisa ditekan: **% Actual** memperlihatkan dari mana skor
 * bulan ini benar-benar datang, **Bobot** memperlihatkan seharusnya dari mana.
 * Membandingkan keduanya menjawab pertanyaan yang paling sering muncul di
 * rapat: indikator mana yang bobotnya besar tapi hasilnya kecil.
 *
 * Nama indikator di legenda DIPOTONG dengan elipsis, tidak dibiarkan turun
 * baris atau saling tindih — nama seperti "Head Product Development & Quality"
 * akan mendorong seluruh kartunya melar dan merusak sejajarannya dengan kartu
 * grafik di sebelahnya.
 */
/* ─────────────────────────── grafik omzet harian ─────────────────────────── */

export interface HariOmzet {
  tanggal: number;
  ini: number | null;
  lalu: number | null;
}

const HARI_ID = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const BULAN_ID = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

/** "Senin, 08 Jun 2026" — tanggal utuh, bukan nomor tanpa konteks. */
function tanggalPanjang(periode: string, tanggal: number): string {
  const [th, bl] = periode.split("-").map(Number);
  const d = new Date(Date.UTC(th, bl - 1, tanggal));
  return `${HARI_ID[d.getUTCDay()]}, ${String(tanggal).padStart(2, "0")} ${BULAN_ID[bl - 1]} ${th}`;
}

function TipHarian({
  active,
  payload,
  label,
  periode,
  akhirPekan,
}: {
  active?: boolean;
  payload?: { payload: HariOmzet & { target: number } }[];
  label?: number;
  periode?: string;
  akhirPekan?: (t: number) => boolean;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const tgl = Number(label);
  const merah = akhirPekan?.(tgl) ?? false;
  const tembus = d.ini !== null && d.target > 0 && d.ini >= d.target;
  const selisih = d.ini === null ? 0 : d.ini - d.target;
  const baris: [string, string, number | null][] = [
    ["Bulan ini", BLUE, d.ini],
    ["Bulan lalu", "#94a3b8", d.lalu],
    ["Target/hari", "#f59e0b", d.target],
  ];
  return (
    <div className="min-w-[13.5rem] rounded-xl border border-border bg-card px-3 py-2.5 text-[11.5px] shadow-lg">
      {/* Tanggal ditulis utuh dengan nama harinya. "Tanggal 5" menuntut
          pembacanya menghitung sendiri hari apa itu, padahal justru hari apa
          yang menjelaskan kenapa angkanya tinggi atau rendah. Akhir pekan
          cukup ditandai dengan warna — menuliskannya lagi mengulang hal yang
          sudah terbaca dari nama harinya. */}
      <p className={cn("mb-1.5 font-semibold", merah ? "text-rose-500" : "text-foreground")}>
        {periode ? tanggalPanjang(periode, tgl) : `Tanggal ${tgl}`}
      </p>
      {baris.map(([nama, warna, nilai]) => (
        <p key={nama} className="flex items-center gap-1.5 text-muted-foreground">
          <span className="size-2 shrink-0 rounded-full" style={{ background: warna }} />
          {nama}: <span className="ml-auto font-medium tabular-nums text-foreground">{nilai === null ? "—" : formatIDR(nilai)}</span>
        </p>
      ))}
      {d.ini !== null && d.target > 0 && (
        // Statusnya berbentuk lencana, bukan kalimat: kalimat di ujung tooltip
        // terbaca sebagai catatan tambahan, sedangkan inilah kesimpulannya.
        <p
          className={cn(
            "mt-2 flex items-center justify-between gap-2 rounded-lg px-2 py-1 font-medium",
            tembus
              ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400"
              : "bg-rose-500/12 text-rose-600 dark:text-rose-400",
          )}
        >
          <span className="inline-flex items-center gap-1.5">
            {tembus ? <Check className="size-3.5" /> : <X className="size-3.5" />}
            {tembus ? "Tembus target" : "Di bawah target"}
          </span>
          <span className="tabular-nums">
            {tembus ? "+" : "−"}
            {formatIDR(Math.abs(selisih)).replace("Rp ", "")}
          </span>
        </p>
      )}
    </div>
  );
}

/**
 * Titik hari yang tembus target — BERDENYUT seperti radar.
 *
 * Titik diam berwarna lain sudah terbaca, tapi baru setelah mata menyapu
 * seluruh grafik. Denyutnya menarik mata lebih dulu ke hari yang berhasil,
 * dan itulah yang dicari orang saat membuka grafik ini. Denyutnya dibuat
 * dengan SMIL di dalam SVG-nya sendiri, bukan CSS: grafiknya dirender ulang
 * tiap kali datanya berubah, dan animasi CSS akan ikut mulai dari awal setiap
 * kali sampai terlihat berkedip.
 */
function TitikHarian({ cx, cy, payload }: { cx?: number; cy?: number; payload?: HariOmzet & { target: number } }) {
  if (cx === undefined || cy === undefined || !payload || payload.ini === null) return null;
  const tembus = payload.target > 0 && payload.ini >= payload.target;
  if (!tembus) return <circle cx={cx} cy={cy} r={1.8} fill={BLUE} />;
  // Fasenya digeser per tanggal supaya seluruh titik tidak berdenyut serentak
  // — yang serentak terbaca sebagai kedipan layar, bukan penanda.
  const geser = `-${(payload.tanggal % 5) * 0.4}s`;
  return (
    <g>
      <circle cx={cx} cy={cy} r={3} fill="#10b981" fillOpacity={0.35}>
        <animate attributeName="r" values="3;11;3" dur="2s" begin={geser} repeatCount="indefinite" />
        <animate attributeName="fill-opacity" values="0.35;0;0.35" dur="2s" begin={geser} repeatCount="indefinite" />
      </circle>
      <circle cx={cx} cy={cy} r={3.2} fill="#10b981" stroke="#fff" strokeWidth={1.2} />
    </g>
  );
}

/**
 * Omzet per tanggal — bulan berjalan, bulan lalu, dan garis target harian.
 *
 * Grafik bulanan hanya menjawab "sudah berapa"; yang ini menjawab "masih
 * sempat atau tidak". Garis targetnya rata — target bulan dibagi jumlah hari —
 * dan justru keratanya yang berguna: hari-hari di bawah garis terlihat
 * langsung, dan jarak yang harus dikejar sisa bulan bisa dikira-kira dengan
 * mata.
 *
 * Hari yang tembus target ditandai TITIK HIJAU, bukan tulisan. Tiga puluh
 * keterangan di atas satu grafik menutupi grafiknya sendiri; satu titik yang
 * berbeda warna terbaca sekali lihat dan tetap terbaca saat dicetak.
 *
 * Sabtu dan Minggu ditulis merah dan diberi latar tipis. Penjualan F&B punya
 * irama mingguan yang kuat — tanpa penanda itu, jatuhnya hari Senin terbaca
 * sebagai masalah padahal memang begitu bentuk minggunya.
 */
export function GrafikHarian({
  judul,
  periode,
  hari,
  targetBulan,
}: {
  judul: string;
  /** "YYYY-MM" — dipakai menentukan hari apa tiap tanggalnya. */
  periode: string;
  hari: HariOmzet[];
  /** Target sebulan; dibagi rata jadi garis target harian. */
  targetBulan: number | null;
}) {
  const target = targetBulan === null || hari.length === 0 ? 0 : targetBulan / hari.length;
  const data = React.useMemo(() => hari.map((h) => ({ ...h, target })), [hari, target]);
  const adaIsi = data.some((d) => d.ini !== null || d.lalu !== null);

  const [th, bl] = periode.split("-").map(Number);
  const akhirPekan = React.useCallback(
    (tanggal: number) => {
      const h = new Date(Date.UTC(th, bl - 1, tanggal)).getUTCDay();
      return h === 0 || h === 6;
    },
    [th, bl],
  );

  const terisi = data.filter((d) => d.ini !== null);
  const totalIni = terisi.reduce((s, d) => s + (d.ini ?? 0), 0);
  const totalLalu = data.reduce((s, d) => s + (d.lalu ?? 0), 0);
  const tembus = terisi.filter((d) => target > 0 && (d.ini ?? 0) >= target).length;

  return (
    <Kartu
      title={judul}
      aksi={
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ background: BLUE }} /> Bulan ini {ringkas(totalIni, "rupiah")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-slate-400" /> Bulan lalu {ringkas(totalLalu, "rupiah")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-emerald-500" /> Tembus {tembus}/{terisi.length} hari
          </span>
        </div>
      }
    >
      <div className="min-h-[16rem] flex-1" style={{ outline: "none" }}>
        {!adaIsi ? (
          <div className="grid h-full min-h-[16rem] place-items-center text-[12px] text-muted-foreground">
            Belum ada penjualan harian pada bulan ini.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 10, right: 6, left: 0, bottom: 0 }} accessibilityLayer={false}>
              <defs>
                <linearGradient id="hariBlue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={BLUE} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={BLUE} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.16)" vertical={false} />
              <XAxis
                dataKey="tanggal"
                scale="point"
                padding={{ left: 12, right: 12 }}
                tickLine={false}
                axisLine={false}
                interval={0}
                tick={(props: { x?: string | number; y?: string | number; payload?: { value?: number } }) => {
                  const { x, y, payload } = props;
                  const t = Number(payload?.value ?? 0);
                  return (
                    <text
                      x={Number(x ?? 0)}
                      y={Number(y ?? 0) + 12}
                      textAnchor="middle"
                      fontSize={9.5}
                      fontWeight={akhirPekan(t) ? 700 : 400}
                      fill={akhirPekan(t) ? "#e11d48" : "rgb(100,116,139)"}
                    >
                      {t}
                    </text>
                  );
                }}
              />
              <YAxis
                width={54}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 10.5, fill: "rgb(100,116,139)" }}
                tickFormatter={(v: number) => ringkas(v, "rupiah")}
              />
              <Tooltip content={<TipHarian periode={periode} akhirPekan={akhirPekan} />} cursor={{ stroke: "rgba(148,163,184,0.35)" }} />
              <Line type="linear" dataKey="target" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="6 5" dot={false} isAnimationActive={false} />
              <Line type="linear" dataKey="lalu" stroke="#94a3b8" strokeWidth={1.5} dot={false} connectNulls isAnimationActive={false} />
              <Area type="linear" dataKey="ini" stroke="none" fill="url(#hariBlue)" isAnimationActive={false} />
              <Line type="linear" dataKey="ini" stroke={BLUE} strokeWidth={2} dot={<TitikHarian />} connectNulls isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </Kartu>
  );
}


/**
 * Omzet MINGGU DEMI MINGGU — pendamping grafik harian di tab Detail Mingguan.
 *
 * KENAPA MINGGUAN, BUKAN HARIAN, di Coordinator Area. Angka harian yang ada
 * hanya milik SELURUH perusahaan; ia tidak bisa dipisah per outlet, jadi tidak
 * bisa dipersempit ke satu area. Yang bisa dipersempit adalah angka mingguan
 * per cabang, dan itu pula yang dipakai tabel di bawahnya — grafik dan tabel
 * membaca sumber yang sama, sehingga tidak mungkin bercerita berbeda.
 *
 * Batang, bukan garis: minggu itu satuan yang berdiri sendiri, dan lima titik
 * yang dihubungkan garis mengesankan perubahan mulus di antara minggu padahal
 * tidak ada yang terjadi "di antara" dua minggu.
 */
export function GrafikMingguan({
  judul,
  minggu,
  baris,
}: {
  judul: string;
  minggu: RentangMinggu[];
  /** Baris gabungan seluruh outlet yang terukur; targetnya sudah dihitung. */
  baris: BarisMinggu;
}) {
  const data = React.useMemo(
    () =>
      minggu.map((m, i) => ({
        minggu: m.minggu,
        label: `M${m.minggu}`,
        rentang: `${m.dari}–${m.sampai}`,
        ini: baris.actual[i],
        target: baris.target[i],
        // Minggu yang belum penuh ditandai supaya batangnya yang pendek tidak
        // terbaca sebagai minggu yang buruk.
        penuh: baris.hariAda[i] >= m.hari,
        hariAda: baris.hariAda[i],
        hariMinggu: m.hari,
      })),
    [minggu, baris],
  );
  const adaIsi = data.some((d) => d.ini !== null);
  const tembus = data.filter((d) => d.ini !== null && d.target > 0 && (d.ini ?? 0) >= d.target).length;
  const terisi = data.filter((d) => d.ini !== null).length;

  return (
    <Kartu
      title={judul}
      aksi={
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ background: BLUE }} /> Terkumpul {ringkas(baris.terkumpul, "rupiah")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-amber-500" /> Target {ringkas(baris.targetBulan, "rupiah")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-emerald-500" /> Tembus {tembus}/{terisi} minggu
          </span>
        </div>
      }
    >
      <div className="min-h-[16rem] flex-1" style={{ outline: "none" }}>
        {!adaIsi ? (
          <div className="grid h-full min-h-[16rem] place-items-center text-[12px] text-muted-foreground">
            Rincian mingguan bulan ini belum ditarik dari ESB.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 10, right: 6, left: 0, bottom: 0 }} accessibilityLayer={false}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.16)" vertical={false} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                interval={0}
                tick={{ fontSize: 11, fill: "rgb(100,116,139)" }}
              />
              <YAxis
                width={54}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 10.5, fill: "rgb(100,116,139)" }}
                tickFormatter={(v: number) => ringkas(v, "rupiah")}
              />
              <Tooltip content={<TipMinggu />} cursor={{ fill: "rgba(148,163,184,0.12)" }} />
              <Bar dataKey="ini" radius={[6, 6, 0, 0]} maxBarSize={54} isAnimationActive={false}>
                {data.map((d) => (
                  <Cell
                    key={d.minggu}
                    // BAHASA WARNA YANG SAMA dengan grafik harian: biru itu
                    // keadaan biasa, hijau menandai yang menembus target, dan
                    // yang di bawah target TIDAK dimerahkan. Minggu 94% yang
                    // digambar merah menyamakan yang nyaris berhasil dengan
                    // yang gagal telak, dan warna yang hampir selalu merah
                    // berhenti dibaca. Yang belum penuh dibuat pudar — ia belum
                    // selesai, bukan belum tercapai.
                    fill={!d.penuh ? "rgba(59,130,246,0.42)" : d.target > 0 && (d.ini ?? 0) >= d.target ? "#10b981" : BLUE}
                  />
                ))}
              </Bar>
              <Line type="linear" dataKey="target" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="6 5" dot={false} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </Kartu>
  );
}

interface TitikMinggu {
  label: string;
  rentang: string;
  ini: number | null;
  target: number;
  penuh: boolean;
  hariAda: number;
  hariMinggu: number;
}

function TipMinggu({ active, payload }: { active?: boolean; payload?: { payload: TitikMinggu }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const ini = d.ini ?? 0;
  const beda = ini - d.target;
  const tembus = d.target > 0 && ini >= d.target;
  return (
    <div className="rounded-xl border border-border bg-card/95 px-3 py-2 text-[11.5px] shadow-lg backdrop-blur">
      <div className="mb-1 font-semibold text-foreground">
        Minggu {d.label.slice(1)} · tanggal {d.rentang}
      </div>
      <div className="tabular-nums text-muted-foreground">
        Omzet <b className="text-foreground">{formatIDR(ini)}</b>
      </div>
      <div className="tabular-nums text-muted-foreground">Target {formatIDR(Math.round(d.target))}</div>
      {!d.penuh && (
        <div className="mt-1 text-[11px] text-muted-foreground">
          Baru {d.hariAda} dari {d.hariMinggu} hari — belum selesai.
        </div>
      )}
      {d.penuh && (
        <div className={cn("mt-1 text-[11px] font-medium", tembus ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
          {tembus ? "Tembus target" : "Di bawah target"} {formatIDR(Math.abs(Math.round(beda)))}
        </div>
      )}
    </div>
  );
}

export function KpiIndicatorDonut({ baris }: { baris: BarisKpi[] }) {
  const [mode, setMode] = React.useState<Mode>("hasil");
  const [aktif, setAktif] = React.useState<string | null>(null);

  const semua = React.useMemo(
    () =>
      baris
        .map((b, i) => ({
          key: b.key,
          label: b.label,
          value: mode === "bobot" ? b.bobot : (b.persenActual ?? 0),
          color: COLORS[i % COLORS.length],
        }))
        .sort((a, b) => b.value - a.value),
    [baris, mode],
  );

  const irisan = React.useMemo(() => semua.filter((s) => s.value > 0), [semua]);
  const total = irisan.reduce((a, s) => a + s.value, 0);
  const warna = React.useCallback((key: string) => semua.find((s) => s.key === key)?.color ?? "#94a3b8", [semua]);

  // TANPA kursor, yang tampil di tengah adalah TOTALNYA — itulah angka yang
  // dicari orang pertama kali. Sebelumnya irisan pertama dipilih diam-diam,
  // jadi yang terbaca di tengah lingkaran adalah bagian satu indikator sambil
  // terlihat seperti angka keseluruhan.
  const terpilih = semua.find((s) => s.key === aktif) ?? null;
  const persenAktif = terpilih ? terpilih.value : total;

  const busur = React.useMemo(() => {
    // Panjang tiap busur dihitung dulu, lalu posisinya dari jumlah busur
    // sebelumnya. Menumpuknya lewat variabel yang diubah di dalam map memang
    // lebih pendek, tapi itu mengubah nilai di luar map — dan compiler React
    // menandainya sebagai sumber hasil yang tidak konsisten antar-render.
    const panjang = irisan.map((s) => (total ? (s.value / total) * CIRC : 0));
    return irisan.map((s, i) => ({
      key: s.key,
      color: s.color,
      len: panjang[i],
      rot: -90 + (panjang.slice(0, i).reduce((a, b) => a + b, 0) / CIRC) * 360,
    }));
  }, [irisan, total]);

  return (
    <div className="flex flex-col rounded-2xl border border-border bg-card/40 p-5">
      <div className="mb-3 flex flex-col gap-3">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-foreground">Sebaran {MODE_TITLE[mode]} per Indikator</h3>
        </div>
        <div className="grid w-full grid-cols-2 gap-1 rounded-xl border border-border bg-muted/50 p-1">
          {MODES.map((m) => {
            const on = mode === m.id;
            const Icon = m.icon;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setMode(m.id);
                  setAktif(null);
                }}
                aria-pressed={on}
                className={cn(
                  "inline-flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium transition-colors",
                  on ? "bg-background text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-3.5 shrink-0" />
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      {total === 0 ? (
        <div className="grid flex-1 place-items-center rounded-xl border border-dashed border-border bg-muted/20 py-12 text-center text-xs text-muted-foreground">
          Belum ada capaian yang bisa dipetakan bulan ini.
        </div>
      ) : (
        <>
          <div className="flex flex-1 items-center gap-4 py-2">
            <div className="relative h-44 w-44 shrink-0">
              <svg viewBox="0 0 176 176" className="h-full w-full">
                {busur.map((a) => (
                  <circle
                    key={a.key}
                    cx={88}
                    cy={88}
                    r={R}
                    fill="none"
                    stroke={a.color}
                    strokeWidth={STROKE}
                    strokeLinecap="round"
                    strokeDasharray={`${a.len} ${CIRC - a.len}`}
                    transform={`rotate(${a.rot} 88 88)`}
                    className="cursor-pointer transition-opacity"
                    style={{ opacity: !terpilih || a.key === terpilih.key ? 1 : 0.55 }}
                    onMouseEnter={() => setAktif(a.key)}
                    onMouseLeave={() => setAktif(null)}
                    onClick={() => setAktif(a.key)}
                  />
                ))}
              </svg>
              {/* Angkanya DIBULATKAN. Di dalam lingkaran selebar 44px, "28,50%"
                  harus diperkecil sampai hampir tidak terbaca demi dua digit di
                  belakang koma yang tidak mengubah satu keputusan pun — angka
                  penuhnya tetap ada di baris Total Skor di bawah kartunya. */}
              <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                <p
                  className="text-[2.1rem] font-extrabold leading-none tracking-tight"
                  style={{ color: terpilih ? warna(terpilih.key) : "var(--foreground)" }}
                >
                  {Math.round(persenAktif)}%
                </p>
              </div>
            </div>

            <ul className="min-w-0 flex-1 space-y-2">
              {semua.map((s) => (
                <li
                  key={s.key}
                  onMouseEnter={() => setAktif(s.key)}
                  onMouseLeave={() => setAktif(null)}
                  onClick={() => setAktif(s.key)}
                  className="flex min-w-0 cursor-pointer items-center gap-2 text-xs"
                >
                  <span className="size-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
                  {/* Dipotong, bukan turun baris: nama indikator bisa sangat
                      panjang dan akan menggeser lebar kartunya. */}
                  <span
                    title={s.label}
                    className={cn("min-w-0 flex-1 truncate", terpilih && s.key === terpilih.key ? "font-medium text-foreground" : "text-foreground/85")}
                  >
                    {s.label}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex items-center justify-between border-t border-border/60 pt-4">
            <span className="text-xs text-muted-foreground">{mode === "bobot" ? "Total Bobot" : "Total Skor"}</span>
            <div className="flex items-center gap-2">
              <div className="flex -space-x-1.5">
                {irisan.slice(0, 5).map((s) => (
                  <span key={s.key} className="size-4 rounded-full ring-2 ring-card" style={{ background: s.color }} />
                ))}
              </div>
              <span className="text-sm font-semibold tabular-nums text-foreground">
                {total.toLocaleString("id-ID", { maximumFractionDigits: 2 })}%
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
