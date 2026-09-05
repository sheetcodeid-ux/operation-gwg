"use client";

import * as React from "react";
import { Moon, Printer, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { singkatUnik } from "./kpi-charts";
import { labelPeriode } from "./periode";
import type { BarisKpi } from "@/lib/kpi/hitung";
import type { LaporanKpi } from "@/lib/data/kpi";
import { formatIDR, formatNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";

/**
 * Laporan KPI satu posisi sebagai dokumen cetak.
 *
 * MENGAPA BUKAN CSV. Tombol unduh di tabel dulu mengeluarkan spreadsheet berisi
 * baris tabel yang sedang tampil — berguna untuk diolah ulang, tidak berguna
 * untuk dikirim. Yang dibutuhkan pada rapat bulanan adalah satu berkas yang
 * bisa dibaca apa adanya: berkop, lengkap dengan grafiknya, dan sama isinya
 * dengan yang terlihat di layar.
 *
 * BENTUKNYA MENGIKUTI LAPORAN ASSESSMENT KENAIKAN GOLONGAN — pita gelap
 * berlogo di atas, kartu putih di tengah, bagian bertajuk huruf kapital kecil.
 * Dua dokumen resmi dari satu perusahaan yang bentuknya berbeda membuat
 * keduanya terlihat seperti bukan dari tempat yang sama. Yang TIDAK diambil
 * dari sana: kolom tanda tangan — KPI bulanan tidak ditandatangani siapa pun,
 * dan kolom tanda tangan kosong pada dokumen berulang justru mengesankan ada
 * persetujuan yang belum diberikan.
 *
 * GRAFIKNYA DIGAMBAR ULANG SEBAGAI SVG, bukan disalin dari layar. Grafik di
 * layar dibangun pustaka bagan di dalam React; ia tidak ada dalam bentuk yang
 * bisa ditempelkan ke dokumen lain. SVG yang ditulis sendiri di sini juga yang
 * membuat hasil cetaknya tetap tajam pada ukuran berapa pun.
 */

type Mode = "terang" | "gelap";

const THEME: Record<Mode, { bg: string; card: string; text: string; sub: string; border: string; band: string; bandText: string; box: string; grid: string }> = {
  terang: { bg: "#f5f6f8", card: "#ffffff", text: "#1a1d21", sub: "#6b7280", border: "#e5e7eb", band: "#111827", bandText: "#ffffff", box: "#f9fafb", grid: "#e5e7eb" },
  gelap: { bg: "#0f1115", card: "#181b20", text: "#f3f4f6", sub: "#9ca3af", border: "#2a2e35", band: "#0b0d10", bandText: "#f3f4f6", box: "#12151a", grid: "#2a2e35" },
};

const BIRU = "#3b82f6";
const ABU = "#94a3b8";
const TARGET = "#f59e0b";
const WARNA = ["#3b82f6", "#f59e0b", "#06b6d4", "#8b5cf6", "#10b981", "#f43f5e", "#64748b", "#eab308"];

const persen = (n: number | null, digit = 2) =>
  n === null ? "—" : `${formatNumber(n, { minimumFractionDigits: digit, maximumFractionDigits: digit })}%`;

const bersatuan = (n: number | null, satuan?: "angka" | "rupiah" | "persen") => {
  if (n === null) return "—";
  if (satuan === "rupiah") return formatIDR(n);
  if (satuan === "persen") return persen(n, 0);
  return formatNumber(n, { maximumFractionDigits: 2 });
};

/** Teks apa pun yang masuk dokumen dilewatkan sini — nama outlet dan keterangan
 *  diketik orang, dan satu tanda "<" cukup untuk merusak seluruh halamannya. */
function aman(s: string): string {
  return String(s).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]!);
}

const tanggalHariIni = () => new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

/* ─────────────────────────────── grafik svg ─────────────────────────────── */

/**
 * Garis melengkung lewat sederet titik (Catmull-Rom diubah jadi kurva Bézier).
 *
 * Garis lurus antar-titik membuat grafiknya patah-patah dan berbeda dari yang
 * dilihat di layar; lengkungannya di sini dibuat sedekat mungkin dengan itu.
 */
function kurva(titik: { x: number; y: number }[]): string {
  if (titik.length === 0) return "";
  if (titik.length < 3) return titik.map((p, i) => `${i ? "L" : "M"}${p.x},${p.y}`).join(" ");
  let d = `M${titik[0].x},${titik[0].y}`;
  for (let i = 0; i < titik.length - 1; i += 1) {
    const p0 = titik[i - 1] ?? titik[i];
    const p1 = titik[i];
    const p2 = titik[i + 1];
    const p3 = titik[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
}

/** Grafik capaian — tiga garis yang sama dengan yang di layar. */
function grafikCapaian(baris: BarisKpi[], lalu: Record<string, number | null>, t: (typeof THEME)[Mode]): string {
  const L = 46;
  const R = 12;
  const A = 14;
  const B = 26;
  const W = 720;
  const H = 260;
  const kode = singkatUnik(baris.map((b) => b.label));
  const n = baris.length;
  const lebar = W - L - R;
  const tinggi = H - A - B;
  const px = (i: number) => (n <= 1 ? L + lebar / 2 : L + 12 + ((lebar - 24) * i) / (n - 1));
  const py = (v: number) => A + tinggi - (Math.max(0, Math.min(110, v)) / 110) * tinggi;

  const ini = baris.map((b, i) => ({ x: px(i), y: py(b.persentase ?? 0) }));
  const sblm = baris.map((b, i) => ({ x: px(i), y: py(lalu[b.key] ?? 0) }));
  const tgt = baris.map((_, i) => ({ x: px(i), y: py(100) }));

  const garisSumbu = [0, 25, 50, 75, 100]
    .map(
      (v) =>
        `<line x1="${L}" y1="${py(v)}" x2="${W - R}" y2="${py(v)}" stroke="${t.grid}" stroke-width="1" stroke-dasharray="3 3"/>` +
        `<text x="${L - 8}" y="${py(v) + 4}" text-anchor="end" fill="${t.sub}" font-size="10" font-weight="600">${v}%</text>`,
    )
    .join("");

  const label = baris
    .map((_, i) => `<text x="${px(i)}" y="${H - 8}" text-anchor="middle" fill="${t.text}" font-size="10" font-weight="700">${aman(kode[i])}</text>`)
    .join("");

  const area = `${kurva(ini)} L${ini[ini.length - 1]?.x ?? L},${py(0)} L${ini[0]?.x ?? L},${py(0)} Z`;
  const titik = (p: { x: number; y: number }[], w: string, r: number) =>
    p.map((q) => `<circle cx="${q.x.toFixed(1)}" cy="${q.y.toFixed(1)}" r="${r}" fill="${w}"/>`).join("");

  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Capaian per indikator">
    <defs><linearGradient id="isiBiru" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${BIRU}" stop-opacity="0.35"/><stop offset="100%" stop-color="${BIRU}" stop-opacity="0.02"/>
    </linearGradient></defs>
    ${garisSumbu}
    <path d="${area}" fill="url(#isiBiru)" stroke="none"/>
    <path d="${kurva(sblm)}" fill="none" stroke="${ABU}" stroke-width="2"/>
    <path d="${kurva(tgt)}" fill="none" stroke="${TARGET}" stroke-width="2" stroke-dasharray="6 5"/>
    <path d="${kurva(ini)}" fill="none" stroke="${BIRU}" stroke-width="2.75"/>
    ${titik(sblm, ABU, 2.5)}${titik(ini, BIRU, 3)}
    ${label}
  </svg>`;
}

/** Donat sebaran % actual — busur yang sama dengan kartu di layar. */
function donatSebaran(baris: BarisKpi[], t: (typeof THEME)[Mode]): string {
  const RAD = 66;
  const TEBAL = 22;
  const KEL = 2 * Math.PI * RAD;
  const irisan = baris
    .map((b, i) => ({ label: b.label, nilai: b.persenActual ?? 0, warna: WARNA[i % WARNA.length] }))
    .filter((s) => s.nilai > 0);
  const total = irisan.reduce((a, s) => a + s.nilai, 0);
  if (total <= 0) return `<p style="color:${t.sub};font-size:12px">Belum ada capaian yang bisa dipetakan bulan ini.</p>`;

  const panjang = irisan.map((s) => (s.nilai / total) * KEL);
  const busur = irisan
    .map((s, i) => {
      const rot = -90 + (panjang.slice(0, i).reduce((a, b) => a + b, 0) / KEL) * 360;
      return `<circle cx="88" cy="88" r="${RAD}" fill="none" stroke="${s.warna}" stroke-width="${TEBAL}" stroke-linecap="round"
        stroke-dasharray="${panjang[i].toFixed(2)} ${(KEL - panjang[i]).toFixed(2)}" transform="rotate(${rot.toFixed(2)} 88 88)"/>`;
    })
    .join("");

  const legenda = irisan
    .map(
      (s) => `<li style="display:flex;align-items:baseline;gap:7px;font-size:11px;color:${t.text};margin-bottom:7px;line-height:1.35">
        <span style="width:8px;height:8px;border-radius:999px;background:${s.warna};flex:none"></span>
        <span style="flex:1;min-width:0">${aman(s.label)}</span>
        <span style="color:${t.sub};font-variant-numeric:tabular-nums;white-space:nowrap">${persen(s.nilai)}</span>
      </li>`,
    )
    .join("");

  return `<div style="display:flex;align-items:center;gap:14px">
    <svg viewBox="0 0 176 176" width="126" height="126" style="flex:none" role="img" aria-label="Sebaran capaian">
      ${busur}
      <text x="88" y="97" text-anchor="middle" fill="${t.text}" font-size="24" font-weight="800">${Math.round(total)}%</text>
    </svg>
    <ul style="list-style:none;flex:1;min-width:0">${legenda}</ul>
  </div>`;
}

/* ─────────────────────────────── dokumennya ─────────────────────────────── */

function logo(): string {
  const asal = typeof window !== "undefined" ? window.location.origin : "";
  return `<img src="${asal}/gwg.svg" alt="GWG" style="height:40px;width:auto;filter:brightness(0) invert(1)"/>`;
}

export function buatLaporanHtml({
  laporan,
  lalu,
  namaPosisi,
  namaDepartemen,
  mode,
}: {
  laporan: LaporanKpi;
  lalu: Record<string, number | null>;
  namaPosisi: string;
  namaDepartemen: string;
  mode: Mode;
}): string {
  const t = THEME[mode];
  const { baris, ringkas, ca } = laporan;
  const adaKategori = baris.some((b) => b.kategori);

  const sel = (isi: string, gaya = "") => `<td style="padding:8px 10px;border-bottom:1px solid ${t.border};font-size:11.5px;${gaya}">${isi}</td>`;
  const kepala = (isi: string, gaya = "") =>
    `<th style="padding:8px 10px;border-bottom:1px solid ${t.border};font-size:10px;text-transform:uppercase;letter-spacing:0.05em;color:${t.sub};text-align:left;${gaya}">${isi}</th>`;

  const barisIndikator = baris
    .map(
      (b) => `<tr>
      ${sel(`<b style="color:${t.text}">${aman(b.label)}</b>${b.alasan ? `<div style="color:${t.sub};font-size:10px">${aman(b.alasan)}</div>` : ""}`)}
      ${adaKategori ? sel(aman(b.kategori ?? "—"), `color:${t.sub}`) : ""}
      ${sel(persen(b.bobot, 0), "text-align:right")}
      ${sel(bersatuan(b.target, b.satuan), "text-align:right")}
      ${sel(bersatuan(b.actual, b.satuan), "text-align:right")}
      ${sel(persen(b.persentase), "text-align:right")}
      ${sel(`<b style="color:${t.text}">${persen(b.persenActual)}</b>`, "text-align:right")}
    </tr>`,
    )
    .join("");

  const tabelIndikator = `<table style="width:100%;border-collapse:collapse">
    <thead><tr>
      ${kepala("Indikator")}${adaKategori ? kepala("Kategori") : ""}${kepala("Bobot", "text-align:right")}
      ${kepala("Target", "text-align:right")}${kepala("Actual", "text-align:right")}${kepala("Persentase", "text-align:right")}${kepala("% Actual", "text-align:right")}
    </tr></thead>
    <tbody>${barisIndikator}</tbody>
  </table>`;

  // Rincian per outlet hanya ada pada posisi yang memang dinilai per outlet.
  // Menampilkan bagian kosong berjudul "Rincian Outlet" pada posisi lain membuat
  // orang mengira datanya hilang.
  const bagian = (nilai: number | null, dasar: number | null) =>
    nilai === null || dasar === null || dasar <= 0 ? "—" : persen((nilai / dasar) * 100);

  const tabelOutlet = ca
    ? `<div class="sec-title">Rincian per Outlet</div>
      <table style="width:100%;border-collapse:collapse">
        <thead><tr>
          ${kepala("Outlet")}${kepala("Gross Sales", "text-align:right")}${kepala("Avg 3 Bln", "text-align:right")}
          ${kepala("% Avg", "text-align:right")}${kepala("Net Profit", "text-align:right")}${kepala("% NP", "text-align:right")}
          ${kepala("HPP", "text-align:right")}${kepala("% HPP", "text-align:right")}
        </tr></thead>
        <tbody>${ca.detail
          .map(
            (o) => `<tr>
          ${sel(`<b style="color:${t.text}">${aman(o.outletNama)}</b>${o.ikut ? "" : `<div style="color:${t.sub};font-size:10px">belum 3 bulan — tidak dinilai</div>`}`)}
          ${sel(o.gross === null ? "—" : formatIDR(o.gross), "text-align:right")}
          ${sel(o.average === null ? "—" : formatIDR(o.average), `text-align:right;color:${t.sub}`)}
          ${sel(bagian(o.gross, o.average), "text-align:right")}
          ${sel(o.netProfit === null ? "—" : formatIDR(o.netProfit), "text-align:right")}
          ${sel(bagian(o.netProfit, o.gross), "text-align:right")}
          ${sel(o.hppNominal === null ? "—" : formatIDR(o.hppNominal), "text-align:right")}
          ${sel(bagian(o.hppNominal, o.gross), "text-align:right")}
        </tr>`,
          )
          .join("")}</tbody>
      </table>`
    : "";

  const identitas = (label: string, nilai: string) => `
    <div style="display:flex;justify-content:space-between;gap:16px;padding:9px 0;border-bottom:1px solid ${t.border}">
      <span style="color:${t.sub};font-size:12.5px">${aman(label)}</span>
      <span style="color:${t.text};font-size:12.5px;font-weight:600;text-align:right">${aman(nilai) || "—"}</span>
    </div>`;

  return `<!doctype html><html lang="id"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Laporan KPI — ${aman(namaPosisi)} — ${aman(labelPeriode(laporan.periode))}</title>
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
  .grid2 { display:grid; grid-template-columns:1fr 1fr; gap:0 32px; }
  .scorebox { display:flex; align-items:center; justify-content:space-between; gap:16px; background:${t.box}; border:1px solid ${t.border}; border-radius:12px; padding:18px 20px; }
  .score { font-size:40px; font-weight:800; color:${t.text}; line-height:1; }
  .charts { display:grid; grid-template-columns:1fr 330px; gap:14px; align-items:stretch; }
  .chartbox { background:${t.box}; border:1px solid ${t.border}; border-radius:12px; padding:14px 16px; }
  .chartbox h3 { font-size:12px; font-weight:700; color:${t.text}; margin-bottom:2px; }
  .chartbox .sub { font-size:10.5px; color:${t.sub}; margin-bottom:8px; }
  .legend { display:flex; gap:14px; flex-wrap:wrap; margin-bottom:6px; font-size:10.5px; color:${t.sub}; align-items:center; }
  .foot { margin-top:26px; padding-top:14px; border-top:1px solid ${t.border}; color:${t.sub}; font-size:11px; display:flex; justify-content:space-between; }
  table { page-break-inside:auto; }
  tr { page-break-inside:avoid; }
  @media print { body { background:#fff; padding:0; } .sheet { border:none; border-radius:0; max-width:none; } }
  @media (max-width:720px) { .charts { grid-template-columns:1fr; } .grid2 { grid-template-columns:1fr; } }
</style></head><body>
  <div class="sheet">
    <div class="band">
      <div style="display:flex;align-items:center;gap:14px">${logo()}<div><h1>Laporan Key Performance Indicator</h1><p>Good Will Grow · ${aman(namaDepartemen)}</p></div></div>
      <div style="text-align:right"><p style="opacity:0.85;font-size:12px">${aman(namaPosisi)}</p><p>${aman(labelPeriode(laporan.periode))}</p></div>
    </div>
    <div class="body">
      <div class="sec-title">Identitas Penilaian</div>
      <div class="grid2">
        <div>${identitas("Posisi", namaPosisi)}${identitas("Departemen", namaDepartemen)}${identitas("Periode", labelPeriode(laporan.periode))}</div>
        <div>${identitas("PIC", laporan.pic || "Dinilai sebagai satu tim")}${identitas("Indikator Terukur", `${ringkas.jumlahTerukur} dari ${baris.length}`)}${identitas("Status Bulan", laporan.dikunci ? "Dikunci" : "Masih bisa diubah")}</div>
      </div>

      <div class="sec-title">Skor Bulan Ini</div>
      <div class="scorebox">
        <div>
          <div style="color:${t.sub};font-size:12px;margin-bottom:4px">Total % Actual</div>
          <div class="score">${persen(ringkas.skor)}<span style="font-size:16px;color:${t.sub}"> / ${persen(ringkas.bobotTotal, 0)}</span></div>
        </div>
        <div style="text-align:right;color:${t.sub};font-size:11.5px;line-height:1.7">
          <div>Bobot terukur <b style="color:${t.text}">${persen(ringkas.bobotTerpakai, 0)}</b></div>
          <div>Setara 100% <b style="color:${t.text}">${persen(ringkas.skorSetara)}</b></div>
        </div>
      </div>

      <div class="sec-title">Grafik Capaian</div>
      <div class="charts">
        <div class="chartbox">
          <h3>Capaian per Indikator</h3>
          <div class="sub">${aman(labelPeriode(laporan.periode))} · ${aman(namaPosisi)}</div>
          <div class="legend">
            <span><svg width="18" height="6" style="vertical-align:middle"><line x1="0" y1="3" x2="18" y2="3" stroke="${ABU}" stroke-width="2.5" stroke-linecap="round"/></svg> Bulan lalu</span>
            <span><svg width="18" height="6" style="vertical-align:middle"><line x1="0" y1="3" x2="18" y2="3" stroke="${TARGET}" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="5 4"/></svg> Target</span>
            <span><svg width="18" height="6" style="vertical-align:middle"><line x1="0" y1="3" x2="18" y2="3" stroke="${BIRU}" stroke-width="2.5" stroke-linecap="round"/></svg> Bulan ini</span>
          </div>
          ${grafikCapaian(baris, lalu, t)}
        </div>
        <div class="chartbox">
          <h3>Sebaran % Actual</h3>
          <div class="sub">Dari mana skornya datang</div>
          ${donatSebaran(baris, t)}
        </div>
      </div>

      <div class="sec-title">Rincian Indikator</div>
      ${tabelIndikator}
      ${tabelOutlet}

      <div class="foot"><span>Dokumen ini dihasilkan otomatis oleh Sistem KPI GWG.</span><span>Dicetak: ${tanggalHariIni()}</span></div>
    </div>
  </div>
</body></html>`;
}

/* ──────────────────────────────── dialognya ──────────────────────────────── */

function ChipMode({ aktif, onClick, ikon, label }: { aktif: boolean; onClick: () => void; ikon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
        aktif ? "bg-background text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {ikon}
      {label}
    </button>
  );
}

export function DialogLaporanKpi({
  open,
  onOpenChange,
  laporan,
  lalu,
  namaPosisi,
  namaDepartemen,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  laporan: LaporanKpi;
  lalu: Record<string, number | null>;
  namaPosisi: string;
  namaDepartemen: string;
}) {
  const [mode, setMode] = React.useState<Mode | null>(null);

  // Pilihan mode dikembalikan saat dialognya DITUTUP, bukan lewat efek yang
  // mengintip `open`. Efek semacam itu berjalan setelah render dan memicu
  // render kedua hanya untuk mengosongkan satu nilai.
  const ubahBuka = (v: boolean) => {
    if (!v) setMode(null);
    onOpenChange(v);
  };

  const html = mode ? buatLaporanHtml({ laporan, lalu, namaPosisi, namaDepartemen, mode }) : "";

  function cetak() {
    if (!html) return;
    const w = window.open("", "_blank", "width=900,height=1200");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    // Beri dokumen barunya satu tarikan napas untuk menata diri sebelum dicetak.
    setTimeout(() => w.print(), 250);
  }

  return (
    <Dialog open={open} onOpenChange={ubahBuka}>
      <DialogContent title="Laporan KPI" description={`${namaPosisi} · ${labelPeriode(laporan.periode)}`} className="max-w-3xl">
        {!mode ? (
          <div className="p-6">
            <p className="mb-4 text-sm text-muted-foreground">Pilih mode tampilan laporan:</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setMode("terang")}
                className="flex flex-col items-center gap-2 rounded-xl border border-border bg-white p-6 text-gray-900 transition-colors hover:border-foreground/40"
              >
                <Sun className="size-7" />
                <span className="text-sm font-semibold">Mode Terang</span>
              </button>
              <button
                type="button"
                onClick={() => setMode("gelap")}
                className="flex flex-col items-center gap-2 rounded-xl border border-border bg-[#0f1115] p-6 text-gray-100 transition-colors hover:border-foreground/40"
              >
                <Moon className="size-7" />
                <span className="text-sm font-semibold">Mode Gelap</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex h-[70vh] flex-col">
            <div className="flex items-center justify-between gap-2 border-b border-border p-3">
              <div className="inline-flex gap-1 rounded-lg border border-border bg-muted/50 p-1">
                <ChipMode aktif={mode === "terang"} onClick={() => setMode("terang")} ikon={<Sun className="size-3.5" />} label="Terang" />
                <ChipMode aktif={mode === "gelap"} onClick={() => setMode("gelap")} ikon={<Moon className="size-3.5" />} label="Gelap" />
              </div>
              <Button onClick={cetak}>
                <Printer className="size-4" /> Cetak / Simpan PDF
              </Button>
            </div>
            <iframe title="Pratinjau Laporan KPI" srcDoc={html} className="min-h-0 flex-1 rounded-b-xl bg-white" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
