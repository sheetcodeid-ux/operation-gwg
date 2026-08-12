"use client";

import { HYGIENE_RATING_META, HYGIENE_SECTIONS } from "@/lib/constants";
import type { HygieneRating, HygieneSection } from "@/lib/types";
import type { HygieneRow } from "./hygiene-explorer";

/**
 * Lembar hasil audit hygiene yang siap dicetak / disimpan sebagai PDF.
 *
 * Dibuat sebagai dokumen HTML mandiri lalu dicetak peramban, bukan lewat
 * pustaka PDF. Alasannya sama dengan laporan Assessment yang sudah ada:
 * hasilnya vektor (teks tetap tajam pada zoom berapa pun), tidak menambah
 * satu megabita pustaka ke bundel yang dibuka supervisor di HP, dan tata
 * letaknya memakai mesin yang sudah pasti ada di setiap perangkat.
 *
 * Fotonya sengaja ikut: audit kebersihan tanpa bukti foto hanyalah angka.
 */

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

/** Warna per nilai — dicetak dengan `print-color-adjust:exact` supaya ikut keluar. */
const RATING_COLOR: Record<HygieneRating, string> = {
  excellent: "#10b981",
  good: "#0ea5e9",
  fair: "#f59e0b",
  poor: "#ef4444",
};

const scoreColor = (n: number) => (n >= 90 ? "#10b981" : n >= 75 ? "#0ea5e9" : n >= 60 ? "#f59e0b" : "#ef4444");

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const SECTIONS = Object.keys(HYGIENE_SECTIONS) as HygieneSection[];

/** Rata-rata nilai satu bagian, dalam skala 0–100 (sama seperti skor auditnya). */
function sectionScore(r: HygieneRow, sec: HygieneSection): { score: number; rated: number; total: number } {
  const items = HYGIENE_SECTIONS[sec].items;
  let sum = 0;
  let rated = 0;
  for (const it of items) {
    const v = r.ratings?.[sec]?.[it.key];
    if (!v) continue;
    sum += HYGIENE_RATING_META[v].score;
    rated += 1;
  }
  return { score: rated ? Math.round((sum / rated) * 10) / 10 : 0, rated, total: items.length };
}

function buildHtml(r: HygieneRow): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const today = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

  const sections = SECTIONS.map((sec) => {
    const meta = HYGIENE_SECTIONS[sec];
    const s = sectionScore(r, sec);
    const rows = meta.items
      .map((it) => {
        const v = r.ratings?.[sec]?.[it.key];
        const label = v ? HYGIENE_RATING_META[v].label : "—";
        const color = v ? RATING_COLOR[v] : "#9ca3af";
        return `<tr>
          <td style="padding:6px 0;border-bottom:1px solid #eef0f3;font-size:11.5px;color:#111827">${esc(it.label)}</td>
          <td style="padding:6px 0;border-bottom:1px solid #eef0f3;text-align:right;white-space:nowrap">
            <span style="display:inline-block;padding:2px 9px;border-radius:999px;background:${color};color:#fff;font-size:10px;font-weight:700">${esc(label)}</span>
          </td>
        </tr>`;
      })
      .join("");
    return `<div class="sec">
      <div class="sec-head">
        <div><span class="sec-name">${esc(meta.label)}</span> <span class="sec-sub">${esc(meta.subtitle)}</span></div>
        <span class="sec-score" style="color:${scoreColor(s.score)}">${s.score.toFixed(1)}<span style="color:#6b7280;font-weight:500;font-size:10px"> /100 · ${s.rated}/${s.total} dinilai</span></span>
      </div>
      <table style="width:100%;border-collapse:collapse">${rows}</table>
    </div>`;
  }).join("");

  const findings = r.findingList.length
    ? `<ol style="margin:0;padding-left:18px">${r.findingList
        .map((f) => `<li style="font-size:11.5px;color:#111827;padding:3px 0">${esc(f)}</li>`)
        .join("")}</ol>`
    : `<p style="font-size:11.5px;color:#6b7280">Tidak ada temuan pada audit ini.</p>`;

  // Foto memakai URL bertanda tangan yang sudah disiapkan halaman. Umurnya
  // terbatas, jadi lembar ini dicetak saat dibuka — bukan disimpan lalu dibuka
  // lagi besok.
  const photos = r.photos.length
    ? `<div class="grid-photo">${r.photos
        .map(
          (p) => `<figure style="margin:0">
            <img src="${esc(p.url ?? "")}" alt="" style="width:100%;height:104px;object-fit:cover;border-radius:6px;border:1px solid #e5e7eb"/>
            <figcaption style="font-size:9px;color:#6b7280;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p.name ?? "")}</figcaption>
          </figure>`,
        )
        .join("")}</div>`
    : `<p style="font-size:11.5px;color:#6b7280">Tidak ada foto terlampir.</p>`;

  return `<!doctype html><html lang="id"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Audit Kebersihan — ${esc(r.outlet)} — ${esc(fmtDate(r.date))}</title>
<style>
  * { box-sizing:border-box; margin:0; padding:0; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  body { font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; background:#f3f4f6; color:#111827; padding:24px; }
  .sheet { max-width:820px; margin:0 auto; background:#fff; border:1px solid #e5e7eb; border-radius:16px; overflow:hidden; }
  .band { background:#0f172a; color:#fff; padding:20px 26px; display:flex; justify-content:space-between; align-items:center; gap:16px; }
  .band h1 { font-size:17px; font-weight:700; }
  .band p { font-size:11.5px; opacity:0.72; margin-top:3px; }
  .body { padding:22px 26px; }
  .sec-title { font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; color:#6b7280; margin:20px 0 8px; }
  .sec-title:first-child { margin-top:0; }
  .grid2 { display:grid; grid-template-columns:1fr 1fr; gap:0 30px; }
  .row { display:flex; justify-content:space-between; gap:14px; padding:7px 0; border-bottom:1px solid #eef0f3; }
  .row span:first-child { color:#6b7280; font-size:11.5px; }
  .row span:last-child { color:#111827; font-size:11.5px; font-weight:600; text-align:right; }
  .scorebox { display:flex; align-items:center; justify-content:space-between; gap:16px; background:#f9fafb; border:1px solid #e5e7eb; border-radius:12px; padding:16px 18px; }
  .score { font-size:38px; font-weight:800; line-height:1; }
  .badge { display:inline-block; padding:5px 13px; border-radius:999px; font-size:12px; font-weight:700; color:#fff; }
  .sec { border:1px solid #e5e7eb; border-radius:10px; padding:11px 13px; margin-bottom:9px; break-inside:avoid; }
  .sec-head { display:flex; justify-content:space-between; align-items:baseline; gap:12px; margin-bottom:5px; }
  .sec-name { font-size:12.5px; font-weight:700; }
  .sec-sub { font-size:10px; color:#9ca3af; }
  .sec-score { font-size:15px; font-weight:800; }
  .grid-photo { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; }
  .foot { margin-top:20px; padding-top:12px; border-top:1px solid #e5e7eb; color:#6b7280; font-size:10.5px; display:flex; justify-content:space-between; gap:12px; }
  .signs { display:flex; gap:14px; margin-top:30px; break-inside:avoid; }
  .sign { text-align:center; flex:1; }
  @page { margin:12mm; }
  @media print {
    body { background:#fff; padding:0; }
    .sheet { border:none; border-radius:0; max-width:none; }
    .grid-photo { grid-template-columns:repeat(4,1fr); }
  }
</style></head><body>
  <div class="sheet">
    <div class="band">
      <div style="display:flex;align-items:center;gap:13px">
        <img src="${origin}/gwg.svg" alt="GWG" style="height:38px;width:auto;filter:brightness(0) invert(1)"/>
        <div><h1>Laporan Audit Kebersihan Outlet</h1><p>Good Will Grow · Operational</p></div>
      </div>
      <div style="text-align:right"><p style="font-size:11.5px;opacity:0.9">${esc(r.outlet)}</p><p>${esc(fmtDate(r.date))}</p></div>
    </div>
    <div class="body">
      <div class="sec-title">Identitas Audit</div>
      <div class="grid2">
        <div>
          <div class="row"><span>Outlet</span><span>${esc(r.outlet)}</span></div>
          <div class="row"><span>Coordinator Area</span><span>${esc(r.area)}</span></div>
          <div class="row"><span>Shift</span><span>${esc(r.shift)}</span></div>
        </div>
        <div>
          <div class="row"><span>Tanggal Audit</span><span>${esc(fmtDate(r.date))}</span></div>
          <div class="row"><span>Petugas Audit</span><span>${esc(r.inspector)}</span></div>
          <div class="row"><span>Supervisor</span><span>${esc(r.supervisor || "—")}</span></div>
        </div>
      </div>

      <div class="sec-title">Hasil Penilaian</div>
      <div class="scorebox">
        <div>
          <div style="color:#6b7280;font-size:11.5px;margin-bottom:3px">Skor Kebersihan</div>
          <div class="score" style="color:${scoreColor(r.score)}">${r.score.toFixed(1)}<span style="font-size:15px;color:#6b7280">/100</span></div>
        </div>
        <span class="badge" style="background:${r.isClean ? "#10b981" : "#ef4444"}">${r.isClean ? "Layak / Bersih" : "Perlu Tindak Lanjut"}</span>
      </div>

      <div class="sec-title">Rincian per Area</div>
      ${sections}

      <div class="sec-title">Temuan (${r.findingList.length})</div>
      ${findings}

      <div class="sec-title">Dokumentasi Foto (${r.photos.length})</div>
      ${photos}

      <div class="signs">
        <div class="sign">
          <div style="color:#6b7280;font-size:10.5px;margin-bottom:44px">Petugas Audit</div>
          <div style="border-top:1px solid #111827;margin:0 8px;padding-top:5px;font-size:11.5px;font-weight:600">${esc(r.inspector)}</div>
        </div>
        <div class="sign">
          <div style="color:#6b7280;font-size:10.5px;margin-bottom:44px">Coordinator Area</div>
          <div style="border-top:1px solid #111827;margin:0 8px;padding-top:5px;font-size:11.5px;font-weight:600">${esc(r.area)}</div>
        </div>
      </div>

      <div class="foot">
        <span>Dokumen ini dihasilkan otomatis oleh Sistem Operasional GWG.</span>
        <span>Dicetak: ${esc(today)}</span>
      </div>
    </div>
  </div>
</body></html>`;
}

/**
 * Cetak satu audit.
 *
 * Menunggu seluruh gambar selesai dimuat sebelum memanggil `print()`. Tanpa itu
 * dialog cetaknya terbuka saat foto masih kosong, dan PDF-nya keluar dengan
 * kotak-kotak putih — persis bagian yang paling dibutuhkan sebagai bukti.
 */
export function printHygieneReport(r: HygieneRow) {
  const w = window.open("", "_blank", "width=900,height=1200");
  if (!w) return false;
  w.document.write(buildHtml(r));
  w.document.close();
  w.focus();

  const images = Array.from(w.document.images);
  const siap = images.map(
    (img) =>
      img.complete
        ? Promise.resolve()
        : new Promise<void>((res) => {
            img.onload = () => res();
            // Foto yang gagal dimuat tidak boleh menahan pencetakan selamanya.
            img.onerror = () => res();
          }),
  );
  // Batas atas: URL foto bisa saja mati, dan menunggu tanpa akhir sama saja
  // dengan tombol yang tidak berfungsi.
  const batas = new Promise<void>((res) => w.setTimeout(res, 8000));
  void Promise.race([Promise.all(siap), batas]).then(() => w.setTimeout(() => w.print(), 150));
  return true;
}
