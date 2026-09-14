"use client";

import * as React from "react";
import { CheckCircle2, Database, Loader2, Square, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { kejarDailyAction } from "@/lib/actions/kejar-daily";
import type { KelengkapanDaily } from "@/lib/data/kelengkapan-daily";
import { cn, formatNumber } from "@/lib/utils";

const BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];
const labelBulan = (periode: string) => BULAN[Number(periode.split("-")[1]) - 1] ?? periode;

/** "±12 menit lagi" / "±1 jam 5 menit lagi" — dibulatkan, karena ketepatan
 *  detik di sini palsu: lajunya naik-turun mengikuti ESB. */
function sisaWaktuTeks(ms: number): string {
  const menit = Math.max(1, Math.round(ms / 60_000));
  if (menit < 60) return `±${menit} menit lagi`;
  const jam = Math.floor(menit / 60);
  const sisa = menit % 60;
  return sisa === 0 ? `±${jam} jam lagi` : `±${jam} jam ${sisa} menit lagi`;
}

/**
 * KELENGKAPAN DAILY — dan tombol untuk mengejarnya sampai penuh.
 *
 * Daily menghitung hari yang belum ditarik sebagai nol jualan. Selama lubangnya
 * ada, tiap outlet yang datanya tertinggal terbaca lebih buruk daripada
 * keadaannya, dan halaman itu dipakai mengambil keputusan. Jadi yang dijawab di
 * sini bukan "apakah cron jalan" melainkan "berapa yang kurang, dan bisakah
 * saya menutupnya sekarang".
 *
 * TOMBOLNYA MENGEJAR SENDIRI SAMPAI HABIS. Satu permintaan tetap dibatasi 60
 * detik oleh Vercel — itu tidak bisa ditawar — tapi yang dulu berarti "pencet
 * ratusan kali sambil menunggui" sekarang jadi urusan halaman ini: ia memanggil
 * jendela berikutnya begitu yang sekarang pulang, dan berhenti sendiri saat
 * penuh. Yang diminta dari orangnya cuma membiarkan tab ini terbuka.
 */
export function KelengkapanDailyPanel({ awal }: { awal: KelengkapanDaily }) {
  const [data, setData] = React.useState(awal);
  const [jalan, setJalan] = React.useState(false);
  /** Baris yang terkumpul SEJAK tombol ditekan — dasar perhitungan laju. */
  const [sesi, setSesi] = React.useState({ terisi: 0, putaran: 0, perMenit: 0 });
  const [catatan, setCatatan] = React.useState<string | null>(null);
  // Tombol berhenti harus terbaca oleh perulangan yang sedang berjalan, dan
  // state React tidak terbaca dari dalam closure yang sudah jalan.
  const stop = React.useRef(false);

  const kejar = async () => {
    if (jalan) { stop.current = true; setCatatan("Berhenti sesudah jendela ini selesai…"); return; }
    stop.current = false;
    setJalan(true);
    setSesi({ terisi: 0, putaran: 0, perMenit: 0 });
    setCatatan(null);
    let total = 0;
    let putaran = 0;
    const mulai = Date.now();
    try {
      for (;;) {
        const h = await kejarDailyAction();
        total += h.terisi;
        putaran += 1;
        // Lajunya dihitung DI SINI, bukan saat menggambar: `Date.now()` di
        // badan render membuat hasilnya berbeda tiap kali React menggambar
        // ulang, dan React Compiler memang melarangnya.
        const lewat = Date.now() - mulai;
        setSesi({ terisi: total, putaran, perMenit: lewat > 3_000 ? (total / lewat) * 60_000 : 0 });
        // Angkanya diperbarui walau ada galat: sebagian mungkin sempat masuk
        // sebelum ESB berhenti menjawab.
        setData((d) => ({ ...d, kurang: h.sisa, ada: d.wajib - h.sisa, persen: h.persen }));

        if (h.error) setCatatan(h.error);
        else if (h.gagal > 0) setCatatan(`${formatNumber(h.gagal)} panggilan ESB gagal dan akan dicoba lagi.`);
        else setCatatan(null);

        if (stop.current) { setCatatan("Dihentikan. Sisanya bisa dilanjutkan kapan saja."); break; }
        if (!h.lanjut) {
          if (h.sisa <= 0) toast.success("Data Daily sudah lengkap.");
          else if (h.error) toast.error(h.error);
          else toast.success("Tidak ada lagi yang bisa ditarik untuk sekarang.");
          break;
        }
        if (h.tunggu) await new Promise((r) => setTimeout(r, h.tunggu));
      }
    } catch {
      setCatatan("Permintaan terputus. Pencet lagi untuk melanjutkan dari tempatnya berhenti.");
    } finally {
      setJalan(false);
      stop.current = false;
    }
  };

  const penuh = data.kurang <= 0;
  const perkiraan = sesi.perMenit > 0 ? (data.kurang / sesi.perMenit) * 60_000 : 0;

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
          disabled={penuh}
          className={cn(
            "ms-auto inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-[13px] font-medium transition-colors",
            penuh
              ? "cursor-default border border-border bg-card text-muted-foreground"
              : jalan
                ? "border border-border bg-card text-foreground hover:bg-muted"
                : "bg-brand-600 text-white hover:bg-brand-700",
          )}
        >
          {jalan ? <Square className="size-3.5 fill-current" /> : penuh ? <CheckCircle2 className="size-4" /> : null}
          {jalan ? "Berhenti" : penuh ? "Sudah lengkap" : "Tarik sampai penuh"}
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

      {jalan && (
        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] tabular-nums text-foreground">
          <Loader2 className="size-3.5 animate-spin text-brand-600" />
          <span>
            <b>{formatNumber(sesi.terisi)}</b> terisi sejak dimulai
          </span>
          {sesi.perMenit > 0 && (
            <>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">{formatNumber(sesi.perMenit, { maximumFractionDigits: 0 })}/menit</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">{sisaWaktuTeks(perkiraan)}</span>
            </>
          )}
        </p>
      )}

      {catatan && (
        <p className="mt-2 text-[12px] leading-relaxed text-amber-700 dark:text-amber-400">{catatan}</p>
      )}

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
            Penarikan berjalan <b>bertubi-tubi sampai penuh</b> selama halaman ini terbuka — satu permintaan dibatasi 60
            detik oleh Vercel, jadi yang dikejar di sini adalah jendela demi jendela, <b>bulan yang paling berlubang
            dulu</b>. Boleh dihentikan kapan saja; sisanya dilanjutkan dari tempatnya berhenti.
          </p>
        </>
      )}
    </div>
  );
}
