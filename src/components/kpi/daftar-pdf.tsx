"use client";

import * as React from "react";
import { Moon, Printer, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { THEME, aman, logo, type Mode } from "./laporan-pdf";
import { labelPeriode } from "./periode";
import { peringkat } from "@/lib/kpi/manajemen";
import { formatNumber } from "@/lib/utils";

/**
 * DAFTAR KPI BERNAMA — dokumen untuk pencairan, bukan untuk analisis.
 *
 * Laporan KPI yang sudah ada menjawab "kenapa skornya segini": indikator demi
 * indikator, lengkap dengan grafiknya, satu berkas satu orang. Dokumen ini
 * menjawab pertanyaan yang sama sekali lain — "siapa dapat berapa" — dan itu
 * pertanyaan yang muncul sekali sebulan di meja yang membagikan.
 *
 * Selama ini jawabannya harus dirakit tangan: buka rapor satu per satu, salin
 * nama dan angkanya ke kertas lain. Lima puluh tiga kali untuk supervisor saja.
 * Yang merakit tidak punya cara memastikan tidak ada yang terlewat, dan yang
 * terlewat berarti orang yang tidak dibayar.
 *
 * NAMANYA YANG DIUTAMAKAN, bukan posisinya. Itu pembalikan yang disengaja:
 * seluruh aplikasi ini menilai POSISI — riwayatnya menempel di situ supaya
 * pergantian staf tidak memutusnya. Tapi yang dibayar orang, bukan posisi, dan
 * dokumen yang dipakai membayar harus berbicara dalam nama.
 *
 * SATU PEMBANGUN UNTUK DUA HALAMAN, Supervisor dan Detail KPI Divisi. Bentuk
 * dokumennya sama karena kegunaannya sama; dua pembangun berarti dua dokumen
 * resmi dari satu perusahaan yang lama-lama tidak lagi mirip.
 */

export interface OrangKpi {
  nama: string;
  /** Baris kecil di bawah namanya — outlet, posisi, atau apa pun yang membedakan. */
  keterangan?: string;
  /** 0–100. Null = belum bisa dinilai bulan itu. */
  nilai: number | null;
  /** Kenapa kosong. Ikut dicetak supaya yang membagikan tahu ini bukan nol. */
  alasan?: string | null;
}

export interface KelompokKpi {
  nama: string;
  /** Keterangan kecil di samping nama kelompoknya. */
  catatan?: string;
  orang: OrangKpi[];
}

const angka = (n: number | null, digit = 1) =>
  n === null ? "—" : `${formatNumber(n, { maximumFractionDigits: digit })}%`;

/** Lencana peringkat — warnanya mengikuti ambang yang sama dengan di layar. */
function lencana(nilai: number | null, t: (typeof THEME)[Mode]): string {
  if (nilai === null) {
    return `<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:10px;background:${t.box};color:${t.sub};border:1px solid ${t.border}">Belum dinilai</span>`;
  }
  const p = peringkat(nilai);
  const warna: Record<string, string> = {
    success: "#10b981",
    amber: "#f59e0b",
    warning: "#f97316",
    danger: "#f43f5e",
  };
  const w = warna[p.tone] ?? t.sub;
  return `<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:10px;background:${w}1f;color:${w};border:1px solid ${w}55">${aman(p.label)}</span>`;
}

export function buatDaftarKpiHtml({
  judul,
  subjudul,
  periode,
  kelompok,
  mode,
}: {
  judul: string;
  subjudul: string;
  periode: string;
  kelompok: KelompokKpi[];
  mode: Mode;
}): string {
  const t = THEME[mode];
  const semua = kelompok.flatMap((k) => k.orang);
  const ada = semua.map((o) => o.nilai).filter((n): n is number => n !== null);
  const rata = ada.length ? ada.reduce((x, y) => x + y, 0) / ada.length : null;
  const belum = semua.length - ada.length;

  const sel = (isi: string, gaya = "") =>
    `<td style="padding:9px 10px;border-bottom:1px solid ${t.border};font-size:11.5px;${gaya}">${isi}</td>`;

  const bagian = kelompok
    .filter((k) => k.orang.length > 0)
    .map((k) => {
      const baris = k.orang
        .map(
          (o, n) => `<tr style="background:${n % 2 ? t.box : "transparent"}">
        ${sel(`<b style="color:${t.text}">${aman(o.nama)}</b>${o.keterangan ? `<div style="color:${t.sub};font-size:10px">${aman(o.keterangan)}</div>` : ""}`)}
        ${sel(
          o.nilai === null
            ? `<span style="color:${t.sub}">—</span>${o.alasan ? `<div style="color:${t.sub};font-size:10px;font-weight:400">${aman(o.alasan)}</div>` : ""}`
            : `<b style="color:${t.text};font-size:13px">${angka(o.nilai)}</b>`,
          "text-align:right",
        )}
        ${sel(lencana(o.nilai, t), "text-align:right")}
      </tr>`,
        )
        .join("");
      return `<div class="sec-title">${aman(k.nama)}${k.catatan ? ` <span style="font-weight:400;text-transform:none;letter-spacing:0">· ${aman(k.catatan)}</span>` : ""}</div>
      <table style="width:100%;border-collapse:collapse">
        <thead><tr>
          <th style="padding:8px 10px;border-bottom:1px solid ${t.border};font-size:10px;text-transform:uppercase;letter-spacing:0.05em;color:${t.sub};text-align:left">Nama</th>
          <th style="padding:8px 10px;border-bottom:1px solid ${t.border};font-size:10px;text-transform:uppercase;letter-spacing:0.05em;color:${t.sub};text-align:right">Skor KPI</th>
          <th style="padding:8px 10px;border-bottom:1px solid ${t.border};font-size:10px;text-transform:uppercase;letter-spacing:0.05em;color:${t.sub};text-align:right">Peringkat</th>
        </tr></thead>
        <tbody>${baris}</tbody>
      </table>`;
    })
    .join("");

  return `<!doctype html><html lang="id"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${aman(judul)} — ${aman(labelPeriode(periode))}</title>
<style>
  * { box-sizing:border-box; margin:0; padding:0; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  body { font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; background:${t.bg}; color:${t.text}; padding:24px; }
  .sheet { max-width:820px; margin:0 auto; background:${t.card}; border:1px solid ${t.border}; border-radius:16px; overflow:hidden; }
  .band { background:${t.band}; color:${t.bandText}; padding:22px 28px; display:flex; justify-content:space-between; align-items:center; }
  .band h1 { font-size:18px; font-weight:700; letter-spacing:-0.01em; }
  .band p { font-size:12px; opacity:0.7; margin-top:3px; }
  .body { padding:24px 28px; }
  .sec-title { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; color:${t.sub}; margin:22px 0 8px; }
  .sec-title:first-child { margin-top:0; }
  .scorebox { display:flex; align-items:center; justify-content:space-between; gap:16px; background:${t.box}; border:1px solid ${t.border}; border-radius:12px; padding:18px 20px; margin-bottom:4px; }
  .score { font-size:34px; font-weight:800; color:${t.text}; line-height:1; }
  .foot { margin-top:26px; padding-top:14px; border-top:1px solid ${t.border}; color:${t.sub}; font-size:11px; display:flex; justify-content:space-between; }
  /* Satu orang tidak boleh terbelah dua halaman — nama di halaman ini dan
     angkanya di halaman berikutnya adalah cara paling mudah salah bayar. */
  table { page-break-inside:auto; }
  tr { page-break-inside:avoid; }
  .sec-title { page-break-after:avoid; }
  @media print { body { background:#fff; padding:0; } .sheet { border:none; border-radius:0; max-width:none; } }
</style></head><body>
  <div class="sheet">
    <div class="band">
      <div style="display:flex;align-items:center;gap:14px">${logo()}<div><h1>${aman(judul)}</h1><p>Good Will Grow · ${aman(subjudul)}</p></div></div>
      <div style="text-align:right">
        <p>${aman(labelPeriode(periode))}</p>
        <p style="margin-top:8px;font-size:22px;font-weight:800;opacity:1">${angka(rata, 0)}</p>
        <p style="font-size:10px;opacity:0.7">rata-rata</p>
      </div>
    </div>
    <div class="body">
      <div class="scorebox">
        <div>
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.06em;color:${t.sub}">Yang tercantum</div>
          <div class="score">${semua.length}</div>
        </div>
        <div style="text-align:right;font-size:11.5px;color:${t.sub};line-height:1.7">
          <div>Sudah dinilai: <b style="color:${t.text}">${ada.length}</b></div>
          <div>Belum bisa dinilai: <b style="color:${t.text}">${belum}</b></div>
        </div>
      </div>
      ${bagian}
      <div class="foot">
        <span>Dokumen ini dasar pencairan KPI — yang belum dinilai BUKAN nol.</span>
        <span>Dicetak ${aman(new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }))}</span>
      </div>
    </div>
  </div>
</body></html>`;
}

/** Dialog pemilih mode, lalu cetak. Bentuknya sama dengan dialog laporan posisi. */
export function DialogDaftarKpi({
  open,
  onOpenChange,
  judul,
  subjudul,
  periode,
  kelompok,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  judul: string;
  subjudul: string;
  periode: string;
  kelompok: KelompokKpi[];
}) {
  const [mode, setMode] = React.useState<Mode | null>(null);

  const ubahBuka = (v: boolean) => {
    if (!v) setMode(null);
    onOpenChange(v);
  };

  function cetak(m: Mode) {
    setMode(m);
    const html = buatDaftarKpiHtml({ judul, subjudul, periode, kelompok, mode: m });
    const w = window.open("", "_blank", "width=900,height=1200");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 250);
  }

  return (
    <Dialog open={open} onOpenChange={ubahBuka}>
      <DialogContent className="max-w-sm">
        <h2 className="text-sm font-semibold text-foreground">Unduh {judul}</h2>
        <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
          Berisi nama dan skor tiap orang — dipakai sebagai dasar pencairan KPI. Pilih tampilannya, lalu simpan
          sebagai PDF dari jendela cetak.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={() => cetak("terang")}>
            <Sun className="size-4" /> Terang
          </Button>
          <Button variant="outline" onClick={() => cetak("gelap")}>
            <Moon className="size-4" /> Gelap
          </Button>
        </div>
        {mode && (
          <p className="mt-3 flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
            <Printer className="size-3.5" /> Jendela cetak sudah dibuka.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
