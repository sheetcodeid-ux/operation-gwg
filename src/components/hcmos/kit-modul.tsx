"use client";

import * as React from "react";
import { Maximize2, Minimize2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PanduanModul } from "@/components/hcmos/panduan-modul";
import { cn } from "@/lib/utils";

/**
 * Perkakas bersama modul HC-MOS.
 *
 * MENGAPA DIJADIKAN SATU. Struktur Organisasi dan Matriks RACI sudah dinaikkan
 * lebih dulu, dan keduanya berakhir dengan bentuk yang sama: satu batang alat
 * berisi identitas modul, pencarian yang melaporkan "n dari total", saringan,
 * pengalih tampilan, tombol bersihkan yang hanya muncul saat memang sedang
 * menyaring, panduan, dan layar penuh — lalu isinya memakai sisa tinggi layar,
 * dengan legenda yang bisa diklik di kaki.
 *
 * Menyalin bentuk itu ke halaman ketiga dan seterusnya berarti menyalin juga
 * setiap perbaikan kecilnya satu per satu, dan halaman yang terlewat perlahan
 * berbeda sendiri. Yang di sini bukan gaya, melainkan perilaku: penghitung yang
 * jujur, tombol bersihkan yang tahu kapan dirinya berguna, dan layar penuh yang
 * benar-benar melepaskan tinggi halamannya.
 *
 * Bentuknya sengaja tidak memaksakan isi: tiap modul menyerahkan saringan,
 * pengalih tampilan, dan aksinya sendiri sebagai slot.
 */

/* ─────────────────────────────── layar penuh ─────────────────────────────── */

/**
 * Layar penuh untuk satu bingkai modul.
 *
 * Dipisah jadi hook karena bagian yang mudah keliru bukan tombolnya, melainkan
 * mendengarkan `fullscreenchange`: tanpa itu, keluar lewat Esc membuat tombolnya
 * tetap menampilkan "keluar layar penuh" padahal sudah keluar.
 */
export function useLayarPenuh() {
  const bingkai = React.useRef<HTMLDivElement>(null);
  const [layarPenuh, setLayarPenuh] = React.useState(false);

  React.useEffect(() => {
    const ganti = () => setLayarPenuh(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", ganti);
    return () => document.removeEventListener("fullscreenchange", ganti);
  }, []);

  const alih = React.useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void bingkai.current?.requestFullscreen?.();
  }, []);

  return { bingkai, layarPenuh, alih };
}

export function TombolLayarPenuh({ layarPenuh, onAlih }: { layarPenuh: boolean; onAlih: () => void }) {
  return (
    <Button
      variant="outline"
      size="icon"
      aria-label={layarPenuh ? "Keluar layar penuh" : "Layar penuh"}
      onClick={onAlih}
    >
      {layarPenuh ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
    </Button>
  );
}

/* ──────────────────────────────── kerangka ──────────────────────────────── */

/**
 * Bingkai modul setinggi layar.
 *
 * `min-h-0` pada rantai flex-nya bukan hiasan: tanpa itu, isi yang panjang
 * mendorong bingkainya melar melewati tinggi layar dan batang alatnya ikut
 * tergulir keluar — persis yang tidak diinginkan dari modul yang dipakai
 * berlama-lama.
 */
export const KerangkaModul = React.forwardRef<HTMLDivElement, { className?: string; children: React.ReactNode }>(
  function KerangkaModul({ className, children }, ref) {
    return (
      <div
        ref={ref}
        className={cn(
          "flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card",
          // Di halaman biasa tidak ada induk flex setinggi layar, jadi bingkainya
          // akan menciut mengikuti isinya; tinggi minimum ini yang membuatnya
          // tetap terbaca sebagai satu ruang kerja. Di halaman layar-penuh
          // (`flex-1`) angka ini tidak berpengaruh apa-apa.
          "min-h-[70vh]",
          // Saat benar-benar layar penuh, sudut membulat dan tinggi minimum tadi
          // justru menyisakan pita kosong di bawahnya.
          "[&:fullscreen]:h-screen [&:fullscreen]:rounded-none [&:fullscreen]:border-0",
          className,
        )}
      >
        {children}
      </div>
    );
  },
);

/* ─────────────────────────────── batang alat ─────────────────────────────── */

export interface HitungTampil {
  tampil: number;
  total: number;
}

export function BilahModul({
  ikon: Ikon,
  gradien = "from-slate-500 via-slate-600 to-slate-700",
  judul,
  ringkas,
  cari,
  onCari,
  cariPlaceholder = "Cari…",
  hitung,
  menyaring = false,
  onBersihkan,
  panduan,
  saringan,
  tampilan,
  aksi,
  layarPenuh,
  onLayarPenuh,
}: {
  ikon: React.ComponentType<{ className?: string }>;
  /** Kelas gradien Tailwind untuk kotak ikonnya — penanda modul, bukan hiasan. */
  gradien?: string;
  judul: string;
  /** Baris angka di bawah judul: berapa barisnya, berapa cabangnya, dan seterusnya. */
  ringkas: React.ReactNode;
  cari?: string;
  onCari?: (v: string) => void;
  cariPlaceholder?: string;
  /** Penghitung "n/total" — hanya tampil saat memang sedang menyaring. */
  hitung?: HitungTampil;
  menyaring?: boolean;
  onBersihkan?: () => void;
  /** Id panduan halaman ini. */
  panduan?: string;
  saringan?: React.ReactNode;
  tampilan?: React.ReactNode;
  aksi?: React.ReactNode;
  layarPenuh?: boolean;
  onLayarPenuh?: () => void;
}) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-gradient-to-b from-muted/50 to-transparent px-3 py-2.5">
      <span
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br text-white shadow-md",
          gradien,
        )}
      >
        <Ikon className="size-5" />
      </span>

      <div className="mr-auto min-w-0">
        <p className="truncate text-[15px] font-semibold leading-tight tracking-tight text-foreground">{judul}</p>
        <p className="truncate text-[11px] leading-tight text-muted-foreground">{ringkas}</p>
      </div>

      {onCari && (
        <div className="relative order-last w-full sm:order-none sm:w-56">
          <Input
            value={cari ?? ""}
            onChange={(e) => onCari(e.target.value)}
            placeholder={cariPlaceholder}
            className="h-9 pr-16"
          />
          {/* Angkanya hanya berarti saat ada yang disaring. Ditampilkan terus,
              ia cuma mengulang jumlah yang sudah tertulis di ringkasan. */}
          {menyaring && hitung && (
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
              {hitung.tampil}/{hitung.total}
            </span>
          )}
        </div>
      )}

      {saringan}
      {tampilan}

      {menyaring && onBersihkan && (
        <Button variant="ghost" size="sm" className="gap-1.5 px-2" onClick={onBersihkan}>
          <X className="size-4" /> Bersihkan
        </Button>
      )}

      {aksi}
      {panduan && <PanduanModul panduan={panduan} />}
      {onLayarPenuh && <TombolLayarPenuh layarPenuh={!!layarPenuh} onAlih={onLayarPenuh} />}
    </div>
  );
}

/* ──────────────────────────────── legenda ──────────────────────────────── */

export interface ButirLegenda {
  key: string;
  /** Lencana pendek di kotak berwarna — satu sampai tiga huruf. */
  kode: string;
  label: string;
  jumlah: number;
  /** Dua warna gradien kotaknya. */
  warna: [string, string];
  /** Keterangan lengkap saat kursor berhenti di atasnya. */
  judulPenuh?: string;
}

/**
 * Legenda di kaki modul: jumlah per kategori, batang perbandingannya, dan
 * saringan sekali klik.
 *
 * Batangnya dibandingkan terhadap kategori TERBESAR, bukan terhadap total.
 * Terhadap total, kategori kecil menjadi garis yang tidak terlihat sama sekali
 * dan legendanya berhenti menjawab pertanyaan yang dibawa orang ke sini —
 * mana yang paling banyak, dan seberapa jauh jaraknya.
 */
export function LegendaHitung({
  butir,
  sorot,
  onSorot,
  kiri,
  kanan,
}: {
  butir: ButirLegenda[];
  sorot?: string | null;
  onSorot?: (key: string) => void;
  kiri?: React.ReactNode;
  kanan?: React.ReactNode;
}) {
  const puncak = Math.max(1, ...butir.map((b) => b.jumlah));

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-t border-border bg-gradient-to-t from-muted/40 to-transparent px-3 py-2">
      {kiri}

      <div className="scroll-fade-x flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
        {butir.map((b) => {
          const aktif = sorot === b.key;
          const isi = (
            <>
              <span
                className="grid size-5 shrink-0 place-items-center rounded-md text-[9px] font-bold text-white"
                style={{ backgroundImage: `linear-gradient(135deg, ${b.warna[0]}, ${b.warna[1]})` }}
              >
                {b.kode}
              </span>
              <span className="hidden text-[10px] font-medium leading-none text-foreground md:block">{b.label}</span>
              <span className="hidden h-1 w-8 overflow-hidden rounded-full bg-muted lg:block">
                <span
                  className="block h-full rounded-full"
                  style={{ width: `${(b.jumlah / puncak) * 100}%`, background: b.warna[0] }}
                />
              </span>
              <span className="text-[10px] font-semibold tabular-nums leading-none text-muted-foreground">
                {b.jumlah}
              </span>
            </>
          );

          const kelas = cn(
            "flex shrink-0 items-center gap-1.5 rounded-lg border px-1.5 py-1 transition-colors",
            aktif ? "border-foreground/40 bg-muted" : "border-border bg-card",
            onSorot && "hover:border-foreground/25",
          );

          return onSorot ? (
            <button
              key={b.key}
              type="button"
              onClick={() => onSorot(b.key)}
              title={`${b.judulPenuh ?? b.label} — ${b.jumlah}. Klik untuk menyaring.`}
              className={kelas}
            >
              {isi}
            </button>
          ) : (
            <span key={b.key} title={`${b.judulPenuh ?? b.label} — ${b.jumlah}`} className={kelas}>
              {isi}
            </span>
          );
        })}
      </div>

      {kanan}
    </div>
  );
}

/** Penanda hak: bisa menyunting, atau hanya melihat. */
export function LencanaHak({ bolehUbah, catatan }: { bolehUbah: boolean; catatan?: string }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-lg px-2 py-1 text-[11px] font-semibold",
        bolehUbah ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground",
      )}
    >
      {bolehUbah ? (catatan ?? "Bisa disunting") : "Mode hanya lihat"}
    </span>
  );
}
