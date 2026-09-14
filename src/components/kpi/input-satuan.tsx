"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import type { Satuan } from "@/lib/kpi/satuan";
import { formatNumber } from "@/lib/utils";

/**
 * Kotak angka yang TAHU SATUANNYA — satu kotak untuk seluruh form KPI.
 *
 * Sebelumnya tiap form membuat kotak polosnya sendiri: yang mengisi Follower
 * Growth mengetik "-25" dan yang terbaca di layar juga "-25", padahal
 * indikatornya persen. Angka tanpa satuan di sebelah angka bersatuan membuat
 * orang menebak — dan tebakan yang salah baru ketahuan sebulan kemudian, saat
 * angkanya sudah ikut dihitung.
 *
 * Satuannya ditempel di dalam kotaknya, bukan cuma di keterangan di bawah:
 * yang sedang mengetik melihat kolom isiannya, bukan tulisan kecil di bawahnya.
 */

/**
 * Angka yang DIKETIK ORANG — dibaca dengan aturan Indonesia.
 *
 * Titik pemisah ribuan, koma pemisah desimal. Ini bukan selera: "27.908"
 * diketik orang yang bermaksud dua puluh tujuh ribu, dan `Number()` bawaan
 * membacanya 27,908 — seribu kali lebih kecil, tetap terlihat seperti angka
 * yang sah, dan tidak ada yang akan memeriksanya lagi. Satu angka seperti itu
 * sudah tersimpan di KPI Sosial Media bulan Agustus.
 *
 * Titik TETAP dibaca sebagai desimal kalau bentuknya jelas bukan ribuan —
 * "-178.50" berkoma dua angka, dan menolak membacanya sebagai desimal hanya
 * memindahkan kesalahan yang sama ke arah sebaliknya.
 */
export function angkaKetik(v: string): number | null {
  const t = String(v).trim().replace(/\s/g, "");
  if (t === "" || t === "-") return null;
  const minus = t.startsWith("-");
  const badan = t.replace(/^[+-]/, "").replace(/[^\d.,]/g, "");
  if (badan === "") return null;

  let angka: string;
  if (badan.includes(",")) {
    // Ada koma: komanya desimal, titiknya ribuan. Tidak ada ambiguitas lagi.
    angka = badan.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(badan)) {
    // Seluruh kelompoknya pas tiga angka — itu pemisah ribuan, bukan desimal.
    angka = badan.replace(/\./g, "");
  } else {
    angka = badan.replace(/\.(?=.*\.)/g, "");
  }

  const n = Number(angka);
  if (!Number.isFinite(n)) return null;
  return minus ? -n : n;
}

/** Angka untuk dikirim ke server — kosong berarti nol, bukan gagal. */
export const angkaKetikNol = (v: string): number => angkaKetik(v) ?? 0;

const AWALAN: Partial<Record<Satuan, string>> = { rupiah: "Rp" };
const AKHIRAN: Partial<Record<Satuan, string>> = { persen: "%" };

export function InputSatuan({
  nilai,
  onUbah,
  satuan = "angka",
  izinkanMinus = true,
  disabled,
  className,
  placeholder,
  tinggi = "h-9",
}: {
  nilai: string;
  onUbah: (v: string) => void;
  satuan?: Satuan;
  /**
   * Minus boleh diketik. Bawaannya BOLEH: follower yang turun, laba yang rugi,
   * dan pertumbuhan yang menyusut adalah kenyataan yang harus bisa ditulis apa
   * adanya. Yang dimatikan hanya kotak yang memang tidak mungkin minus.
   */
  izinkanMinus?: boolean;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  tinggi?: string;
}) {
  const awalan = AWALAN[satuan];
  const akhiran = AKHIRAN[satuan];
  const angka = angkaKetik(nilai);

  // Rupiah dirapikan sambil diketik — "168000000" dan "168.000.000" terbaca
  // sangat berbeda, dan nol yang kelebihan satu hampir mustahil terlihat tanpa
  // pemisah ribuan. Persen dan angka biasa dibiarkan apa adanya: angkanya
  // pendek, dan merapikannya sambil diketik justru melompatkan kursor setiap
  // kali ada koma desimal.
  const tampil =
    satuan === "rupiah"
      ? angka === null
        ? nilai.trim().startsWith("-") && izinkanMinus
          ? "-"
          : ""
        : formatNumber(angka)
      : nilai;

  return (
    <div className="relative">
      {awalan && (
        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[12px] text-muted-foreground">
          {awalan}
        </span>
      )}
      <Input
        // `decimal`, bukan `numeric`: papan ketik angka di ponsel tidak
        // menyediakan koma maupun minus, dan indikator persen memerlukan
        // keduanya.
        inputMode="decimal"
        className={`${tinggi} text-right tabular-nums ${awalan ? "pl-8" : ""} ${akhiran ? "pr-7" : ""} ${
          angka !== null && angka < 0 ? "text-rose-600 dark:text-rose-400" : ""
        } ${className ?? ""}`}
        placeholder={placeholder ?? "0"}
        disabled={disabled}
        value={tampil}
        onChange={(e) => {
          const mentah = e.target.value;
          const minus = izinkanMinus && mentah.trim().startsWith("-");
          const bersih = mentah.replace(satuan === "rupiah" ? /[^\d]/g : /[^\d.,]/g, "");
          onUbah(minus ? `-${bersih}` : bersih);
        }}
      />
      {akhiran && (
        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[12px] text-muted-foreground">
          {akhiran}
        </span>
      )}
    </div>
  );
}
