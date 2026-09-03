"use client";

import * as React from "react";
import { CircleDashed, Info, Lock, SlidersHorizontal } from "lucide-react";
import { NAV_ICONS } from "@/components/layout/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { ScoreRing } from "@/components/ui/score-ring";
import type { BarisKpi } from "@/lib/kpi/hitung";
import type { DetailFee, DetailPasar, LaporanKpi } from "@/lib/data/kpi";
import { formatIDR, formatNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";

/**
 * Halaman KPI satu posisi.
 *
 * SATU KOMPONEN UNTUK SEPULUH POSISI. Isinya sepenuhnya ditentukan data yang
 * dikirim server: baris indikator, dan panel tambahan yang hanya muncul bila
 * posisi itu memang memakainya. Membuat satu halaman per posisi akan berarti
 * sepuluh tempat yang harus diubah serempak setiap kali susunan tabelnya
 * bergeser — dan satu yang tertinggal berarti dua orang membaca laporan dengan
 * bentuk yang berbeda.
 */

const persen = (n: number | null, digit = 2) =>
  n === null ? "—" : `${formatNumber(n, { minimumFractionDigits: digit, maximumFractionDigits: digit })}%`;

const nilai = (n: number | null, satuan?: BarisKpi["satuan"]) => {
  if (n === null) return "—";
  if (satuan === "rupiah") return formatIDR(n);
  if (satuan === "persen") return persen(n);
  return formatNumber(n, { maximumFractionDigits: 2 });
};

export function PapanKpi({
  laporan,
  namaPosisi,
  pic,
  departemen,
  ikon,
  periodeOpsi,
  bolehAtur,
}: {
  laporan: LaporanKpi;
  namaPosisi: string;
  pic: string[];
  departemen: string;
  ikon: string;
  periodeOpsi: { value: string; label: string }[];
  bolehAtur: boolean;
}) {
  const Ikon = NAV_ICONS[ikon] ?? CircleDashed;
  const { baris, ringkas } = laporan;

  // Bobot yang tidak berjumlah 100 BUKAN kesalahan yang disembunyikan. Sosial
  // Media memang 90% sampai bobot barunya ditetapkan, dan skor 90 di sana
  // bukan berarti kinerjanya lebih rendah daripada posisi lain.
  const bobotTimpang = Math.abs(ringkas.bobotTotal - 100) > 0.001;

  const kelompok = React.useMemo(() => {
    const out: { nama: string | null; isi: BarisKpi[] }[] = [];
    for (const b of baris) {
      const nama = b.kategori ?? null;
      const akhir = out[out.length - 1];
      if (akhir && akhir.nama === nama) akhir.isi.push(b);
      else out.push({ nama, isi: [b] });
    }
    return out;
  }, [baris]);

  function gantiPeriode(p: string) {
    const url = new URL(window.location.href);
    url.searchParams.set("periode", p);
    window.location.href = url.toString();
  }

  return (
    <div className="flex w-full flex-col gap-4">
      {/* ── kepala ───────────────────────────────────────────────────────── */}
      <header className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-muted ring-1 ring-border">
          <Ikon className="size-5 text-foreground/70" />
        </span>
        <div className="mr-auto min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{departemen}</p>
          <h1 className="truncate text-xl font-semibold tracking-tight text-foreground">{namaPosisi}</h1>
          {pic.length > 0 && <p className="truncate text-[12.5px] text-muted-foreground">{pic.join(" · ")}</p>}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Combobox
            className="w-40"
            options={periodeOpsi}
            value={laporan.periode}
            onChange={gantiPeriode}
            matchTriggerWidth
          />
          {laporan.dikunci && (
            <Badge tone="neutral">
              <Lock className="size-3" /> Bulan dikunci
            </Badge>
          )}
          {bolehAtur && (
            <Button variant="outline" size="sm" className="gap-1.5">
              <SlidersHorizontal className="size-4" /> Pengaturan
            </Button>
          )}
        </div>
      </header>

      {/* ── ringkasan ────────────────────────────────────────────────────── */}
      <section className="grid gap-3 lg:grid-cols-[auto_1fr]">
        <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4">
          <ScoreRing value={Math.round(ringkas.skor)} size={92} />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Skor bulan ini</p>
            <p className="text-2xl font-semibold tabular-nums tracking-tight text-foreground">
              {persen(ringkas.skor, 2)}
            </p>
            <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">
              dari bobot {persen(ringkas.bobotTotal, 0)}
              {ringkas.jumlahBelumTerukur > 0 && (
                <> · {ringkas.jumlahBelumTerukur} indikator belum terukur</>
              )}
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Kotak label="Indikator terukur" nilai={`${ringkas.jumlahTerukur} dari ${baris.length}`} />
          <Kotak
            label="Setara skala 100"
            nilai={ringkas.skorSetara === null ? "—" : persen(ringkas.skorSetara, 2)}
            catatan="hanya dari indikator yang ada datanya"
          />
          <Kotak label="Bobot terpakai" nilai={persen(ringkas.bobotTerpakai, 0)} catatan={`dari ${persen(ringkas.bobotTotal, 0)}`} />
        </div>
      </section>

      {bobotTimpang && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/[0.07] px-3.5 py-2.5 text-[12.5px] leading-relaxed text-amber-800 dark:text-amber-200">
          Bobot indikator posisi ini berjumlah <b>{persen(ringkas.bobotTotal, 0)}</b>, bukan 100%. Skor tertingginya ikut
          terbatas di angka itu. Perbaiki lewat Pengaturan agar bisa dibandingkan setara dengan posisi lain.
        </p>
      )}

      {/* ── tabel indikator ──────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left">
                <Th>Indikator</Th>
                <Th className="w-20" align="right">Bobot</Th>
                <Th className="w-32" align="right">Target</Th>
                <Th className="w-32" align="right">Actual</Th>
                <Th className="w-28" align="right">Persentase</Th>
                <Th className="w-28" align="right">% Actual</Th>
              </tr>
            </thead>
            <tbody>
              {kelompok.map((g) => (
                <React.Fragment key={g.nama ?? "tanpa"}>
                  {g.nama && (
                    <tr>
                      <td
                        colSpan={6}
                        className="bg-muted/25 px-3 py-1.5 text-[10.5px] font-semibold uppercase tracking-[0.09em] text-muted-foreground"
                      >
                        {g.nama}
                      </td>
                    </tr>
                  )}
                  {g.isi.map((b) => (
                    <tr key={b.key} className="border-b border-border/60 last:border-0 hover:bg-muted/20">
                      <Td>
                        <p className="font-medium text-foreground">{b.label}</p>
                        <p className="text-[11px] leading-relaxed text-muted-foreground">{b.alasan ?? b.penjelasan}</p>
                      </Td>
                      <Td align="right" className="tabular-nums text-muted-foreground">{persen(b.bobot, 0)}</Td>
                      <Td align="right" className="tabular-nums">{nilai(b.target, b.satuan)}</Td>
                      <Td align="right" className="tabular-nums">{nilai(b.actual, b.satuan)}</Td>
                      <Td align="right" className="tabular-nums">
                        {b.persentase === null ? (
                          <span className="text-[11px] text-muted-foreground">belum ada data</span>
                        ) : (
                          persen(b.persentase)
                        )}
                      </Td>
                      <Td align="right" className="tabular-nums font-semibold">
                        {b.persenActual === null ? "—" : persen(b.persenActual)}
                      </Td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
              <tr className="border-t border-border bg-muted/40">
                <Td className="font-semibold">Skor</Td>
                <Td align="right" className="tabular-nums font-semibold text-muted-foreground">{persen(ringkas.bobotTotal, 0)}</Td>
                <Td colSpan={3} />
                <Td align="right" className="tabular-nums text-base font-semibold">{persen(ringkas.skor)}</Td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {laporan.efisiensi && <PanelEfisiensi data={laporan.efisiensi} />}
      {laporan.fee && <PanelFee data={laporan.fee} />}
      {laporan.pasar && <PanelPasar data={laporan.pasar} />}

      <CaraBaca />
    </div>
  );
}

/* ────────────────────────────── potongan kecil ────────────────────────────── */

function Kotak({ label, nilai: v, catatan }: { label: string; nilai: string; catatan?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-[11px] font-medium uppercase leading-tight tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums tracking-tight text-foreground">{v}</p>
      {catatan && <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">{catatan}</p>}
    </div>
  );
}

function Th({ children, className = "", align = "left" }: { children?: React.ReactNode; className?: string; align?: "left" | "right" }) {
  return (
    <th
      className={cn(
        "whitespace-nowrap px-3 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground",
        align === "right" ? "text-right" : "text-left",
        className,
      )}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className = "",
  align = "left",
  colSpan,
}: {
  children?: React.ReactNode;
  className?: string;
  align?: "left" | "right";
  colSpan?: number;
}) {
  return (
    <td colSpan={colSpan} className={cn("px-3 py-3 align-middle", align === "right" ? "text-right" : "text-left", className)}>
      {children}
    </td>
  );
}

function JudulPanel({ judul, ringkas }: { judul: string; ringkas: React.ReactNode }) {
  return (
    <div className="border-b border-border px-4 py-3">
      <p className="text-[13px] font-semibold text-foreground">{judul}</p>
      <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">{ringkas}</p>
    </div>
  );
}

/* ─────────────────────────────── panel-panel ─────────────────────────────── */

function PanelEfisiensi({ data }: { data: NonNullable<LaporanKpi["efisiensi"]> }) {
  const { baris, ringkas } = data;
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <JudulPanel
        judul="Efisiensi Beban Operasional"
        ringkas={
          <>
            Budget seluruh outlet {formatIDR(ringkas.totalBudget)} · realisasi {formatIDR(ringkas.totalActual)} ·{" "}
            {ringkas.persenActual === null ? (
              "belum ada realisasi yang diisi"
            ) : (
              <>
                {persen(ringkas.persenActual)} dari penjualan —{" "}
                <b className={ringkas.selisih! <= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
                  {ringkas.selisih! <= 0 ? "tersisa" : "melebihi"} {persen(Math.abs(ringkas.selisih!))}
                </b>
              </>
            )}{" "}
            · {ringkas.outletTerhitung} outlet terhitung, {ringkas.outletTanpaData} belum diisi
          </>
        }
      />
      <div className="max-h-[26rem] overflow-auto">
        <table className="w-full min-w-[860px] border-collapse text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-border bg-muted/60 text-left">
              <Th>Outlet</Th>
              <Th align="right">Average 3 bln</Th>
              <Th align="right">Target WH</Th>
              <Th align="right">Target non-WH</Th>
              <Th align="right">Actual WH</Th>
              <Th align="right">Actual non-WH</Th>
              <Th align="right">% Actual</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {baris.map((b) => (
              <tr key={b.outletId} className="border-b border-border/60 last:border-0 hover:bg-muted/20">
                <Td className="whitespace-nowrap">{b.outletNama}</Td>
                <Td align="right" className="tabular-nums">{b.average === null ? "—" : formatIDR(b.average)}</Td>
                <Td align="right" className="tabular-nums text-muted-foreground">{b.targetWh === null ? "—" : formatIDR(b.targetWh)}</Td>
                <Td align="right" className="tabular-nums text-muted-foreground">{b.targetNonWh === null ? "—" : formatIDR(b.targetNonWh)}</Td>
                <Td align="right" className="tabular-nums">{b.actualWh === null ? <span className="text-[11px] text-muted-foreground">isi</span> : formatIDR(b.actualWh)}</Td>
                <Td align="right" className="tabular-nums">{b.actualNonWh === null ? <span className="text-[11px] text-muted-foreground">isi</span> : formatIDR(b.actualNonWh)}</Td>
                <Td align="right" className="tabular-nums">{b.persenActual === null ? "—" : persen(b.persenActual)}</Td>
                <Td>
                  {b.selisih === null ? (
                    <span className="text-[11px] text-muted-foreground">No Data</span>
                  ) : (
                    <Badge tone={b.selisih <= 0 ? "success" : "danger"}>
                      {b.selisih <= 0 ? "Tersisa" : "Melebihi"} {persen(Math.abs(b.selisih))}
                    </Badge>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PanelFee({ data }: { data: DetailFee[] }) {
  const sesuai = data.filter((d) => d.sesuai).length;
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <JudulPanel
        judul="Invoice Management Fee"
        ringkas={`${sesuai} dari ${data.length} outlet sudah diceklis sesuai. Management fee seharusnya 5% dari net sales bulan ini — ceklisnya dimulai dari nol setiap ganti bulan.`}
      />
      <div className="max-h-[26rem] overflow-auto">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-border bg-muted/60 text-left">
              <Th>Outlet</Th>
              <Th align="right">Net sales</Th>
              <Th align="right">Fee seharusnya</Th>
              <Th className="w-24">Sesuai</Th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.outletId} className="border-b border-border/60 last:border-0 hover:bg-muted/20">
                <Td className="whitespace-nowrap">{d.outletNama}</Td>
                <Td align="right" className="tabular-nums">{d.netSales === null ? "—" : formatIDR(d.netSales)}</Td>
                <Td align="right" className="tabular-nums">{d.feeSeharusnya === null ? "—" : formatIDR(d.feeSeharusnya)}</Td>
                <Td>
                  <Badge tone={d.sesuai ? "success" : "neutral"} dot>
                    {d.sesuai ? "Sesuai" : "Belum"}
                  </Badge>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PanelPasar({ data }: { data: DetailPasar }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <JudulPanel
        judul="Keberhasilan Pasar"
        ringkas={
          data.baris.length === 0
            ? "Belum ada menu yang dipilih untuk dinilai bulan ini."
            : `${data.baris.length} menu dipilih · penjualan ${formatIDR(data.total)} dari omset ${formatIDR(data.omset)}`
        }
      />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left">
              <Th>Nama menu</Th>
              <Th align="right">Penjualan 3 bulan</Th>
              <Th align="right">Bagian dari omset</Th>
            </tr>
          </thead>
          <tbody>
            {data.baris.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-10 text-center text-[12.5px] text-muted-foreground">
                  Pilih menu yang mau dinilai, lalu penjualannya ditarik dari ESB.
                </td>
              </tr>
            ) : (
              data.baris.map((b) => (
                <tr key={b.menu} className="border-b border-border/60 last:border-0">
                  <Td>{b.menu}</Td>
                  <Td align="right" className="tabular-nums">{formatIDR(b.penjualan)}</Td>
                  <Td align="right" className="tabular-nums">{persen(b.bagian)}</Td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CaraBaca() {
  return (
    <div className="rounded-2xl border border-border bg-muted/20 px-4 py-3.5">
      <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Info className="size-4" /> Cara angkanya dihitung
      </p>
      <p className="mt-1.5 max-w-4xl text-[12.5px] leading-relaxed text-foreground/85">
        <b>Persentase</b> = actual ÷ target, dibatasi 100% — capaian di atas target tidak menambah nilai.{" "}
        <b>% Actual</b> = bobot × persentase. <b>Skor</b> adalah jumlah seluruh % actual. Indikator yang belum ada
        datanya tidak dihitung nol, melainkan dikeluarkan dari bobot yang terpakai — nol berarti gagal total, dan itu
        tuduhan yang berbeda dari belum diukur.
      </p>
    </div>
  );
}
