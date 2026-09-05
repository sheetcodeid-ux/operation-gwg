"use client";

import * as React from "react";
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartPie, Hash, Layers, Percent } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BarisKpi } from "@/lib/kpi/hitung";
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
  jumlah,
}: {
  x?: number;
  y?: number;
  payload?: { value: string };
  index?: number;
  muat: number;
  jumlah: number;
}) {
  const teks = payload?.value ?? "";
  const potong = teks.length > muat ? `${teks.slice(0, Math.max(1, muat - 1)).trimEnd()}…` : teks;
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
export function KpiPerformanceChart({
  baris,
  lalu,
}: {
  baris: BarisKpi[];
  /** Capaian bulan lalu per kunci indikator. */
  lalu: Record<string, LaluIndikator>;
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
      baris.map((b) => ({
        name: b.label,
        full: b.label,
        ini: b.persentase === null ? 0 : Math.round(b.persentase),
        lalu: lalu[b.key]?.persen == null ? 0 : Math.round(lalu[b.key].persen!),
        target: 100,
        satuan: b.satuan,
        nIni: b.actual,
        nLalu: lalu[b.key]?.actual ?? null,
        nTarget: b.target,
      })),
    [baris, lalu],
  );
  const adaIsi = data.some((d) => d.ini > 0 || d.lalu > 0);

  // ~5,6 px per huruf pada 10,5px tebal, dikurangi jarak antar-label. Lebar
  // sumbu Y (44) dan sisipan kiri-kanan (20) dikeluarkan lebih dulu.
  const muat = Math.max(6, Math.floor(((lebar - 64) / Math.max(1, data.length) - 12) / 5.6));

  return (
    <Kartu
      title="Capaian per Indikator"
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
      <div ref={kotak} className="min-h-[17rem] flex-1" style={{ outline: "none" }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: sumbu === "angka" ? 22 : 10, right: 14, left: 0, bottom: 0 }} accessibilityLayer={false}>
            <defs>
              <linearGradient id="kpiBlue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={BLUE} stopOpacity={0.35} />
                <stop offset="100%" stopColor={BLUE} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.16)" vertical={false} />
            <XAxis
              dataKey="name"
              tick={<LabelSumbu muat={muat} jumlah={data.length} />}
              tickLine={false}
              axisLine={false}
              interval={0}
              height={26}
              padding={{ left: 10, right: 10 }}
            />
            <YAxis
              domain={[0, 110]}
              ticks={[0, 25, 50, 75, 100]}
              tick={{ fill: "var(--foreground)", fontSize: 11, fontWeight: 600 }}
              tickLine={false}
              axisLine={false}
              width={44}
              tickFormatter={(v: number) => `${v}%`}
            />
            <Tooltip cursor={{ stroke: "rgba(148,163,184,0.35)", strokeWidth: 1 }} content={<Tip sumbu={sumbu} />} />
            <Line
              type="linear"
              dataKey="lalu"
              name="Bulan Lalu"
              stroke={ABU}
              strokeWidth={2}
              dot={{ r: 2.5, fill: ABU, strokeWidth: 0 }}
              activeDot={{ r: 4.5 }}
              isAnimationActive={false}
            />
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

  const terpilih = semua.find((s) => s.key === aktif) ?? irisan[0] ?? semua[0];
  const persenAktif = total && terpilih ? Math.round((terpilih.value / total) * 100) : 0;

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
                    style={{ opacity: terpilih && a.key === terpilih.key ? 1 : 0.9 }}
                    onMouseEnter={() => setAktif(a.key)}
                    onMouseLeave={() => setAktif(null)}
                    onClick={() => setAktif(a.key)}
                  />
                ))}
              </svg>
              <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                <p className="text-[2rem] font-extrabold leading-none tracking-tight" style={{ color: warna(terpilih.key) }}>
                  {persenAktif}%
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
