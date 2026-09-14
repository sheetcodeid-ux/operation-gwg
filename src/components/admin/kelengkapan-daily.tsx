"use client";

import * as React from "react";
import { CheckCircle2, Database, Loader2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { kejarDailyAction } from "@/lib/actions/kejar-daily";
import type { KelengkapanDaily } from "@/lib/data/kelengkapan-daily";
import { cn, formatNumber } from "@/lib/utils";

const BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];
const labelBulan = (periode: string) => BULAN[Number(periode.split("-")[1]) - 1] ?? periode;

/**
 * KELENGKAPAN DAILY — dan tombol untuk mengejarnya.
 *
 * Daily menghitung hari yang belum ditarik sebagai nol jualan. Selama
 * lubangnya ada, tiap outlet yang datanya tertinggal terbaca lebih buruk
 * daripada keadaannya, dan halaman itu dipakai mengambil keputusan. Jadi yang
 * dijawab di sini bukan "apakah cron jalan" melainkan "berapa yang kurang, dan
 * bisakah saya menutupnya sekarang".
 *
 * Tombolnya menjalankan SATU JENDELA WAKTU, bukan seluruh sisanya. ESB melayani
 * satu panggilan pada satu waktu dan Vercel memutus permintaan di detik ke-60 —
 * janji "sekali pencet langsung penuh" pasti dilanggar. Yang dijanjikan di sini
 * hanya yang bisa ditepati: sekian terisi, sekian sisa, pencet lagi kalau mau
 * lanjut.
 */
export function KelengkapanDailyPanel({ awal }: { awal: KelengkapanDaily }) {
  const [data, setData] = React.useState(awal);
  const [jalan, setJalan] = React.useState(false);

  const kejar = async () => {
    setJalan(true);
    try {
      const h = await kejarDailyAction();
      if (h.error) {
        toast.error(h.error);
      } else if (h.terisi === 0) {
        toast.success("Tidak ada lagi yang bisa ditarik untuk sekarang.");
      } else {
        toast.success(`${formatNumber(h.terisi)} hari-outlet terisi dari ${h.cabang} cabang.`);
      }
      // Angkanya diperbarui walau ada galat: sebagian mungkin sempat masuk
      // sebelum ESB berhenti menjawab.
      setData((d) => ({ ...d, kurang: h.sisa, ada: d.wajib - h.sisa, persen: h.persen }));
    } finally {
      setJalan(false);
    }
  };

  const penuh = data.kurang <= 0;

  return (
    <div className="card-gradient mb-4 rounded-2xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Database className="size-4 text-muted-foreground" />
            Kelengkapan Data Daily
          </h2>
          <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
            Daily membaca satu baris per cabang per tanggal. Hari yang belum ditarik ikut terhitung{" "}
            <b>nol jualan</b> — jadi selama ini belum penuh, outlet yang datanya tertinggal terbaca lebih buruk
            daripada keadaannya.
          </p>
        </div>
        <button
          type="button"
          onClick={kejar}
          disabled={jalan || penuh}
          className={cn(
            "inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-[13px] font-medium transition-colors",
            penuh
              ? "cursor-default border border-border bg-card text-muted-foreground"
              : "bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-60",
          )}
        >
          {jalan ? <Loader2 className="size-4 animate-spin" /> : penuh ? <CheckCircle2 className="size-4" /> : null}
          {jalan ? "Menarik…" : penuh ? "Sudah lengkap" : "Tarik sekarang"}
        </button>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full rounded-full transition-[width] duration-500", penuh ? "bg-emerald-500" : "bg-amber-500")}
            style={{ width: `${Math.min(100, Math.max(0, data.persen))}%` }}
          />
        </div>
        <span className="shrink-0 text-[13px] font-semibold tabular-nums text-foreground">
          {formatNumber(data.persen, { maximumFractionDigits: 1 })}%
        </span>
      </div>

      <p className="mt-2 text-[12px] tabular-nums text-muted-foreground">
        {formatNumber(data.ada)} dari {formatNumber(data.wajib)} hari-outlet sejak 1 Januari, atas {data.cabang} cabang
        {penuh ? "." : ` — kurang ${formatNumber(data.kurang)}.`}
      </p>

      {!penuh && (
        <>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {data.bulan.map((b) => (
              <span
                key={b.periode}
                title={`${formatNumber(b.ada)} dari ${formatNumber(b.wajib)}`}
                className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-1 text-[11px] font-medium text-amber-700 dark:text-amber-400"
              >
                <TriangleAlert className="size-3" />
                {labelBulan(b.periode)} {formatNumber((b.ada / b.wajib) * 100, { maximumFractionDigits: 0 })}%
              </span>
            ))}
          </div>
          <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">
            Sekali pencet menjalankan <b>satu jendela waktu</b>, bukan seluruh sisanya — ESB hanya melayani satu
            panggilan pada satu waktu, dan satu panggilan hanya untuk satu cabang satu tanggal. Pencet lagi untuk
            melanjutkan dari tempatnya berhenti. Cron per jam juga tetap mengisi sendiri di belakang layar.
          </p>
        </>
      )}
    </div>
  );
}
