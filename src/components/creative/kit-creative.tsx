"use client";

import * as React from "react";
import { Check, ChevronDown, CircleDashed, Search, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { NAV_ICONS } from "@/components/layout/icons";
import { Popover } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * Perkakas tampilan khas Creative.
 *
 * SENGAJA TERPISAH DARI KIT HC. Keduanya sempat memakai kerangka yang sama dan
 * hasilnya modul Creative terasa seperti tamu di halaman Human Capital: bilah
 * modul yang padat, tombol layar-penuh, legenda yang menempel di kaki layar —
 * semuanya dirancang untuk layar HC yang isinya tabel panjang dan harus dibaca
 * berjam-jam.
 *
 * Yang dibutuhkan Creative berbeda. Layarnya dibuka sebentar, untuk satu
 * pertanyaan: siapa yang permintaannya selalu mendadak bulan ini. Maka
 * bentuknya halaman yang mengalir, bukan bingkai kaku: pita judul, deretan
 * angka, satu bilah saringan, lalu tabelnya.
 *
 * Yang TETAP sama dengan seluruh aplikasi: token warna, radius, dan komponen
 * dasarnya. Yang berbeda gaya harus tetap satu keluarga — kalau tidak, yang
 * lahir bukan identitas melainkan halaman yang terlihat salah pasang.
 */

/* ─────────────────────────────── pita judul ─────────────────────────────── */

export function PitaCreative({
  ikon,
  eyebrow,
  judul,
  ringkas,
  aksi,
}: {
  /**
   * NAMA ikonnya, bukan komponennya.
   *
   * Pita ini dipakai halaman server maupun komponen klien. Komponen React
   * adalah fungsi, dan fungsi tidak bisa menyeberangi batas server→klien:
   * mengirimnya sebagai prop pernah mematikan enam halaman sekaligus dengan
   * "An error occurred in the Server Components render" — dan tsc, lint, tes,
   * serta build semuanya hijau, karena tak satu pun dari mereka merender apa
   * pun. Nama ikon menutup seluruh kelas kesalahan itu.
   */
  ikon: string;
  eyebrow?: string;
  judul: string;
  ringkas?: React.ReactNode;
  aksi?: React.ReactNode;
}) {
  const Ikon = NAV_ICONS[ikon] ?? CircleDashed;
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card">
      {/* Rona hangat khas Creative — tipis saja. Yang dibaca angkanya, dan
          spanduk yang terlalu ramai membuat angkanya jadi latar belakang. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.09] dark:opacity-[0.14]"
        style={{ background: "radial-gradient(120% 140% at 0% 0%, #f43f5e 0%, #f97316 38%, transparent 72%)" }}
      />
      {/* Membungkus di ponsel, satu baris di layar lebar: dengan `flex-wrap`
          saja, ringkasan yang panjang mendorong tombolnya turun ke bawah judul
          dan pita ini kehilangan sisi kanannya. */}
      <div className="relative flex flex-wrap items-start gap-3 p-4 sm:flex-nowrap sm:items-center sm:gap-4 sm:p-5">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-rose-500 via-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/25">
          <Ikon className="size-5.5" />
        </span>
        <div className="mr-auto min-w-0">
          {eyebrow && (
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-orange-600 dark:text-orange-400">
              {eyebrow}
            </p>
          )}
          <h1 className="truncate text-lg font-semibold tracking-tight text-foreground sm:text-xl">{judul}</h1>
          {ringkas && <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground">{ringkas}</p>}
        </div>
        {aksi && <div className="flex shrink-0 flex-wrap items-center gap-2">{aksi}</div>}
      </div>
    </div>
  );
}

/* ────────────────────────────── deretan angka ────────────────────────────── */

export interface Angka {
  ikon: LucideIcon;
  label: string;
  nilai: React.ReactNode;
  sub?: string;
  /** Rona aksen — dipakai hemat, hanya untuk angka yang memang perlu disorot. */
  sorot?: "netral" | "bahaya" | "aman";
}

/**
 * Angka-angka utama dalam SATU kartu bersekat, bukan empat kartu terpisah.
 *
 * Empat kartu membuat keempatnya tampak setara dan berdiri sendiri. Angka di
 * sini justru saling menjelaskan — "80% mendadak" tidak berarti apa-apa tanpa
 * "dari 25 permintaan" di sebelahnya.
 */
export function StripAngka({ butir }: { butir: Angka[] }) {
  return (
    <div className="grid grid-cols-2 overflow-hidden rounded-2xl border border-border bg-card lg:grid-cols-4">
      {butir.map((b, i) => (
        <div
          key={b.label}
          className={cn(
            "flex min-w-0 items-start gap-3 p-4",
            // Sekatnya ditulis per kotak, bukan lewat `divide-*`: di grid yang
            // berubah dari dua kolom ke empat, `divide-x` ikut menggaris kotak
            // pertama baris kedua — garis yang menggantung di tengah kartu.
            i % 2 === 1 && "border-l border-border", // kolom kanan saat dua kolom
            i < 2 && "border-b border-border lg:border-b-0", // baris atas saat dua kolom
            i > 0 && "lg:border-l lg:border-border",
          )}
        >
          <span
            className={cn(
              "grid size-9 shrink-0 place-items-center rounded-xl ring-1",
              b.sorot === "bahaya"
                ? "bg-red-500/10 text-red-600 ring-red-500/20 dark:text-red-400"
                : b.sorot === "aman"
                  ? "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 dark:text-emerald-400"
                  : "bg-muted text-muted-foreground ring-border",
            )}
          >
            <b.ikon className="size-4.5" />
          </span>
          <div className="min-w-0">
            {/* Sengaja TIDAK dipotong: di ponsel "Mendadak (H-1 / hari-H)"
                menyusut jadi "MENDADAK (…" — judul angka yang tidak terbaca
                membuat angkanya ikut tidak berarti. Dibiarkan turun baris. */}
            <p className="text-[11px] font-medium uppercase leading-tight tracking-wide text-muted-foreground">{b.label}</p>
            <p className="mt-1 truncate text-xl font-semibold tabular-nums tracking-tight text-foreground">{b.nilai}</p>
            {b.sub && <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">{b.sub}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ──────────────────────────────── saringan ──────────────────────────────── */

/**
 * Kotak cari.
 *
 * Penghitung "n dari total" ditaruh DI LUAR kotaknya. Sebelumnya ia menempel di
 * dalam sebagai lencana melayang, dan akibatnya persis terlihat: teks
 * pancingannya terpotong di tengah kata — "Cari outlet, pemohon, a" — karena
 * ruang kanannya sudah dipesan untuk angka yang bahkan belum tentu muncul.
 */
export function KotakCari({
  nilai,
  onNilai,
  placeholder = "Cari…",
  hitung,
  className,
}: {
  nilai: string;
  onNilai: (v: string) => void;
  placeholder?: string;
  hitung?: { tampil: number; total: number } | null;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 items-center gap-2", className)}>
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={nilai}
          onChange={(e) => onNilai(e.target.value)}
          placeholder={placeholder}
          className="h-9 w-full rounded-lg border border-input bg-background/40 pl-9 pr-8 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/25 dark:bg-input/30"
        />
        {nilai && (
          <button
            type="button"
            onClick={() => onNilai("")}
            aria-label="Kosongkan pencarian"
            className="absolute right-2 top-1/2 grid size-5 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
      {hitung && (
        <span className="shrink-0 rounded-lg border border-border bg-muted/50 px-2 py-1 text-[11px] font-semibold tabular-nums text-muted-foreground">
          {hitung.tampil}/{hitung.total}
        </span>
      )}
    </div>
  );
}

export interface PilihanDropdown {
  value: string;
  label: string;
  /** Bulatan warna di kiri label — dipakai saringan merah/kuning/hijau. */
  warna?: string;
  hint?: string;
}

/**
 * Dropdown khas Creative.
 *
 * Dibuat sendiri, bukan memakai `Combobox`, karena satu alasan yang tidak bisa
 * ditawar di layar ini: pilihannya harus membawa BULATAN WARNA. Saringan label
 * tanpa warna memaksa orang membaca kata "merah" alih-alih melihatnya, dan
 * seluruh gunanya lampu merah-kuning-hijau justru itu.
 */
export function DropdownCreative({
  pilihan,
  nilai,
  onNilai,
  ikon: Ikon,
  className,
  lebarMenu = "min-w-[13rem]",
}: {
  pilihan: PilihanDropdown[];
  nilai: string;
  onNilai: (v: string) => void;
  ikon?: LucideIcon;
  className?: string;
  lebarMenu?: string;
}) {
  const terpilih = pilihan.find((p) => p.value === nilai) ?? pilihan[0];

  return (
    <Popover
      portal
      className={cn("shrink-0", className)}
      contentClassName={cn("p-1", lebarMenu)}
      trigger={({ open, toggle }) => (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          className={cn(
            "inline-flex h-9 w-full items-center gap-2 rounded-lg border border-border bg-card px-2.5 text-sm text-foreground shadow-sm transition-colors hover:bg-muted/50",
            open && "border-ring ring-2 ring-ring/25",
          )}
        >
          {terpilih?.warna ? (
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: terpilih.warna }} />
          ) : (
            Ikon && <Ikon className="size-4 shrink-0 text-muted-foreground" />
          )}
          <span className="min-w-0 flex-1 truncate text-left">{terpilih?.label ?? "—"}</span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        </button>
      )}
    >
      {(tutup) => (
        <div className="max-h-72 overflow-y-auto">
          {pilihan.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => {
                onNilai(p.value);
                tutup();
              }}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted",
                p.value === nilai && "bg-muted/60",
              )}
            >
              {p.warna ? (
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: p.warna }} />
              ) : (
                <span className="size-2.5 shrink-0" />
              )}
              <span className="min-w-0 flex-1 truncate">{p.label}</span>
              {p.hint && <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{p.hint}</span>}
              {p.value === nilai && <Check className="size-3.5 shrink-0 text-foreground" />}
            </button>
          ))}
        </div>
      )}
    </Popover>
  );
}

/** Bilah saringan — satu baris di layar lebar, menumpuk rapi di ponsel. */
export function BilahSaring({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-2.5">{children}</div>
  );
}

/* ──────────────────────────────── tabel ──────────────────────────────── */

export function KartuTabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-2xl border border-border bg-card", className)}>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

export function Th({
  children,
  className = "",
  align = "left",
}: {
  children: React.ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
}) {
  return (
    <th
      className={cn(
        "whitespace-nowrap px-3 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground",
        align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  className = "",
  align = "left",
}: {
  children: React.ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
}) {
  return (
    <td
      className={cn(
        "px-3 py-3 align-middle",
        align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left",
        className,
      )}
    >
      {children}
    </td>
  );
}

/** Batang persentase mendadak — angka mentah sulit dibandingkan sekilas. */
export function BatangPersen({ persen, warna }: { persen: number; warna: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className="h-1.5 w-14 shrink-0 overflow-hidden rounded-full bg-muted">
        <span
          className="block h-full rounded-full transition-[width]"
          // 0% berarti kosong, bukan puntung warna selebar 2% — batang yang
          // tidak pernah benar-benar kosong membuat "tidak pernah mendadak"
          // terlihat seperti "sedikit mendadak".
          style={{ width: `${persen <= 0 ? 0 : Math.max(3, Math.min(100, persen))}%`, background: warna }}
        />
      </span>
      <span className="tabular-nums">{persen}%</span>
    </span>
  );
}

export function KosongCreative({ judul, uraian }: { judul: string; uraian?: string }) {
  return (
    <div className="px-6 py-14 text-center">
      <p className="text-sm font-medium text-foreground">{judul}</p>
      {uraian && <p className="mx-auto mt-1 max-w-md text-[12.5px] leading-relaxed text-muted-foreground">{uraian}</p>}
    </div>
  );
}
