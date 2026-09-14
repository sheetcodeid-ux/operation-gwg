"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, TrendingDown, TrendingUp } from "lucide-react";
import type { DetailHarian } from "@/lib/data/daily-outlet";
import type { BarisHarian } from "@/lib/ops/harian";
import { cn, formatIDR, formatIDRShort, formatNumber } from "@/lib/utils";

/**
 * DAILY — penjualan hari demi hari, satu baris per outlet.
 *
 * Laporan bulanan menjawab "berapa"; tabel ini menjawab "KAPAN". Outlet yang
 * turun dua puluh persen sebulan bisa berarti dua hal yang sama sekali berbeda:
 * turun sedikit tiap hari, atau tutup empat hari. Keduanya terbaca sama di
 * laporan bulanan, dan yang harus dikerjakan Coordinator Area berbeda jauh.
 *
 * BENTUKNYA SENGAJA PADAT. Tiga puluh satu kolom tidak muat di layar mana pun,
 * jadi yang dijaga bukan "semuanya terlihat sekaligus" melainkan "yang
 * menggeser tidak kehilangan barisnya": nomor, nama outlet, dan total bulan ini
 * menempel di kiri, dan sisanya bergeser di bawahnya.
 */

const BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

const labelBulan = (periode: string) => {
  const [th, bl] = periode.split("-").map(Number);
  return `${BULAN[bl - 1]} ${th}`;
};

const geserBulan = (periode: string, arah: number) => {
  const [th, bl] = periode.split("-").map(Number);
  const t = new Date(Date.UTC(th, bl - 1 + arah, 1));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}`;
};

/** Lebar kolom yang menempel — dipakai tajuk dan isinya, jadi satu angka saja. */
const L_NO = 44;
const L_NAMA = 210;
const L_BULAN = 150;

function Ubah({ nilai, besar = false }: { nilai: number | null; besar?: boolean }) {
  if (nilai === null) return null;
  const naik = nilai >= 0;
  const Ikon = naik ? TrendingUp : TrendingDown;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 tabular-nums",
        besar ? "text-[11.5px] font-semibold" : "text-[10.5px]",
        naik ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400",
      )}
    >
      <Ikon className={besar ? "size-3.5" : "size-3"} />
      {formatNumber(Math.abs(nilai), { maximumFractionDigits: 0 })}%
    </span>
  );
}

function SelHari({ nilai, ubah }: { nilai: number | null; ubah: number | null }) {
  if (nilai === null) {
    return (
      <td className="border-l border-border/60 px-2 py-1.5 text-center align-middle">
        {/* Belum ditarik dari ESB — BUKAN nol. Nol berarti outletnya tidak
            berjualan sehari penuh, dan itu tuduhan yang berbeda jauh. */}
        <span className="text-[11px] text-muted-foreground/50">—</span>
      </td>
    );
  }
  return (
    <td className="border-l border-border/60 px-2 py-1.5 text-right align-middle">
      <span className="block whitespace-nowrap text-[11.5px] font-medium tabular-nums text-foreground">
        {formatIDRShort(nilai)}
      </span>
      <Ubah nilai={ubah} />
    </td>
  );
}

function Baris({
  baris,
  nomor,
  kolom,
  tebal = false,
}: {
  baris: BarisHarian;
  nomor: number | null;
  kolom: DetailHarian["kolom"];
  tebal?: boolean;
}) {
  const dasar = tebal ? "bg-muted" : "bg-card";
  return (
    <tr className={cn("border-t border-border", tebal ? "bg-muted font-semibold" : "hover:bg-muted/40")}>
      <td className={cn("sticky z-20 px-2 py-1.5 text-center text-[11px] tabular-nums text-muted-foreground", dasar)} style={{ left: 0, width: L_NO }}>
        {nomor ?? ""}
      </td>
      <td className={cn("sticky z-20 px-3 py-1.5", dasar)} style={{ left: L_NO, width: L_NAMA }}>
        <span className="block truncate text-[12.5px] font-medium text-foreground" title={baris.nama}>
          {baris.nama}
        </span>
        <span className="block truncate text-[10.5px] text-muted-foreground">{baris.area}</span>
      </td>
      <td
        className={cn("sticky z-20 border-r border-border px-3 py-1.5 text-right", dasar)}
        style={{ left: L_NO + L_NAMA, width: L_BULAN }}
      >
        <span className="block whitespace-nowrap text-[12.5px] font-semibold tabular-nums text-foreground">
          {baris.bulanIni === null ? "—" : formatIDR(baris.bulanIni)}
        </span>
        <Ubah nilai={baris.mom} besar />
      </td>
      {kolom.map((h, i) => (
        <SelHari key={h.tanggal} nilai={baris.hari[i] ?? null} ubah={baris.ubah[i] ?? null} />
      ))}
    </tr>
  );
}

export function TabelHarian({ detail, bisaGantiBulan = true }: { detail: DetailHarian; bisaGantiBulan?: boolean }) {
  const router = useRouter();
  const pindah = (periode: string) => router.push(`/operation/daily?bulan=${periode}`);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {bisaGantiBulan && (
          <div className="inline-flex items-center gap-1 rounded-lg border border-border bg-card p-0.5">
            <button
              type="button"
              aria-label="Bulan sebelumnya"
              onClick={() => pindah(geserBulan(detail.periode, -1))}
              className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="min-w-[9rem] px-2 text-center text-[13px] font-medium text-foreground">
              {labelBulan(detail.periode)}
            </span>
            <button
              type="button"
              aria-label="Bulan berikutnya"
              onClick={() => pindah(geserBulan(detail.periode, 1))}
              className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        )}
        <span className="text-[12px] text-muted-foreground">
          {detail.baris.length} outlet · persentase tiap hari dibandingkan hari sebelumnya
        </span>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-max min-w-full border-collapse text-left">
          <thead>
            <tr className="bg-muted">
              <th className="sticky z-30 bg-muted px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground" style={{ left: 0, width: L_NO }}>
                #
              </th>
              <th className="sticky z-30 bg-muted px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground" style={{ left: L_NO, width: L_NAMA }}>
                Nama Outlet
              </th>
              <th
                className="sticky z-30 border-r border-border bg-muted px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                style={{ left: L_NO + L_NAMA, width: L_BULAN }}
              >
                Bulan Ini
                <span className="block text-[9.5px] font-normal normal-case tracking-normal">
                  dibanding tanggal yang sama bulan lalu
                </span>
              </th>
              {detail.kolom.map((h) => (
                <th
                  key={h.tanggal}
                  className={cn(
                    "min-w-[5.6rem] border-l border-border/60 px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wide",
                    // Akhir pekan ditandai: pola naik-turun penjualan F&B
                    // hampir selalu mengikuti hari, dan tanpa penanda ini
                    // setiap Sabtu terbaca sebagai lonjakan yang tak
                    // dijelaskan.
                    h.pekan ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground",
                  )}
                >
                  {String(h.tanggal).padStart(2, "0")}
                  <span className="block text-[9px] font-normal">{h.hari}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {detail.baris.map((b, i) => (
              <Baris key={b.outletId} baris={b} nomor={i + 1} kolom={detail.kolom} />
            ))}
            {detail.baris.length === 0 && (
              <tr>
                <td colSpan={3 + detail.kolom.length} className="px-4 py-8 text-center text-[13px] text-muted-foreground">
                  Belum ada outlet yang bisa ditampilkan di sini.
                </td>
              </tr>
            )}
          </tbody>
          {detail.total && (
            <tfoot>
              <Baris baris={detail.total} nomor={null} kolom={detail.kolom} tebal />
            </tfoot>
          )}
        </table>
      </div>

      {detail.tanpaCabang.length > 0 && (
        <p className="text-[11.5px] leading-relaxed text-muted-foreground">
          {detail.tanpaCabang.length} outlet belum dipasangkan ke cabang ESB, jadi belum punya angka harian:{" "}
          {detail.tanpaCabang.join(", ")}.
        </p>
      )}
      <p className="text-[11.5px] leading-relaxed text-muted-foreground">
        Angkanya net sales dari ESB, ditarik sendiri oleh sistem hari demi hari. Tanggal bertanda “—” belum sampai
        penarikannya — itu bukan nol, dan bukan outlet yang tidak berjualan.
      </p>
    </div>
  );
}
