"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CalendarClock,
  ClipboardCheck,
  FileSignature,
  LayoutGrid,
  Store,
  UserPlus,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { StatTile } from "@/components/ui/stat";
import { SCOPE_LABEL, type HcScope } from "@/lib/hcmos/pillars";
import { KESIAPAN, type Kesiapan } from "@/lib/hcmos/lanjutan";
import { GrafikBatang, GrafikDonat, GrafikGaris } from "./grafik";
import { periodeLabel } from "@/lib/hcmos/kontrak";
import { formatDate } from "@/lib/utils";
import type { HcmosRingkas } from "@/lib/data/hcmos";

/**
 * Dasbor HC-MOS.
 *
 * Susunannya mengikuti rujukan HC-MOS: dua blok manpower yang berdiri sendiri —
 * Manajemen dan Outlet — lalu bagian yang berlaku untuk keduanya. Tab di atas
 * memindahkan TAMPILAN, bukan halaman: angkanya sudah dihitung di server untuk
 * kedua scope sekaligus, jadi berpindah tab tidak memuat ulang apa pun.
 *
 * Yang membedakannya dari rujukan: setiap angka di sini berasal dari modul yang
 * benar-benar mengisinya, bukan contoh. Kartu yang sumbernya belum terisi
 * menampilkan keadaannya apa adanya. Menaruh angka contoh supaya layarnya
 * terlihat penuh adalah cara tercepat membuat orang mengambil keputusan dari
 * data yang tidak ada.
 */

type Tampilan = "semua" | HcScope;

export function HcmosDashboard({ ringkas }: { ringkas: HcmosRingkas }) {
  const [tampil, setTampil] = React.useState<Tampilan>("semua");

  return (
    <div className="space-y-5">
      <SegmentedTabs
        className="max-w-2xl"
        value={tampil}
        onChange={(v) => setTampil(v as Tampilan)}
        items={[
          { value: "semua", label: "Semua", icon: LayoutGrid },
          { value: "manajemen", label: `Manpower ${SCOPE_LABEL.manajemen}`, icon: Building2 },
          { value: "outlet", label: `Manpower ${SCOPE_LABEL.outlet}`, icon: Store },
        ]}
      />

      {tampil !== "outlet" && <BlokManajemen r={ringkas} />}
      {tampil !== "manajemen" && <BlokOutlet r={ringkas} />}
    </div>
  );
}

/* ══════════════════════════════ kepala blok ══════════════════════════════ */

function KepalaBlok({
  icon: Icon,
  judul,
  keterangan,
}: {
  icon: typeof Building2;
  judul: string;
  keterangan: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted ring-1 ring-border">
        <Icon className="size-5 text-foreground/70" />
      </div>
      <div className="min-w-0">
        <h2 className="truncate text-base font-semibold text-foreground">{judul}</h2>
        <p className="truncate text-[12px] text-muted-foreground">{keterangan}</p>
      </div>
    </div>
  );
}

/* ═════════════════════════ Manpower Manajemen (GWG) ═════════════════════════ */

function BlokManajemen({ r }: { r: HcmosRingkas }) {
  const total = r.manajemenAktif + r.manajemenNonAktif;
  const posisi = r.posisiTerbuka.find((p) => p.scope === "manajemen")?.jumlah ?? 0;
  const menunggu = r.persetujuanMenunggu.filter((p) => p.scope === "manajemen");

  return (
    <section className="space-y-3">
      <KepalaBlok
        icon={Building2}
        judul={`Manpower ${SCOPE_LABEL.manajemen}`}
        keterangan="Karyawan kantor pusat & manajemen lintas brand"
      />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile icon={Users} label="Total Staff Manajemen" value={r.manajemenAktif} sub={`dari ${total} akun terdaftar`} />
        <StatTile icon={Building2} label="Departemen Terisi" value={r.perDepartemen.length} sub="punya minimal satu orang" />
        <StatTile
          icon={ClipboardCheck}
          label="Review Kinerja Selesai"
          value={`${r.reviewSelesai}/${r.manajemenAktif}`}
          sub={r.reviewSelesai === 0 ? "belum ada penilaian dibuat" : "sudah lewat tahap draf"}
        />
        <StatTile icon={UserPlus} label="Posisi Terbuka" value={posisi} sub="permintaan karyawan berjalan" />
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 lg:grid-cols-2">
        <GrafikBatang
          judul="Distribusi Staff Manajemen per Divisi"
          subjudul="Sumber: User Management"
          data={r.perDepartemen.slice(0, 10).map((d) => ({ nama: d.nama, nilai: d.jumlah }))}
          pesanKosong="Belum ada departemen terisi di User Management."
        />
        <CareerSuccession data={r.suksesiPerKesiapan} />
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 lg:grid-cols-2">
        <GrafikGaris
          judul="Tren Karyawan Keluar per Bulan"
          subjudul="Sumber: tanggal keluar di Kontrak Tracker"
          data={[...r.turnoverPerBulan].reverse().map((x) => ({ nama: x.bulan, nilai: x.jumlah }))}
          pesanKosong="Belum ada karyawan keluar yang tercatat."
        />
        <PersetujuanMenunggu judul="Persetujuan Menunggu — Manajemen" rows={menunggu} />
      </div>
    </section>
  );
}

/* ═════════════════════════════ Manpower Outlet ═════════════════════════════ */

function BlokOutlet({ r }: { r: HcmosRingkas }) {
  const posisi = r.posisiTerbuka.find((p) => p.scope === "outlet")?.jumlah ?? 0;
  const menunggu = r.persetujuanMenunggu.filter((p) => p.scope === "outlet");
  const keluarBulanIni = r.turnoverPerBulan.at(-1)?.jumlah ?? 0;

  return (
    <section className="space-y-3">
      <KepalaBlok
        icon={Store}
        judul={`Manpower ${SCOPE_LABEL.outlet}`}
        keterangan="Karyawan operasional di seluruh cabang"
      />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile icon={Users} label="Total Crew Outlet" value={r.outletKaryawan} sub={`tersebar di ${r.outletTotal} outlet`} />
        <StatTile icon={UserPlus} label="Posisi Terbuka Outlet" value={posisi} sub="permintaan karyawan berjalan" />
        <StatTile
          icon={CalendarClock}
          label="Kontrak Segera Berakhir"
          value={r.kontrakSegera}
          sub="≤ 60 hari lagi"
        />
        <StatTile
          icon={FileSignature}
          label="Kontrak Berakhir"
          value={r.kontrakBerakhir}
          sub={keluarBulanIni ? `${keluarBulanIni} keluar bulan terakhir` : "perlu ditindaklanjuti"}
        />
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 lg:grid-cols-2">
        <GrafikBatang
          judul="Crew Outlet per Brand"
          subjudul="Sumber: Kontrak Tracker — karyawan yang belum keluar"
          data={r.crewPerBrand.map((b) => ({ nama: b.brand, nilai: b.jumlah }))}
          pesanKosong="Belum ada karyawan outlet tercatat di Kontrak Tracker."
        />
        <PipelineRekrutmen rows={r.pipelinePerTahap.filter((p) => p.scope === "outlet")} />
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 lg:grid-cols-2">
        <KepatuhanUpdate r={r} />
        <GrafikDonat
          judul="Komposisi Turnover"
          subjudul="Alasan karyawan keluar"
          data={r.turnoverPerKategori.map((x) => ({ nama: x.kategori, nilai: x.jumlah }))}
          pesanKosong="Belum ada karyawan keluar yang tercatat."
        />
      </div>

      <PersetujuanMenunggu judul="Persetujuan Menunggu — Outlet" rows={menunggu} />
    </section>
  );
}

/* ══════════════════════════════ kartu isian ══════════════════════════════ */

/**
 * Kesiapan suksesi sebagai corong.
 *
 * Bentuk corong dipilih karena yang ingin dilihat bukan jumlah per tingkat,
 * melainkan seberapa cepat orang tersedia: batang yang panjang di "Perlu
 * Dikembangkan" dan pendek di "Siap Sekarang" langsung terbaca sebagai posisi
 * kunci yang belum punya pengganti.
 */
function CareerSuccession({ data }: { data: { kesiapan: string; jumlah: number }[] }) {
  const urut: Kesiapan[] = ["siap_sekarang", "siap_1_tahun", "perlu_dikembangkan"];
  const peta = new Map(data.map((d) => [d.kesiapan, d.jumlah]));
  const total = data.reduce((a, d) => a + d.jumlah, 0);

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle>Career &amp; Succession</CardTitle>
        <p className="text-[11px] text-muted-foreground">Kesiapan kandidat pengganti posisi kunci</p>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        {total === 0 ? (
          <p className="my-auto text-center text-[12px] text-muted-foreground">
            Belum ada rencana suksesi yang diisi.
            <br />
            <Link href="/hc-mos/talent?tab=suksesi" className="text-primary hover:underline">
              Buka Succession Plan
            </Link>
          </p>
        ) : (
          <div className="space-y-3">
            {urut.map((k) => {
              const n = peta.get(k) ?? 0;
              return (
                <div key={k} className="flex items-center gap-3">
                  <span className="w-32 shrink-0 truncate text-[12px] text-muted-foreground">{KESIAPAN[k].label}</span>
                  <Progress className="flex-1" value={total ? Math.round((n / total) * 100) : 0} />
                  <span className="w-6 shrink-0 text-right text-[13px] font-semibold tabular-nums text-foreground">{n}</span>
                </div>
              );
            })}
            <p className="pt-1 text-[11px] text-muted-foreground">{total} posisi kunci dipetakan.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Pipeline rekrutmen — hanya tahap yang masih berjalan. */
function PipelineRekrutmen({ rows }: { rows: { tahap: string; jumlah: number }[] }) {
  const total = rows.reduce((a, r) => a + r.jumlah, 0);
  const puncak = Math.max(1, ...rows.map((r) => r.jumlah));

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle>Pipeline Rekrutmen Outlet</CardTitle>
        <p className="text-[11px] text-muted-foreground">Kandidat yang masih berjalan, per tahap</p>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        {total === 0 ? (
          <p className="my-auto text-center text-[12px] text-muted-foreground">
            Belum ada kandidat outlet yang berjalan.
            <br />
            <Link href="/hc-mos/rekrutmen" className="text-primary hover:underline">
              Buka Rekrutmen &amp; Seleksi
            </Link>
          </p>
        ) : (
          <div className="space-y-3">
            {rows.map((r) => (
              <div key={r.tahap} className="flex items-center gap-3">
                <span className="w-28 shrink-0 truncate text-[12px] text-muted-foreground">{r.tahap}</span>
                <Progress className="flex-1" value={Math.round((r.jumlah / puncak) * 100)} />
                <span className="w-6 shrink-0 text-right text-[13px] font-semibold tabular-nums text-foreground">
                  {r.jumlah}
                </span>
              </div>
            ))}
            <p className="pt-1 text-[11px] text-muted-foreground">{total} kandidat sedang diproses.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function KepatuhanUpdate({ r }: { r: HcmosRingkas }) {
  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle>Kepatuhan Update Bulanan</CardTitle>
        <p className="text-[11px] text-muted-foreground">Periode {periodeLabel(r.periode)}</p>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        <div className="flex items-end justify-between gap-3">
          <p className="text-3xl font-semibold tabular-nums text-foreground">{r.kepatuhanPersen}%</p>
          <p className="text-right text-[12px] text-muted-foreground">
            {r.outletLapor} dari {r.outletTotal} outlet sudah melapor
          </p>
        </div>
        <Progress className="mt-3" value={r.kepatuhanPersen} />
        {r.belumAdaKontrak > 0 && (
          <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-[11px] leading-relaxed text-amber-700 dark:text-amber-300">
            {r.belumAdaKontrak} karyawan tercatat tanpa data kontrak sama sekali. Lengkapi lewat Kontrak Tracker supaya
            status kontraknya bisa dihitung.
          </p>
        )}
        <Link
          href="/hc-mos/kontrak"
          className="mt-auto inline-flex items-center gap-1.5 pt-3 text-[13px] font-medium text-primary hover:underline"
        >
          Buka Kontrak Tracker <ArrowRight className="size-4" />
        </Link>
      </CardContent>
    </Card>
  );
}

/**
 * Persetujuan yang menggantung.
 *
 * Tidak ada tombol setuju/tolak di sini, dan itu disengaja: memutuskan butuh
 * melihat isinya — siapa yang meminta, berapa orang, alasan apa — dan keputusan
 * yang diambil dari satu baris ringkas di dasbor adalah keputusan yang diambil
 * tanpa membacanya. Barisnya menautkan ke tempat keputusannya diambil.
 */
function PersetujuanMenunggu({
  judul,
  rows,
}: {
  judul: string;
  rows: HcmosRingkas["persetujuanMenunggu"];
}) {
  return (
    <Card className="flex flex-col">
      <CardHeader className="flex-row items-start justify-between gap-3 pb-2">
        <div className="min-w-0">
          <CardTitle>{judul}</CardTitle>
          <p className="text-[11px] text-muted-foreground">Permintaan karyawan, pelatihan, cuti &amp; izin</p>
        </div>
        {rows.length > 0 && <Badge tone="warning">{rows.length} menunggu</Badge>}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        {rows.length === 0 ? (
          <p className="my-auto text-center text-[12px] text-muted-foreground">
            Tidak ada yang menunggu keputusan. Bersih.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.slice(0, 6).map((p) => (
              <li key={p.id}>
                <Link href={p.href} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-muted/50">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground">
                    {inisial(p.orang)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-foreground">{p.judul}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {p.orang} · {p.jenis}
                      {p.tanggal ? ` · ${formatDate(p.tanggal)}` : ""}
                    </span>
                  </span>
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        )}
        {rows.length > 6 && (
          <p className="pt-2 text-[11px] text-muted-foreground">+{rows.length - 6} lagi menunggu.</p>
        )}
      </CardContent>
    </Card>
  );
}

/** Dua huruf awal nama — dipakai lingkaran kecil di daftar persetujuan. */
function inisial(nama: string): string {
  const bagian = nama.trim().split(/\s+/).filter(Boolean);
  if (bagian.length === 0) return "—";
  return (bagian[0][0] + (bagian[1]?.[0] ?? "")).toUpperCase();
}
