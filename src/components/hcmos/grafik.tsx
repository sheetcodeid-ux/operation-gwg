"use client";

import * as React from "react";
import { Area, Bar, CartesianGrid, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { labelSumbu, singkat, singkatPeriode } from "@/lib/hcmos/singkat";

/**
 * Grafik HC-MOS — mengikuti gaya grafik Work Tracker.
 *
 * Dua bentuk saja, sama seperti di sana:
 *
 *  • Donat: cincin SVG dengan ANGKA PERSEN saja di tengah, keterangan di
 *    sampingnya berisi nama tanpa angka, dan total di kaki kartunya. Angka di
 *    tengah mengikuti bagian yang sedang disentuh.
 *  • Batang: batang abu-abu bergradasi, bukan warna-warni. Warna dipakai untuk
 *    MEMBEDAKAN, dan pada grafik yang semua batangnya mengukur hal yang sama,
 *    tidak ada yang perlu dibedakan — warna berbeda di tiap batang justru
 *    menyiratkan makna yang tidak ada.
 *
 * Label sumbu disingkat tiga huruf ("Supervisor" → SPV) karena nama departemen
 * di GWG panjang dan saling menimpa bila ditulis utuh. Nama utuhnya tetap
 * muncul di tooltip.
 */

const BIRU = "#3b82f6";
const HIJAU = "#10b981";
const R = 66;
const STROKE = 22;
const CIRC = 2 * Math.PI * R;

/** Palet slice donat — sama dengan Work Tracker supaya dua modul terasa satu. */
const WARNA = ["#3b82f6", "#f59e0b", "#06b6d4", "#8b5cf6", "#10b981", "#f43f5e", "#64748b", "#eab308"];

export interface TitikData {
  nama: string;
  nilai: number;
}

function Bingkai({
  judul,
  subjudul,
  children,
}: {
  judul: string;
  subjudul?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle>{judul}</CardTitle>
        {subjudul && <p className="text-[11px] text-muted-foreground">{subjudul}</p>}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">{children}</CardContent>
    </Card>
  );
}

function Kosong({ judul, subjudul, pesan }: { judul: string; subjudul?: string; pesan: string }) {
  return (
    <Bingkai judul={judul} subjudul={subjudul}>
      <div className="grid flex-1 place-items-center rounded-xl border border-dashed border-border bg-muted/20 py-12 text-center text-xs text-muted-foreground">
        {pesan}
      </div>
    </Bingkai>
  );
}

/* ─────────────────────────────── batang ─────────────────────────────── */

interface BarisBatang {
  nama: string;
  penuh: string;
  nilai: number;
}

function TipBatang({
  active,
  payload,
  satuan,
}: {
  active?: boolean;
  payload?: readonly { payload?: BarisBatang }[];
  satuan?: string;
}) {
  const d = payload?.[0]?.payload;
  if (!active || !d) return null;
  return (
    <div className="rounded-xl border border-border bg-popover px-3 py-2 text-xs shadow-lg">
      {/* Nama utuh, bukan singkatannya — singkatan hanya untuk sumbu. */}
      <p className="mb-1 font-medium text-foreground">{d.penuh}</p>
      <p className="flex items-center gap-2 text-muted-foreground">
        <span className="size-2 rounded-full bg-slate-400" /> Jumlah
        <span className="ml-auto font-semibold text-foreground">
          {d.nilai}
          {satuan ?? ""}
        </span>
      </p>
    </div>
  );
}

export function GrafikBatang({
  judul,
  subjudul,
  data,
  satuan,
  /** Sumbu berisi periode (2026-08 / Agustus 2026) — disingkat jadi nama bulan. */
  periode = false,
  /**
   * Label ditulis utuh, tanpa disingkat.
   *
   * Dipakai bila isinya kalimat bebas, bukan nama departemen. Singkatan huruf
   * awal masuk akal untuk "Product Development & Quality" → PDQ karena orang
   * memang menyebutnya begitu; untuk "Dapat penawaran di luar" → DPL tidak ada
   * yang mengenalinya, dan sumbunya berubah jadi teka-teki.
   */
  labelPenuh = false,
  pesanKosong = "Belum ada datanya.",
}: {
  judul: string;
  subjudul?: string;
  data: TitikData[];
  satuan?: string;
  periode?: boolean;
  labelPenuh?: boolean;
  pesanKosong?: string;
}) {
  const baris = React.useMemo<BarisBatang[]>(() => {
    const label = labelSumbu(
      data.map((d) => d.nama),
      labelPenuh ? (x) => x.trim() || "—" : periode ? singkatPeriode : singkat,
    );
    return data.map((d, i) => ({ nama: label[i], penuh: d.nama, nilai: d.nilai }));
  }, [data, periode, labelPenuh]);
  if (baris.length === 0) return <Kosong judul={judul} subjudul={subjudul} pesan={pesanKosong} />;

  return (
    <Bingkai judul={judul} subjudul={subjudul}>
      {/* Dua lapis, dan keduanya perlu.
          ResponsiveContainer memakai height="100%", sedangkan persen hanya bisa
          dihitung terhadap tinggi induk yang PASTI. Lapis luar memberi tinggi
          itu lewat min-height (dan tetap boleh memanjang lewat flex-1 saat
          kartunya berada di dalam grid); lapis dalam yang absolut mengambil
          tinggi terpakai induknya, berapa pun hasilnya.

          Tanpa lapis dalam, `flex-1` membuat flex-basis 0 dan grafik yang tidak
          kebetulan berada di dalam grid dihitung setinggi NOL — kartunya tampil
          kosong tanpa satu pun galat di konsol. */}
      <div className="relative min-h-[15rem] flex-1" style={{ outline: "none" }}>
        <div className="absolute inset-0">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={baris} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} accessibilityLayer={false}>
            <defs>
              <linearGradient id="hcGrey" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#94a3b8" stopOpacity={0.9} />
                <stop offset="100%" stopColor="#94a3b8" stopOpacity={0.35} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.16)" vertical={false} />
            <XAxis
              dataKey="nama"
              tick={{ fill: "var(--foreground)", fontSize: 10, fontWeight: 600 }}
              tickLine={false}
              axisLine={false}
              interval={0}
              height={22}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: "var(--foreground)", fontSize: 11, fontWeight: 600 }}
              tickLine={false}
              axisLine={false}
              width={34}
            />
            <Tooltip
              cursor={{ fill: "rgba(148,163,184,0.08)" }}
              content={(p) => <TipBatang {...(p as unknown as { active?: boolean; payload?: readonly { payload?: BarisBatang }[] })} satuan={satuan} />}
            />
            <Bar dataKey="nilai" name="Jumlah" fill="url(#hcGrey)" radius={[3, 3, 0, 0]} maxBarSize={34} />
          </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Bingkai>
  );
}

/* ──────────────────────────────── tren ──────────────────────────────── */

export function GrafikGaris({
  judul,
  subjudul,
  data,
  satuan,
  pesanKosong = "Belum ada datanya.",
}: {
  judul: string;
  subjudul?: string;
  data: TitikData[];
  satuan?: string;
  pesanKosong?: string;
}) {
  const baris = React.useMemo<BarisBatang[]>(() => {
    const label = labelSumbu(
      data.map((d) => d.nama),
      singkatPeriode,
    );
    return data.map((d, i) => ({ nama: label[i], penuh: d.nama, nilai: d.nilai }));
  }, [data]);
  if (baris.length === 0) return <Kosong judul={judul} subjudul={subjudul} pesan={pesanKosong} />;

  return (
    <Bingkai judul={judul} subjudul={subjudul}>
      {/* Dua lapis, dan keduanya perlu.
          ResponsiveContainer memakai height="100%", sedangkan persen hanya bisa
          dihitung terhadap tinggi induk yang PASTI. Lapis luar memberi tinggi
          itu lewat min-height (dan tetap boleh memanjang lewat flex-1 saat
          kartunya berada di dalam grid); lapis dalam yang absolut mengambil
          tinggi terpakai induknya, berapa pun hasilnya.

          Tanpa lapis dalam, `flex-1` membuat flex-basis 0 dan grafik yang tidak
          kebetulan berada di dalam grid dihitung setinggi NOL — kartunya tampil
          kosong tanpa satu pun galat di konsol. */}
      <div className="relative min-h-[15rem] flex-1" style={{ outline: "none" }}>
        <div className="absolute inset-0">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={baris} margin={{ top: 8, right: 28, left: 0, bottom: 0 }} accessibilityLayer={false}>
            <defs>
              <linearGradient id="hcBlue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={BIRU} stopOpacity={0.35} />
                <stop offset="100%" stopColor={BIRU} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.16)" vertical={false} />
            <XAxis
              dataKey="nama"
              tick={{ fill: "var(--foreground)", fontSize: 10, fontWeight: 600 }}
              tickLine={false}
              axisLine={false}
              interval={0}
              height={22}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: "var(--foreground)", fontSize: 11, fontWeight: 600 }}
              tickLine={false}
              axisLine={false}
              width={34}
            />
            <Tooltip
              content={(p) => <TipBatang {...(p as unknown as { active?: boolean; payload?: readonly { payload?: BarisBatang }[] })} satuan={satuan} />}
            />
            <Area
              type="monotone"
              dataKey="nilai"
              name="Jumlah"
              stroke={BIRU}
              strokeWidth={2.5}
              fill="url(#hcBlue)"
              dot={{ r: 3, fill: BIRU }}
              activeDot={{ r: 5 }}
              className="chart-glow-blue"
            />
          </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Bingkai>
  );
}

/* ───────────────────────── batang berpasangan ───────────────────────── */

export interface TitikGanda {
  nama: string;
  kiri: number | null;
  kanan: number | null;
}

/**
 * Dua batang berdampingan per kategori — dipakai membandingkan Pre Test dengan
 * Post Test.
 *
 * Ini SATU-SATUNYA grafik HC-MOS yang memakai dua warna, dan itu justru
 * mengikuti aturan yang sama dengan grafik lainnya: warna dipakai untuk
 * membedakan hal yang memang berbeda. Di sini kedua batang mengukur dua
 * pengukuran yang berlainan atas materi yang sama, jadi tanpa warna pembacanya
 * harus menghitung posisi batang untuk tahu mana yang mana.
 *
 * Kategori yang salah satu nilainya belum ada tidak digambar. Nilai kosong yang
 * dipaksa jadi nol terbaca sebagai "nilainya nol", bukan "belum dinilai" —
 * kesalahan baca yang membuat pelatihan terlihat gagal total.
 */
export function GrafikBatangGanda({
  judul,
  subjudul,
  data,
  labelKiri,
  labelKanan,
  satuan,
  pesanKosong = "Belum ada datanya.",
}: {
  judul: string;
  subjudul?: string;
  data: TitikGanda[];
  labelKiri: string;
  labelKanan: string;
  satuan?: string;
  pesanKosong?: string;
}) {
  const baris = React.useMemo(() => {
    const lengkap = data.filter((d) => d.kiri !== null && d.kanan !== null);
    const label = labelSumbu(lengkap.map((d) => d.nama));
    return lengkap.map((d, i) => ({ nama: label[i], penuh: d.nama, kiri: d.kiri as number, kanan: d.kanan as number }));
  }, [data]);

  if (baris.length === 0) return <Kosong judul={judul} subjudul={subjudul} pesan={pesanKosong} />;

  return (
    <Bingkai judul={judul} subjudul={subjudul}>
      {/* Dua lapis, dan keduanya perlu.
          ResponsiveContainer memakai height="100%", sedangkan persen hanya bisa
          dihitung terhadap tinggi induk yang PASTI. Lapis luar memberi tinggi
          itu lewat min-height (dan tetap boleh memanjang lewat flex-1 saat
          kartunya berada di dalam grid); lapis dalam yang absolut mengambil
          tinggi terpakai induknya, berapa pun hasilnya.

          Tanpa lapis dalam, `flex-1` membuat flex-basis 0 dan grafik yang tidak
          kebetulan berada di dalam grid dihitung setinggi NOL — kartunya tampil
          kosong tanpa satu pun galat di konsol. */}
      <div className="relative min-h-[15rem] flex-1" style={{ outline: "none" }}>
        <div className="absolute inset-0">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={baris} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} accessibilityLayer={false}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.16)" vertical={false} />
            <XAxis
              dataKey="nama"
              tick={{ fill: "var(--foreground)", fontSize: 10, fontWeight: 600 }}
              tickLine={false}
              axisLine={false}
              interval={0}
              height={22}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: "var(--foreground)", fontSize: 11, fontWeight: 600 }}
              tickLine={false}
              axisLine={false}
              width={34}
            />
            <Tooltip
              cursor={{ fill: "rgba(148,163,184,0.08)" }}
              content={(p) => (
                <TipGanda
                  {...(p as unknown as { active?: boolean; payload?: readonly { payload?: BarisGanda }[] })}
                  labelKiri={labelKiri}
                  labelKanan={labelKanan}
                  satuan={satuan}
                />
              )}
            />
            <Bar dataKey="kiri" name={labelKiri} fill="#94a3b8" radius={[3, 3, 0, 0]} maxBarSize={18} />
            <Bar dataKey="kanan" name={labelKanan} fill={HIJAU} radius={[3, 3, 0, 0]} maxBarSize={18} />
          </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-center gap-4 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: "#94a3b8" }} /> {labelKiri}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: HIJAU }} /> {labelKanan}
        </span>
      </div>
    </Bingkai>
  );
}

interface BarisGanda {
  nama: string;
  penuh: string;
  kiri: number;
  kanan: number;
}

function TipGanda({
  active,
  payload,
  labelKiri,
  labelKanan,
  satuan,
}: {
  active?: boolean;
  payload?: readonly { payload?: BarisGanda }[];
  labelKiri: string;
  labelKanan: string;
  satuan?: string;
}) {
  const d = active ? payload?.[0]?.payload : undefined;
  if (!d) return null;
  const naik = Math.round((d.kanan - d.kiri) * 10) / 10;
  return (
    <div className="rounded-lg border border-border bg-popover px-2.5 py-1.5 text-xs shadow-md">
      <p className="font-medium text-foreground">{d.penuh}</p>
      <p className="text-muted-foreground">
        {labelKiri}: {d.kiri}
        {satuan ? ` ${satuan}` : ""}
      </p>
      <p className="text-muted-foreground">
        {labelKanan}: {d.kanan}
        {satuan ? ` ${satuan}` : ""}
      </p>
      <p className={naik >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
        {naik >= 0 ? "+" : ""}
        {naik} poin
      </p>
    </div>
  );
}

/* ─────────────────────────────── donat ─────────────────────────────── */

export function GrafikDonat({
  judul,
  subjudul,
  data,
  labelTotal = "Total",
  pesanKosong = "Belum ada datanya.",
}: {
  judul: string;
  subjudul?: string;
  data: TitikData[];
  labelTotal?: string;
  pesanKosong?: string;
}) {
  const [aktifKey, setAktifKey] = React.useState<string | null>(null);

  const slices = React.useMemo(
    () => data.filter((d) => d.nilai > 0).map((d, i) => ({ ...d, warna: WARNA[i % WARNA.length] })),
    [data],
  );
  const total = slices.reduce((a, s) => a + s.nilai, 0);

  // Bagian aktif = yang sedang disentuh; bawaannya yang terbesar. Angka di
  // tengah mengikuti bagian ini — itulah gunanya bisa disentuh.
  const aktif = slices.find((s) => s.nama === aktifKey) ?? slices[0];
  const persen = total && aktif ? Math.round((aktif.nilai / total) * 100) : 0;

  // Panjang busur tiap bagian + putaran awalnya, dihitung dari jumlah bagian
  // sebelumnya. Ditulis dengan reduce, bukan penampung yang diubah-ubah:
  // penampung di dalam useMemo membuat hasilnya bergantung pada urutan render.
  const busur = React.useMemo(
    () =>
      slices.reduce<{ nama: string; warna: string; len: number; rot: number }[]>((acc, s) => {
        const sebelumnya = acc.reduce((a, b) => a + b.len, 0);
        const len = total ? (s.nilai / total) * CIRC : 0;
        acc.push({ nama: s.nama, warna: s.warna, len, rot: -90 + (sebelumnya / CIRC) * 360 });
        return acc;
      }, []),
    [slices, total],
  );

  if (slices.length === 0 || total === 0) return <Kosong judul={judul} subjudul={subjudul} pesan={pesanKosong} />;

  return (
    <Bingkai judul={judul} subjudul={subjudul}>
      <div className="flex flex-1 items-center gap-4 py-2">
        <div className="relative h-44 w-44 shrink-0">
          <svg viewBox="0 0 176 176" className="h-full w-full">
            {busur.map((b) => (
              <circle
                key={b.nama}
                cx={88}
                cy={88}
                r={R}
                fill="none"
                stroke={b.warna}
                strokeWidth={STROKE}
                strokeLinecap="round"
                strokeDasharray={`${b.len} ${CIRC - b.len}`}
                transform={`rotate(${b.rot} 88 88)`}
                className="cursor-pointer transition-opacity"
                style={{ opacity: aktif && b.nama === aktif.nama ? 1 : 0.9 }}
                onMouseEnter={() => setAktifKey(b.nama)}
                onMouseLeave={() => setAktifKey(null)}
                onClick={() => setAktifKey(b.nama)}
              />
            ))}
          </svg>
          {/* Hanya angka persennya. Tanpa keterangan di bawahnya — itu yang
              diminta, dan memang cincinnya sudah dijelaskan oleh daftar di
              sampingnya. */}
          <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
            <p className="text-[2rem] font-extrabold leading-none tracking-tight" style={{ color: aktif?.warna }}>
              {persen}%
            </p>
          </div>
        </div>

        <ul className="min-w-0 flex-1 space-y-2">
          {slices.map((s) => (
            <li
              key={s.nama}
              onMouseEnter={() => setAktifKey(s.nama)}
              onMouseLeave={() => setAktifKey(null)}
              onClick={() => setAktifKey(s.nama)}
              className="flex cursor-pointer items-start gap-2 text-xs"
            >
              <span className="mt-1 size-2.5 shrink-0 rounded-full" style={{ background: s.warna }} />
              <span className={aktif && s.nama === aktif.nama ? "font-medium text-foreground" : "text-foreground/85"}>
                {s.nama}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex items-center justify-between border-t border-border/60 pt-4">
        <span className="text-xs text-muted-foreground">{labelTotal}</span>
        <div className="flex items-center gap-2">
          <div className="flex -space-x-1.5">
            {slices.slice(0, 5).map((s) => (
              <span key={s.nama} className="size-4 rounded-full ring-2 ring-card" style={{ background: s.warna }} />
            ))}
          </div>
          <span className="text-sm font-semibold tabular-nums text-foreground">{total}</span>
        </div>
      </div>
    </Bingkai>
  );
}
