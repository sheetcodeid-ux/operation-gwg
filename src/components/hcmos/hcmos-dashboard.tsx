"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CalendarClock,
  ExternalLink,
  FileSignature,
  Users,
} from "lucide-react";
import { NAV_ICONS } from "@/components/layout/icons";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { StatTile } from "@/components/ui/stat";
import { HC_PILLARS, SCOPE_LABEL, submenusForScope, type HcScope } from "@/lib/hcmos/pillars";
import { periodeLabel } from "@/lib/hcmos/kontrak";
import type { HcmosRingkas } from "@/lib/data/hcmos";

/**
 * Dasbor HC-MOS.
 *
 * Scope tab (Manajemen / Outlet) berpindah TAMPILAN, bukan halaman — persis
 * seperti yang diminta Juknis Bab 2.2. Angkanya sudah dihitung di server untuk
 * kedua scope sekaligus, jadi berpindah tab tidak memuat ulang apa pun.
 */
export function HcmosDashboard({ ringkas }: { ringkas: HcmosRingkas }) {
  const [scope, setScope] = React.useState<HcScope>("outlet");

  return (
    <div className="space-y-4">
      <SegmentedTabs
        className="max-w-md"
        value={scope}
        onChange={(v) => setScope(v as HcScope)}
        items={[
          { value: "manajemen", label: SCOPE_LABEL.manajemen, icon: Building2 },
          { value: "outlet", label: SCOPE_LABEL.outlet, icon: Users },
        ]}
      />

      {scope === "manajemen" ? <RingkasManajemen r={ringkas} /> : <RingkasOutlet r={ringkas} />}

      <PilarGrid scope={scope} />
    </div>
  );
}

function RingkasManajemen({ r }: { r: HcmosRingkas }) {
  const total = r.manajemenAktif + r.manajemenNonAktif;
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile icon={Users} label="Karyawan Aktif" value={r.manajemenAktif} sub="dari User Management" />
        <StatTile icon={Users} label="Nonaktif" value={r.manajemenNonAktif} sub="akun dinonaktifkan" />
        <StatTile icon={Building2} label="Departemen" value={r.perDepartemen.length} sub="departemen terisi" />
        <StatTile icon={Users} label="Total Terdaftar" value={total} sub="seluruh akun" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sebaran per Departemen</CardTitle>
        </CardHeader>
        <CardContent>
          {r.perDepartemen.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Belum ada departemen terisi di User Management.
            </p>
          ) : (
            <ul className="space-y-2.5">
              {r.perDepartemen.map((d) => (
                <li key={d.nama}>
                  <div className="mb-1 flex items-baseline justify-between gap-3">
                    <span className="truncate text-sm text-foreground">{d.nama}</span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">{d.jumlah}</span>
                  </div>
                  <Progress value={r.manajemenAktif ? (d.jumlah / r.manajemenAktif) * 100 : 0} />
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[11px] text-muted-foreground">
            Sumber: User Management. Menambah atau menonaktifkan karyawan dilakukan di sana, dan angkanya ikut berubah
            di sini — tidak ada daftar karyawan kedua yang perlu disamakan.
          </p>
        </CardContent>
      </Card>
    </>
  );
}

function RingkasOutlet({ r }: { r: HcmosRingkas }) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile icon={Building2} label="Outlet" value={r.outletTotal} sub="dalam lingkup Anda" />
        <StatTile icon={Users} label="Karyawan Outlet" value={r.outletKaryawan} sub="belum keluar" />
        <StatTile
          icon={CalendarClock}
          label="Kontrak Segera Berakhir"
          value={r.kontrakSegera}
          sub="≤ 60 hari lagi"
        />
        <StatTile icon={FileSignature} label="Kontrak Berakhir" value={r.kontrakBerakhir} sub="perlu ditindaklanjuti" />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Kepatuhan Update Bulanan · {periodeLabel(r.periode)}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between gap-3">
              <p className="text-3xl font-semibold tabular-nums text-foreground">{r.kepatuhanPersen}%</p>
              <p className="text-sm text-muted-foreground">
                {r.outletLapor} dari {r.outletTotal} outlet sudah melapor
              </p>
            </div>
            <Progress className="mt-3" value={r.kepatuhanPersen} />
            {r.belumAdaKontrak > 0 && (
              <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-[12px] leading-relaxed text-amber-700 dark:text-amber-300">
                {r.belumAdaKontrak} karyawan tercatat tanpa data kontrak sama sekali. Lengkapi lewat Kontrak Tracker
                supaya status kontraknya bisa dihitung.
              </p>
            )}
            <Link
              href="/hc-mos/kontrak"
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              Buka Kontrak Tracker <ArrowRight className="size-4" />
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Turnover</CardTitle>
          </CardHeader>
          <CardContent>
            {r.turnoverPerKategori.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Belum ada karyawan keluar yang tercatat.
              </p>
            ) : (
              <ul className="space-y-2.5">
                {r.turnoverPerKategori.map((k) => {
                  const total = r.turnoverPerKategori.reduce((a, x) => a + x.jumlah, 0);
                  return (
                    <li key={k.kategori}>
                      <div className="mb-1 flex items-baseline justify-between gap-3">
                        <span className="truncate text-sm text-foreground">{k.kategori}</span>
                        <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">{k.jumlah}</span>
                      </div>
                      <Progress value={total ? (k.jumlah / total) * 100 : 0} />
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

/** Sembilan pilar sebagai kartu — pintu masuk ke tiap halaman pilar. */
function PilarGrid({ scope }: { scope: HcScope }) {
  return (
    <div>
      <h2 className="mb-2.5 text-sm font-semibold text-foreground">Pilar Human Capital</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {HC_PILLARS.map((p) => {
          const Icon = NAV_ICONS[p.icon] ?? FileSignature;
          const subs = submenusForScope(p, scope);
          const terhubung = subs.filter((s) => s.href).length;
          return (
            <Link
              key={p.slug}
              href={`/hc-mos/${p.slug}`}
              className="glass group flex flex-col rounded-2xl p-4 transition-colors hover:bg-muted/40"
            >
              <div className="flex items-start gap-3">
                <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted ring-1 ring-border">
                  <Icon className="size-5 text-foreground/70" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{p.label}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    PIC {p.pic} · {p.picRole}
                  </p>
                </div>
                <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </div>
              <p className="mt-2.5 line-clamp-2 text-[12px] leading-relaxed text-muted-foreground">{p.ringkas}</p>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <Badge tone="neutral">{subs.length} sub-menu</Badge>
                {terhubung > 0 && (
                  <Badge tone="success">
                    <ExternalLink className="mr-1 size-3" />
                    {terhubung} sudah berjalan
                  </Badge>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
