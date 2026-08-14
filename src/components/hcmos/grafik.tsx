"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Grafik HC-MOS.
 *
 * Tiga bentuk saja, dengan aturan pemakaian yang sama seperti berkas HTML dari
 * Human Capital: donat untuk komposisi, batang untuk perbandingan antar
 * kategori, garis untuk tren waktu. Membatasi bentuknya membuat pembaca tidak
 * perlu menerjemahkan ulang cara membaca tiap panel.
 *
 * Semua grafik memakai `ResponsiveContainer` — di HP lebarnya menyesuaikan
 * kartu, bukan memaksa halaman menggulir mendatar.
 */

/** Palet dipakai berurutan supaya kategori yang sama berwarna sama antar panel. */
const PALET = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"];

const SUMBU = { fontSize: 11, fill: "rgb(148 163 184)" };
const KISI = "rgba(148,163,184,0.16)";

function Bingkai({
  judul,
  subjudul,
  children,
  tinggi = 240,
}: {
  judul: string;
  subjudul?: string;
  children: React.ReactElement;
  tinggi?: number;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>{judul}</CardTitle>
        {subjudul && <p className="text-[11px] text-muted-foreground">{subjudul}</p>}
      </CardHeader>
      <CardContent>
        <div style={{ height: tinggi }}>
          <ResponsiveContainer width="100%" height="100%">
            {children}
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

/** Kotak keterangan saat kursor menyentuh grafik. */
interface TipProps {
  active?: boolean;
  payload?: readonly { name?: unknown; value?: unknown; payload?: { nama?: string } }[];
  label?: unknown;
}
function Tip({ active, payload, label, satuan }: TipProps & { satuan?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-2.5 py-1.5 text-[12px] shadow-lg">
      <p className="font-medium text-foreground">{String(label ?? payload[0]?.payload?.nama ?? "")}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-muted-foreground">
          {String(p.name ?? "")}: <span className="font-semibold text-foreground">{String(p.value ?? "")}</span>
          {satuan ?? ""}
        </p>
      ))}
    </div>
  );
}

export interface TitikData {
  nama: string;
  nilai: number;
}

/** Kosong ditangani di sini, bukan di tiap pemanggil. */
function Kosong({ judul, subjudul, pesan }: { judul: string; subjudul?: string; pesan: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>{judul}</CardTitle>
        {subjudul && <p className="text-[11px] text-muted-foreground">{subjudul}</p>}
      </CardHeader>
      <CardContent>
        <p className="py-12 text-center text-sm text-muted-foreground">{pesan}</p>
      </CardContent>
    </Card>
  );
}

export function GrafikBatang({
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
  if (data.length === 0) return <Kosong judul={judul} subjudul={subjudul} pesan={pesanKosong} />;
  return (
    <Bingkai judul={judul} subjudul={subjudul}>
      <BarChart data={data} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={KISI} vertical={false} />
        <XAxis dataKey="nama" tick={SUMBU} tickLine={false} axisLine={false} interval={0} angle={-12} textAnchor="end" height={48} />
        <YAxis tick={SUMBU} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip cursor={{ fill: "rgba(148,163,184,0.08)" }} content={(p) => <Tip {...(p as unknown as TipProps)} satuan={satuan} />} />
        <Bar dataKey="nilai" name="Jumlah" radius={[6, 6, 0, 0]} maxBarSize={48}>
          {data.map((_, i) => (
            <Cell key={i} fill={PALET[i % PALET.length]} />
          ))}
        </Bar>
      </BarChart>
    </Bingkai>
  );
}

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
  if (data.length === 0) return <Kosong judul={judul} subjudul={subjudul} pesan={pesanKosong} />;
  return (
    <Bingkai judul={judul} subjudul={subjudul}>
      <LineChart data={data} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={KISI} vertical={false} />
        <XAxis dataKey="nama" tick={SUMBU} tickLine={false} axisLine={false} />
        <YAxis tick={SUMBU} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip content={(p) => <Tip {...(p as unknown as TipProps)} satuan={satuan} />} />
        <Line type="monotone" dataKey="nilai" name="Jumlah" stroke={PALET[0]} strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </Bingkai>
  );
}

export function GrafikDonat({
  judul,
  subjudul,
  data,
  pesanKosong = "Belum ada datanya.",
}: {
  judul: string;
  subjudul?: string;
  data: TitikData[];
  pesanKosong?: string;
}) {
  const total = data.reduce((a, d) => a + d.nilai, 0);
  if (data.length === 0 || total === 0) return <Kosong judul={judul} subjudul={subjudul} pesan={pesanKosong} />;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>{judul}</CardTitle>
        {subjudul && <p className="text-[11px] text-muted-foreground">{subjudul}</p>}
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-4">
          <div className="h-[190px] min-w-[190px] flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="nilai" nameKey="nama" innerRadius={52} outerRadius={80} paddingAngle={2}>
                  {data.map((_, i) => (
                    <Cell key={i} fill={PALET[i % PALET.length]} />
                  ))}
                </Pie>
                <Tooltip content={(p) => <Tip {...(p as unknown as TipProps)} />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          {/* Keterangan ditulis sendiri, bukan legend bawaan: nama outlet dan
              kategori di sini panjang-panjang, dan legend bawaan memotongnya
              tanpa memberi tahu bahwa terpotong. */}
          <ul className="min-w-[10rem] flex-1 space-y-1.5">
            {data.map((d, i) => (
              <li key={d.nama} className="flex items-center gap-2 text-[12px]">
                <span className="size-2.5 shrink-0 rounded-sm" style={{ background: PALET[i % PALET.length] }} />
                <span className="min-w-0 flex-1 truncate text-foreground">{d.nama}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {d.nilai} · {Math.round((d.nilai / total) * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
