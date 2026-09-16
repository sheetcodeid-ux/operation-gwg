"use client";

import * as React from "react";
import { Check, Moon, Printer, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ChipMode, THEME, aman, logo, type Mode } from "./laporan-pdf";
import { labelPeriode } from "./periode";
import { peringkat } from "@/lib/kpi/manajemen";
import { AMBANG_PENUH, AMBANG_SEPARUH, type BarisCair } from "@/lib/kpi/pencairan";
import { cn, formatNumber } from "@/lib/utils";

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
  /**
   * Capaian tiap indikator, urut seperti di rapornya.
   *
   * Kalau ada, dokumennya berubah bentuk: bukan lagi daftar nama beserta satu
   * angka, melainkan MATRIKS — satu baris per nama, satu kolom per indikator,
   * dan kolom Total di ujung. Bentuk itu menjawab pertanyaan berikutnya yang
   * selalu muncul setelah "berapa": indikator mana yang menjatuhkannya.
   */
  indikator?: { key: string; label: string; bobot: number; persen: number | null }[];
  /**
   * Bahan daftar pencairan: capaian divisinya, dasar pencairannya, dan cair
   * berapa. Ada hanya pada dokumen Detail KPI Divisi.
   */
  cair?: Omit<BarisCair, "nama" | "departemen">;
}

export interface KelompokKpi {
  nama: string;
  orang: OrangKpi[];
}

const angka = (n: number | null, digit = 1) =>
  n === null ? "—" : `${formatNumber(n, { maximumFractionDigits: digit })}%`;

/** Warna tiap peringkat — sama dengan ambang yang dipakai di layar. */
const WARNA: Record<string, string> = {
  success: "#10b981",
  amber: "#f59e0b",
  warning: "#f97316",
  danger: "#f43f5e",
};

/** Lencana peringkat. */
function lencana(nilai: number | null, t: (typeof THEME)[Mode]): string {
  if (nilai === null) {
    return `<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:10px;background:${t.box};color:${t.sub};border:1px solid ${t.border};white-space:nowrap">Belum dinilai</span>`;
  }
  const p = peringkat(nilai);
  const w = WARNA[p.tone] ?? t.sub;
  return `<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:600;background:${w}1f;color:${w};border:1px solid ${w}55;white-space:nowrap">${aman(p.label)}</span>`;
}

/**
 * Bar skor di tiap baris.
 *
 * Angka saja menuntut pembacanya membandingkan dalam kepala, baris demi baris.
 * Bar membuat urutan dan jaraknya terbaca sekali lihat — dan pada dokumen yang
 * dipakai memutuskan pembayaran, "siapa jauh di bawah yang lain" justru
 * pertanyaan pertamanya.
 */
function bar(nilai: number | null, t: (typeof THEME)[Mode]): string {
  if (nilai === null) return `<div style="height:5px;border-radius:999px;background:${t.box}"></div>`;
  const w = WARNA[peringkat(nilai).tone] ?? t.sub;
  const lebar = Math.max(2, Math.min(100, nilai));
  return `<div style="height:5px;border-radius:999px;background:${t.box};overflow:hidden"><div style="height:100%;width:${lebar}%;border-radius:999px;background:${w}"></div></div>`;
}

/** Satu kotak angka di baris ringkasan. */
function kotak(label: string, nilai: string, t: (typeof THEME)[Mode], catatan = ""): string {
  return `<div style="flex:1;min-width:0;background:${t.box};border:1px solid ${t.border};border-radius:12px;padding:12px 14px">
    <div style="font-size:9.5px;text-transform:uppercase;letter-spacing:0.06em;color:${t.sub};white-space:nowrap">${aman(label)}</div>
    <div style="font-size:24px;font-weight:800;color:${t.text};line-height:1.2;margin-top:2px">${nilai}</div>
    ${catatan ? `<div style="font-size:10px;color:${t.sub};margin-top:1px">${aman(catatan)}</div>` : ""}
  </div>`;
}

/**
 * SEBARAN PERINGKAT — satu bar bersegmen, bukan empat angka terpisah.
 *
 * Yang ditanyakan pemilik saat menerima daftar ini bukan "berapa rata-ratanya"
 * melainkan "berapa banyak yang bermasalah". Empat angka berjajar menuntut
 * penjumlahan di kepala sebelum bisa dijawab; satu bar menjawabnya sebelum
 * dibaca.
 */
function sebaran(nilai: number[], belum: number, t: (typeof THEME)[Mode]): string {
  const urut: { id: string; label: string; tone: string }[] = [
    { id: "sangat_baik", label: "Sangat Baik", tone: "success" },
    { id: "baik", label: "Baik", tone: "amber" },
    { id: "perhatian", label: "Perlu Perhatian", tone: "warning" },
    { id: "kritis", label: "Kritis", tone: "danger" },
  ];
  const hitung = urut.map((u) => ({ ...u, n: nilai.filter((v) => peringkat(v).id === u.id).length }));
  const total = nilai.length + belum;
  if (total === 0) return "";
  const segmen = [
    ...hitung.filter((h) => h.n > 0).map((h) => ({ n: h.n, warna: WARNA[h.tone] })),
    ...(belum > 0 ? [{ n: belum, warna: t.border }] : []),
  ]
    .map((sg) => `<div style="width:${(sg.n / total) * 100}%;background:${sg.warna}"></div>`)
    .join("");
  const kunci = [
    ...hitung.map((h) => ({ label: h.label, n: h.n, warna: WARNA[h.tone] })),
    ...(belum > 0 ? [{ label: "Belum dinilai", n: belum, warna: t.border }] : []),
  ]
    .map(
      (k) =>
        `<span style="display:inline-flex;align-items:center;gap:5px;font-size:10.5px;color:${t.sub}">
           <span style="width:8px;height:8px;border-radius:2px;background:${k.warna};display:inline-block"></span>
           ${aman(k.label)} <b style="color:${t.text}">${k.n}</b>
         </span>`,
    )
    .join("");
  return `<div class="sec-title">Sebaran Peringkat</div>
    <div style="display:flex;height:9px;border-radius:999px;overflow:hidden;background:${t.box};margin-bottom:8px">${segmen}</div>
    <div style="display:flex;flex-wrap:wrap;gap:6px 16px">${kunci}</div>`;
}

export function buatDaftarKpiHtml({
  judul,
  subjudul,
  periode,
  kelompok,
  mode,
  /** Apa yang dihitung — "orang" atau "outlet". Dokumen KPI Supervisor
   *  menghitung outlet, dan menyebutnya "orang" membuat jumlahnya terbaca
   *  seperti jumlah pegawai yang akan dibayar. */
  satuan = "orang",
}: {
  judul: string;
  subjudul: string;
  periode: string;
  kelompok: KelompokKpi[];
  mode: Mode;
  satuan?: string;
}): string {
  const t = THEME[mode];
  const isi = kelompok.filter((k) => k.orang.length > 0);
  const semua = isi.flatMap((k) => k.orang);
  const ada = semua.map((o) => o.nilai).filter((n): n is number => n !== null);
  const rata = ada.length ? ada.reduce((x, y) => x + y, 0) / ada.length : null;
  const belum = semua.length - ada.length;

  const sel = (i: string, g = "") =>
    `<td style="padding:8px 10px;border-bottom:1px solid ${t.border};font-size:11.5px;${g}">${i}</td>`;
  const kepala = (i: string, g = "") =>
    `<th style="padding:7px 10px;border-bottom:1px solid ${t.border};font-size:9.5px;text-transform:uppercase;letter-spacing:0.05em;color:${t.sub};text-align:left;${g}">${i}</th>`;

  const bagian = isi
    .map((k) => {
      // Kolom indikator diambil dari baris PERTAMA yang punya rinciannya —
      // dalam satu kelompok seluruh anggotanya dinilai dengan indikator yang
      // sama, jadi satu contoh sudah menentukan judul kolomnya.
      const kolom = k.orang.find((o) => o.indikator?.length)?.indikator ?? [];
      // DIURUTKAN DARI YANG TERTINGGI di dalam kelompoknya, dan yang belum
      // dinilai selalu di bawah — bukan tersebar di tengah daftar tempat ia
      // mudah terbaca sebagai nilai yang rendah.
      const orang = [...k.orang].sort(
        (a, b) => (b.nilai ?? -1) - (a.nilai ?? -1) || a.nama.localeCompare(b.nama, "id"),
      );
      const baris = orang
        .map((o, n) => {
          const awal = `<tr style="background:${n % 2 ? t.box : "transparent"}">
        ${sel(`<span style="color:${t.sub};font-size:10.5px">${n + 1}</span>`, "width:26px;text-align:right")}
        ${sel(
          `<b style="color:${t.text}">${aman(o.nama)}</b>${o.keterangan ? `<div style="color:${t.sub};font-size:10px;font-weight:400">${aman(o.keterangan)}</div>` : ""}`,
        )}`;
          const tengah = kolom.length
            ? kolom
                .map((kk) => {
                  const v = o.indikator?.find((x) => x.key === kk.key)?.persen ?? null;
                  return sel(
                    v === null
                      ? `<span style="color:${t.sub}">—</span>`
                      : `<span style="color:${t.text}">${angka(v, 0)}</span>`,
                    "text-align:right;white-space:nowrap",
                  );
                })
                .join("")
            : sel(bar(o.nilai, t), "width:120px");
          const akhir = `${sel(
          o.nilai === null
            ? `<span style="color:${t.sub}">—</span>`
            : `<b style="color:${t.text};font-size:13.5px">${angka(o.nilai)}</b>`,
          "text-align:right;width:74px;white-space:nowrap",
        )}
        ${sel(`${lencana(o.nilai, t)}${o.nilai === null && o.alasan ? `<div style="color:${t.sub};font-size:9.5px;margin-top:3px;max-width:170px">${aman(o.alasan)}</div>` : ""}`, "text-align:right;width:160px")}
      </tr>`;
          return awal + tengah + akhir;
        })
        .join("");
      const nilaiK = orang.map((o) => o.nilai).filter((n): n is number => n !== null);
      const rataK = nilaiK.length ? nilaiK.reduce((x, y) => x + y, 0) / nilaiK.length : null;
      return `<div class="grup">
        <div class="grup-judul">
          <span>${aman(k.nama)}</span>
          <!-- Jumlah dan rata-ratanya dihitung dari yang BENAR-BENAR DICETAK,
               bukan dari daftar aslinya. Dengan pemilih orang, dua-duanya
               berubah begitu ada nama yang dikeluarkan — dan keterangan yang
               dititipkan pemanggil akan tetap menyebut jumlah lama. -->
          <span class="grup-catatan">${orang.length} ${aman(satuan)} · rata-rata <b style="color:${t.text}">${angka(rataK)}</b></span>
        </div>
        <table style="width:100%;border-collapse:collapse">
          <thead><tr>${kepala("", "width:26px")}${kepala("Nama")}${
            kolom.length
              ? kolom
                  .map((kk) =>
                    kepala(
                      `${aman(kk.label)}<div style="font-weight:400;text-transform:none;letter-spacing:0;color:${t.sub}">bobot ${kk.bobot}%</div>`,
                      "text-align:right",
                    ),
                  )
                  .join("")
              : kepala("", "width:120px")
          }${kepala("Total", "text-align:right;width:74px")}${kepala("Peringkat", "text-align:right;width:160px")}</tr></thead>
          <tbody>${baris}</tbody>
        </table>
      </div>`;
    })
    .join("");

  return `<!doctype html><html lang="id"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${aman(judul)} — ${aman(labelPeriode(periode))}</title>
<style>
  * { box-sizing:border-box; margin:0; padding:0; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  body { font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; background:${t.bg}; color:${t.text}; padding:24px; }
  .sheet { max-width:840px; margin:0 auto; background:${t.card}; border:1px solid ${t.border}; border-radius:16px; overflow:hidden; }
  .band { background:${t.band}; color:${t.bandText}; padding:22px 28px; display:flex; justify-content:space-between; align-items:center; gap:20px; }
  .band h1 { font-size:18px; font-weight:700; letter-spacing:-0.01em; }
  .band p { font-size:12px; opacity:0.7; margin-top:3px; }
  .body { padding:22px 28px 24px; }
  .sec-title { font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; color:${t.sub}; margin:20px 0 8px; }
  .ringkas { display:flex; gap:10px; }
  .grup { margin-top:22px; }
  .grup-judul { display:flex; align-items:baseline; justify-content:space-between; gap:12px; padding-bottom:7px; border-bottom:2px solid ${t.text}1a; margin-bottom:2px;
                font-size:12.5px; font-weight:700; color:${t.text}; }
  .grup-catatan { font-size:10.5px; font-weight:400; color:${t.sub}; white-space:nowrap; }
  .foot { margin-top:24px; padding-top:14px; border-top:1px solid ${t.border}; color:${t.sub}; font-size:10.5px; display:flex; justify-content:space-between; gap:16px; }
  /* Satu orang tidak boleh terbelah dua halaman — nama di halaman ini dan
     angkanya di halaman berikutnya adalah cara paling mudah salah bayar.
     Judul kelompok juga tidak boleh berdiri sendiri di kaki halaman. */
  table { page-break-inside:auto; }
  tr { page-break-inside:avoid; }
  .grup-judul { page-break-after:avoid; }
  .grup { page-break-inside:auto; }
  @media print { body { background:#fff; padding:0; } .sheet { border:none; border-radius:0; max-width:none; } }
</style></head><body>
  <div class="sheet">
    <div class="band">
      <div style="display:flex;align-items:center;gap:14px;min-width:0">${logo()}<div style="min-width:0"><h1>${aman(judul)}</h1><p>Good Will Grow · ${aman(subjudul)}</p></div></div>
      <div style="text-align:right;flex-shrink:0">
        <p style="font-size:12px;opacity:0.85">${aman(labelPeriode(periode))}</p>
        <p style="margin-top:6px;font-size:26px;font-weight:800;opacity:1;line-height:1">${angka(rata, 0)}</p>
        <p style="font-size:10px;opacity:0.7;margin-top:2px">rata-rata</p>
      </div>
    </div>
    <div class="body">
      <div class="ringkas">
        ${kotak("Tercantum", String(semua.length), t, satuan)}
        ${kotak("Sudah dinilai", String(ada.length), t, ada.length === semua.length ? "lengkap" : `dari ${semua.length}`)}
        ${kotak("Belum dinilai", String(belum), t, belum > 0 ? "bukan nol" : "tidak ada")}
        ${kotak("Rata-rata", angka(rata), t, "yang sudah ada angkanya")}
      </div>
      ${sebaran(ada, belum, t)}
      ${bagian}
      <div class="foot">
        <span>Dasar pencairan KPI. Yang <b>belum dinilai</b> BUKAN nol — angkanya belum bisa dihitung, bukan gagal.</span>
        <span style="white-space:nowrap">Dicetak ${aman(new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }))}</span>
      </div>
    </div>
  </div>
</body></html>`;
}

/**
 * Dialog unduh — BENTUKNYA SAMA dengan dialog laporan posisi.
 *
 * Sebelumnya dialog ini berupa kotak kecil berisi dua tombol, tanpa
 * pratinjau — beda sendiri dari seluruh unduhan lain di aplikasi ini. Dua
 * dialog yang mengerjakan hal yang sama tapi bentuknya berbeda membuat yang
 * memakainya harus belajar dua kali, dan yang kedua selalu terasa seperti
 * bagian yang belum selesai.
 *
 * YANG DITAMBAHKAN DI SINI: pemilih orang. Tidak semua yang tercantum selalu
 * ikut dicairkan bulan itu — ada yang resign, ada yang cuti panjang, ada yang
 * sudah dibayar lewat jalur lain. Semuanya TERCENTANG dari awal, karena
 * memasukkan semua orang adalah keadaan yang benar hampir setiap bulan;
 * yang perlu tindakan hanya pengecualiannya.
 */
export function DialogDaftarKpi({
  open,
  onOpenChange,
  judul,
  subjudul,
  periode,
  kelompok,
  /** Pemilih orang ditampilkan. Matikan untuk daftar yang memang utuh. */
  bisaPilih = true,
  satuan = "orang",
  /**
   * Bentuk dokumennya. "pencairan" memakai tabel enam kolom milik Detail KPI
   * Divisi; "daftar" memakai bentuk lama yang dipakai KPI Supervisor.
   *
   * SATU DIALOG UNTUK KEDUANYA, bukan dua. Yang di sekelilingnya — pemilih
   * orang, pilihan terang/gelap, pratinjau, tombol cetak — sama persis, dan
   * dua salinan berarti perbaikan pada satu dialog diam-diam tidak sampai ke
   * yang lain.
   */
  bentuk = "daftar",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  judul: string;
  subjudul: string;
  periode: string;
  kelompok: KelompokKpi[];
  bisaPilih?: boolean;
  satuan?: string;
  bentuk?: "daftar" | "pencairan";
}) {
  const [mode, setMode] = React.useState<Mode | null>(null);
  /**
   * Yang DIKELUARKAN, bukan yang dimasukkan.
   *
   * Menyimpan daftar yang masuk berarti harus mengisinya ulang tiap kali
   * `kelompok` berubah — dan yang lupa terisi ulang menghasilkan dokumen
   * kosong. Menyimpan pengecualiannya membuat keadaan bawaan "semua ikut"
   * benar dengan sendirinya, tanpa satu baris penyetelan pun.
   */
  const [keluar, setKeluar] = React.useState<Set<string>>(() => new Set());

  const kunci = (grup: string, nama: string) => `${grup}\u0000${nama}`;

  const dipakai = React.useMemo<KelompokKpi[]>(
    () =>
      kelompok
        .map((k) => ({ ...k, orang: k.orang.filter((o) => !keluar.has(kunci(k.nama, o.nama))) }))
        .filter((k) => k.orang.length > 0),
    [kelompok, keluar],
  );

  const total = kelompok.reduce((n, k) => n + k.orang.length, 0);
  const ikut = dipakai.reduce((n, k) => n + k.orang.length, 0);

  const ubahBuka = (v: boolean) => {
    if (!v) setMode(null);
    onOpenChange(v);
  };

  const alih = (grup: string, nama: string) =>
    setKeluar((lama) => {
      const baru = new Set(lama);
      const k = kunci(grup, nama);
      if (baru.has(k)) baru.delete(k);
      else baru.add(k);
      return baru;
    });

  const alihGrup = (k: KelompokKpi) =>
    setKeluar((lama) => {
      const baru = new Set(lama);
      const semuaIkut = k.orang.every((o) => !baru.has(kunci(k.nama, o.nama)));
      for (const o of k.orang) {
        if (semuaIkut) baru.add(kunci(k.nama, o.nama));
        else baru.delete(kunci(k.nama, o.nama));
      }
      return baru;
    });

  const html = !mode
    ? ""
    : bentuk === "pencairan"
      ? buatPencairanKpiHtml({ judul, subjudul, periode, kelompok: dipakai, mode })
      : buatDaftarKpiHtml({ judul, subjudul, periode, kelompok: dipakai, mode, satuan });

  function cetak() {
    if (!html) return;
    const w = window.open("", "_blank", "width=900,height=1200");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 250);
  }

  return (
    <Dialog open={open} onOpenChange={ubahBuka}>
      <DialogContent title={judul} description={`${subjudul} · ${labelPeriode(periode)}`} className="max-w-6xl">
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
          <div className="flex h-[74vh] flex-col">
            <div className="flex items-center justify-between gap-2 border-b border-border p-3">
              <div className="inline-flex gap-1 rounded-lg border border-border bg-muted/50 p-1">
                <ChipMode aktif={mode === "terang"} onClick={() => setMode("terang")} ikon={<Sun className="size-3.5" />} label="Terang" />
                <ChipMode aktif={mode === "gelap"} onClick={() => setMode("gelap")} ikon={<Moon className="size-3.5" />} label="Gelap" />
              </div>
              <div className="flex items-center gap-2">
                {bisaPilih && (
                  <span className="text-[12px] tabular-nums text-muted-foreground">
                    {ikut} dari {total} {satuan}
                  </span>
                )}
                <Button onClick={cetak} disabled={ikut === 0}>
                  <Printer className="size-4" /> Cetak / Simpan PDF
                </Button>
              </div>
            </div>

            <div className="flex min-h-0 flex-1">
              {bisaPilih && (
                <div className="flex w-64 shrink-0 flex-col border-r border-border">
                  <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Yang ikut
                    </span>
                    {keluar.size > 0 && (
                      <button
                        type="button"
                        onClick={() => setKeluar(new Set())}
                        className="text-[11px] font-medium text-brand-600 hover:underline dark:text-brand-400"
                      >
                        Pilih semua
                      </button>
                    )}
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto p-2">
                    {kelompok.map((k) => {
                      const semuaIkut = k.orang.every((o) => !keluar.has(kunci(k.nama, o.nama)));
                      return (
                        <div key={k.nama} className="mb-2">
                          <button
                            type="button"
                            onClick={() => alihGrup(k)}
                            className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left hover:bg-muted"
                          >
                            <span
                              className={cn(
                                "grid size-4 shrink-0 place-items-center rounded border",
                                semuaIkut ? "border-brand-600 bg-brand-600 text-white" : "border-border",
                              )}
                            >
                              {semuaIkut && <Check className="size-3" />}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-foreground">{k.nama}</span>
                          </button>
                          {k.orang.map((o) => {
                            const ikutIni = !keluar.has(kunci(k.nama, o.nama));
                            return (
                              <button
                                key={o.nama}
                                type="button"
                                onClick={() => alih(k.nama, o.nama)}
                                className="flex w-full items-center gap-2 rounded-md py-1 pl-6 pr-1.5 text-left hover:bg-muted"
                              >
                                <span
                                  className={cn(
                                    "grid size-4 shrink-0 place-items-center rounded border",
                                    ikutIni ? "border-brand-600 bg-brand-600 text-white" : "border-border",
                                  )}
                                >
                                  {ikutIni && <Check className="size-3" />}
                                </span>
                                <span
                                  className={cn(
                                    "min-w-0 flex-1 truncate text-[12px]",
                                    ikutIni ? "text-foreground/85" : "text-muted-foreground line-through",
                                  )}
                                >
                                  {o.nama}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {ikut === 0 ? (
                <div className="grid min-h-0 flex-1 place-items-center p-6 text-center">
                  <p className="text-[13px] text-muted-foreground">
                    Tidak ada satu nama pun yang dipilih — centang minimal satu orang.
                  </p>
                </div>
              ) : (
                <iframe title={`Pratinjau ${judul}`} srcDoc={html} className="min-h-0 flex-1 bg-white" />
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------------- Daftar pencairan ---------------------------- */

/** Warna tiap hasil pencairan. Hijau–kuning–merah, bukan peringkat KPI:
 *  yang ditanyakan di dokumen ini cair atau tidak, bukan bagus atau tidak. */
const WARNA_CAIR: Record<string, string> = { penuh: "#10b981", separuh: "#f59e0b", tidak: "#f43f5e" };

/**
 * Warna penanda baris Head — ungu, SENGAJA bukan hijau/kuning/merah.
 *
 * Ketiga warna itu sudah dipakai menyatakan hasil pencairan di kolom terakhir.
 * Memakai salah satunya untuk menandai jabatan membuat satu baris berwarna bisa
 * berarti dua hal yang sama sekali berbeda, dan yang membaca cepat pasti
 * membacanya sebagai status.
 */
const WARNA_HEAD = "#8b5cf6";

function lencanaCair(c: BarisCair["hasil"], t: (typeof THEME)[Mode]): string {
  if (!c) {
    return `<span style="display:inline-block;padding:3px 10px;border-radius:999px;font-size:10px;background:${t.box};color:${t.sub};border:1px solid ${t.border};white-space:nowrap">Belum dinilai</span>`;
  }
  const w = WARNA_CAIR[c.jenis] ?? t.sub;
  return `<span style="display:inline-block;padding:3px 10px;border-radius:999px;font-size:10.5px;font-weight:700;background:${w}1f;color:${w};border:1px solid ${w}55;white-space:nowrap">${aman(c.label)}</span>`;
}

/**
 * DAFTAR PENCAIRAN KPI — satu tabel datar, bukan daftar per kelompok.
 *
 * Bentuknya ditentukan pemiliknya: No, Nama, Departemen, Capaian Personal,
 * Capaian Divisi, Hasil. Datar dan berkolom Departemen, bukan bersekat per
 * divisi — yang membayar membacanya sekali dari atas ke bawah dan mencentang
 * nama, bukan melompat antar bagian.
 *
 * KEDUA CAPAIAN DICETAK, walau yang menentukan cuma rata-ratanya. Orang yang
 * tidak cair akan bertanya kenapa, dan jawabannya ada di salah satu dari dua
 * kolom itu — tanpa keduanya, dokumen ini menimbulkan pertanyaan yang tidak
 * bisa dijawabnya sendiri.
 */
export function buatPencairanKpiHtml({
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
  // Datar, tapi URUTANNYA departemen dulu baru nama — supaya orang satu divisi
  // tetap berdekatan tanpa perlu sekat.
  const baris = kelompok
    .flatMap((k) => k.orang.map((o) => ({ ...o, departemen: k.nama })))
    .sort(
      (a, b) =>
        a.departemen.localeCompare(b.departemen, "id") ||
        Number(!!b.cair?.head) - Number(!!a.cair?.head) ||
        (b.nilai ?? -1) - (a.nilai ?? -1) ||
        a.nama.localeCompare(b.nama, "id"),
    );

  const hitung = (j: string) => baris.filter((o) => o.cair?.hasil?.jenis === j).length;
  const belum = baris.filter((o) => !o.cair?.hasil).length;
  const divisiAda = baris.map((o) => o.cair?.divisi ?? null).filter((n): n is number => n !== null);
  const rataDivisi = divisiAda.length ? divisiAda.reduce((x, y) => x + y, 0) / divisiAda.length : null;

  const sel = (i: string, g = "") =>
    `<td style="padding:8px 10px;border-bottom:1px solid ${t.border};font-size:11.5px;${g}">${i}</td>`;
  const kepala = (i: string, g = "") =>
    `<th style="padding:7px 10px;border-bottom:1px solid ${t.border};font-size:9.5px;text-transform:uppercase;letter-spacing:0.05em;color:${t.sub};text-align:left;${g}">${i}</th>`;

  const isi = baris
    .map((o, n) => {
      const c = o.cair;
      // DUA DESIMAL, bukan satu. Angkanya sudah dibulatkan dua desimal di
      // `bulatkanCapaian`, jadi mencetaknya dengan ketelitian yang sama membuat
      // yang di kertas PERSIS angka yang dipakai menentukan cair. Dengan satu
      // desimal, 85,96% tercetak "86%" di sebelah lencana "50% cair".
      const nilai = (v: number | null | undefined, tebal = false) =>
        v === null || v === undefined
          ? `<span style="color:${t.sub}">—</span>`
          : `<span style="color:${t.text};${tebal ? "font-weight:700;font-size:13px" : ""}">${angka(v, 2)}</span>`;
      // BARIS HEAD DIBERI WARNA. Daftarnya tiga puluh baris lebih dan
      // Head-nya tersebar di antara anak buahnya; tanpa penanda warna,
      // menemukan siapa Head divisi tertentu berarti membaca satu per satu.
      const kepalaDivisi = !!c?.head;
      return `<tr style="background:${kepalaDivisi ? `${WARNA_HEAD}14` : n % 2 ? t.box : "transparent"}">
      ${sel(
        `<span style="color:${kepalaDivisi ? WARNA_HEAD : t.sub};font-size:10.5px;font-weight:${kepalaDivisi ? 700 : 400}">${n + 1}</span>`,
        `width:30px;text-align:right;border-left:3px solid ${kepalaDivisi ? WARNA_HEAD : "transparent"}`,
      )}
      ${sel(
        `<b style="color:${t.text}">${aman(o.nama)}</b>${
          kepalaDivisi ? ` <span style="display:inline-block;padding:1px 6px;border-radius:999px;font-size:9px;font-weight:700;background:${WARNA_HEAD}2b;color:${WARNA_HEAD};vertical-align:middle">HEAD</span>` : ""
        }${o.keterangan ? `<div style="color:${t.sub};font-size:10px;font-weight:400">${aman(o.keterangan)}</div>` : ""}`,
      )}
      ${sel(`<span style="color:${t.sub}">${aman(o.departemen)}</span>`)}
      ${sel(nilai(o.nilai), "text-align:right;width:92px;white-space:nowrap")}
      ${sel(nilai(c?.divisi ?? null), "text-align:right;width:88px;white-space:nowrap")}
      ${sel(
        [
          lencanaCair(c?.hasil ?? null, t),
          // TIDAK ADA lagi baris "dasar" di sini: dasarnya persis kolom Capaian
          // Divisi di sebelahnya, dan angka yang sama dicetak dua kali menuntut
          // pembacanya mencari bedanya — yang tidak ada.
          c?.alasan ? `<div style="color:${t.sub};font-size:9.5px;margin-top:3px;max-width:190px">${aman(c.alasan)}</div>` : "",
        ].join(""),
        "text-align:right;width:170px",
      )}
    </tr>`;
    })
    .join("");

  return `<!doctype html><html lang="id"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${aman(judul)} — ${aman(labelPeriode(periode))}</title>
<style>
  * { box-sizing:border-box; margin:0; padding:0; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  body { font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; background:${t.bg}; color:${t.text}; padding:24px; }
  .sheet { max-width:880px; margin:0 auto; background:${t.card}; border:1px solid ${t.border}; border-radius:16px; overflow:hidden; }
  .band { background:${t.band}; color:${t.bandText}; padding:22px 28px; display:flex; justify-content:space-between; align-items:center; gap:20px; }
  .band h1 { font-size:18px; font-weight:700; letter-spacing:-0.01em; }
  .band p { font-size:12px; opacity:0.7; margin-top:3px; }
  .body { padding:22px 28px 24px; }
  .sec-title { font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; color:${t.sub}; margin:20px 0 8px; }
  .ringkas { display:flex; gap:10px; }
  .aturan { margin-top:18px; display:flex; flex-wrap:wrap; gap:8px; }
  .aturan span { font-size:10.5px; color:${t.sub}; background:${t.box}; border:1px solid ${t.border}; border-radius:8px; padding:6px 10px; }
  .foot { margin-top:22px; padding-top:14px; border-top:1px solid ${t.border}; color:${t.sub}; font-size:10.5px; display:flex; justify-content:space-between; gap:16px; }
  /* Satu orang tidak boleh terbelah dua halaman — nama di halaman ini dan
     angkanya di halaman berikutnya adalah cara paling mudah salah bayar. */
  table { page-break-inside:auto; }
  tr { page-break-inside:avoid; }
  thead { display:table-header-group; }
  @media print { body { background:#fff; padding:0; } .sheet { border:none; border-radius:0; max-width:none; } }
</style></head><body>
  <div class="sheet">
    <div class="band">
      <div style="display:flex;align-items:center;gap:14px;min-width:0">${logo()}<div style="min-width:0"><h1>${aman(judul)}</h1><p>Good Will Grow · ${aman(subjudul)}</p></div></div>
      <div style="text-align:right;flex-shrink:0">
        <p style="font-size:12px;opacity:0.85">${aman(labelPeriode(periode))}</p>
        <p style="margin-top:6px;font-size:26px;font-weight:800;opacity:1;line-height:1">${angka(rataDivisi, 2)}</p>
        <p style="font-size:10px;opacity:0.7;margin-top:2px">rata-rata divisi</p>
      </div>
    </div>
    <div class="body">
      <div class="ringkas">
        ${kotak("Tercantum", String(baris.length), t, "orang")}
        ${kotak("100% cair", String(hitung("penuh")), t, `${AMBANG_PENUH}% ke atas`)}
        ${kotak("50% cair", String(hitung("separuh")), t, `${AMBANG_SEPARUH}–${AMBANG_PENUH - 1}%`)}
        ${kotak("Tidak cair", String(hitung("tidak")), t, `di bawah ${AMBANG_SEPARUH}%`)}
        ${kotak("Belum dinilai", String(belum), t, belum > 0 ? "bukan nol" : "tidak ada")}
      </div>
      <div class="sec-title">Daftar Pencairan</div>
      <table style="width:100%;border-collapse:collapse">
        <thead><tr>
          ${kepala("No", "width:30px;text-align:right")}
          ${kepala("Nama")}
          ${kepala("Departemen")}
          ${kepala("Capaian Personal", "text-align:right;width:92px")}
          ${kepala("Capaian Divisi", "text-align:right;width:88px")}
          ${kepala("Hasil", "text-align:right;width:170px")}
        </tr></thead>
        <tbody>${isi}</tbody>
      </table>
      <div class="aturan">
        <span><b style="color:${WARNA_HEAD}">Baris berwarna</b> — Head divisi.</span>
        <span><b style="color:${t.text}">Capaian Personal</b> — KPI orangnya sendiri, sebagai gambaran; <b>tidak</b> ikut menentukan pencairan.</span>
        <span><b style="color:${t.text}">Capaian Divisi</b> — rata-rata KPI divisinya, sekaligus KPI Head-nya. <b>Inilah yang menentukan pencairan.</b></span>
        <span><b style="color:${WARNA_CAIR.penuh}">≥ ${AMBANG_PENUH}%</b> 100% cair · <b style="color:${WARNA_CAIR.separuh}">${AMBANG_SEPARUH}–${AMBANG_PENUH - 1}%</b> 50% cair · <b style="color:${WARNA_CAIR.tidak}">&lt; ${AMBANG_SEPARUH}%</b> tidak cair</span>
      </div>
      <div class="foot">
        <span>Dasar pencairan KPI. Yang <b>belum dinilai</b> BUKAN nol — angkanya belum bisa dihitung, bukan gagal.</span>
        <span style="white-space:nowrap">Dicetak ${aman(new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }))}</span>
      </div>
    </div>
  </div>
</body></html>`;
}
