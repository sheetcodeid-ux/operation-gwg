"use client";

import * as React from "react";
import { Area, Bar, CartesianGrid, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartPie, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BarisKpi } from "@/lib/kpi/hitung";

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
const COLORS = ["#3b82f6", "#f59e0b", "#06b6d4", "#8b5cf6", "#10b981", "#f43f5e", "#64748b", "#eab308"];

function Kartu({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col rounded-2xl border border-border bg-card/40 p-5">
      <div className="mb-3">
        <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
        <p className="text-[11px] text-muted-foreground">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

/**
 * Singkatan untuk sumbu X — cara yang sama dipakai Work Tracker untuk nama
 * karyawan, tapi WAJIB unik di sini.
 *
 * Tiga huruf dari kata pertama menghasilkan "KON, KON, KON" untuk Jumlah Konten
 * Post, Reels, dan Story — sumbu yang tiga batangnya bernama sama tidak bisa
 * dibaca sama sekali. Maka kata pembuka yang dipakai bersama-sama dilewati
 * lebih dulu, dan kalau masih kembar, huruf berikutnya ditambahkan sampai
 * masing-masing berdiri sendiri.
 */
const LEWATI = new Set(["jumlah", "total", "input", "pemeriksaan", "penyampaian", "invoice", "kualitas", "kelengkapan"]);

function kataPenting(label: string): string[] {
  const kata = (label || "")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 1 && !LEWATI.has(w.toLowerCase()));
  return kata.length > 0 ? kata : [(label || "?").trim() || "?"];
}

/** Satu singkatan per label, dijamin tidak ada yang kembar. */
export function singkatUnik(labels: string[]): string[] {
  const hasil = labels.map((l) => {
    const kata = kataPenting(l);
    return { kata, kode: kata[0].slice(0, 3).toUpperCase() };
  });

  // Selama masih ada yang kembar, yang kembar diperpanjang — satu huruf dari
  // katanya sendiri, lalu huruf pertama kata berikutnya.
  for (let putaran = 0; putaran < 6; putaran += 1) {
    const hitung = new Map<string, number>();
    for (const h of hasil) hitung.set(h.kode, (hitung.get(h.kode) ?? 0) + 1);
    if ([...hitung.values()].every((n) => n === 1)) break;
    for (const h of hasil) {
      if ((hitung.get(h.kode) ?? 0) < 2) continue;
      const utama = h.kata[0].toUpperCase();
      const panjang = Math.min(utama.length, h.kode.replace(/[^A-Z0-9]/g, "").length + 1);
      h.kode = panjang <= utama.length && panjang > h.kode.length
        ? utama.slice(0, panjang)
        : `${utama.slice(0, 3)}·${h.kata.slice(1).map((k) => k[0].toUpperCase()).join("").slice(0, 2) || "X"}`;
    }
  }
  return hasil.map((h) => h.kode);
}

type Titik = { name: string; full: string; ini: number; lalu: number };

function Tip({ active, payload }: { active?: boolean; payload?: { payload: Titik }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-xl border border-border bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-medium text-foreground">{d.full}</p>
      <p className="flex items-center gap-2 text-muted-foreground">
        <span className="size-2 rounded-full" style={{ background: BLUE }} /> Bulan ini
        <span className="ml-auto font-semibold text-foreground">{d.ini}%</span>
      </p>
      <p className="flex items-center gap-2 text-muted-foreground">
        <span className="size-2 rounded-full bg-slate-400" /> Bulan lalu
        <span className="ml-auto font-semibold text-foreground">{d.lalu}%</span>
      </p>
    </div>
  );
}

/**
 * Capaian tiap indikator, bulan ini dibanding bulan lalu.
 *
 * Sumbunya persen, bukan angka mentah — indikator yang satu dihitung dalam
 * lembar konten dan yang lain dalam puluhan ribu tayangan, jadi menaruh
 * keduanya pada satu sumbu angka akan membuat yang kecil tidak terlihat sama
 * sekali. Persen membuat keduanya bisa berdiri berdampingan.
 */
export function KpiPerformanceChart({
  baris,
  lalu,
  subtitle,
}: {
  baris: BarisKpi[];
  /** Capaian bulan lalu per kunci indikator. */
  lalu: Record<string, number | null>;
  subtitle: string;
}) {
  const data = React.useMemo<Titik[]>(() => {
    const kode = singkatUnik(baris.map((b) => b.label));
    return baris.map((b, i) => ({
      name: kode[i],
      full: b.label,
      ini: b.persentase === null ? 0 : Math.round(b.persentase),
      lalu: lalu[b.key] == null ? 0 : Math.round(lalu[b.key]!),
    }));
  }, [baris, lalu]);
  const adaIsi = data.some((d) => d.ini > 0 || d.lalu > 0);

  return (
    <Kartu title="Capaian per Indikator" subtitle={subtitle}>
      <div className="min-h-[17rem] flex-1" style={{ outline: "none" }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} accessibilityLayer={false}>
            <defs>
              <linearGradient id="kpiBlue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={BLUE} stopOpacity={0.35} />
                <stop offset="100%" stopColor={BLUE} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="kpiGrey" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#94a3b8" stopOpacity={0.9} />
                <stop offset="100%" stopColor="#94a3b8" stopOpacity={0.35} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.16)" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fill: "var(--foreground)", fontSize: 10, fontWeight: 600 }}
              tickLine={false}
              axisLine={false}
              interval={0}
              height={22}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fill: "var(--foreground)", fontSize: 11, fontWeight: 600 }}
              tickLine={false}
              axisLine={false}
              width={44}
              tickFormatter={(v: number) => `${v}%`}
            />
            <Tooltip cursor={{ fill: "rgba(148,163,184,0.08)" }} content={<Tip />} />
            <Bar dataKey="lalu" name="Bulan Lalu" fill="url(#kpiGrey)" radius={[3, 3, 0, 0]} maxBarSize={34} />
            <Area
              type="monotone"
              dataKey="ini"
              name="Bulan Ini"
              stroke={BLUE}
              strokeWidth={2.5}
              fill="url(#kpiBlue)"
              dot={{ r: 3, fill: BLUE }}
              activeDot={{ r: 5 }}
              className="chart-glow-blue"
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
  { id: "hasil", label: "% Actual", icon: ChartPie },
  { id: "bobot", label: "Bobot", icon: Layers },
] as const;
const MODE_TITLE: Record<Mode, string> = { hasil: "% Actual", bobot: "Bobot" };

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
export function KpiIndicatorDonut({ baris, subtitle }: { baris: BarisKpi[]; subtitle: string }) {
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
          <p className="text-[11px] text-muted-foreground">{subtitle}</p>
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
