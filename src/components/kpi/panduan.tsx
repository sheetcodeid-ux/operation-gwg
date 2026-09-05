"use client";

import * as React from "react";
import { BookOpen, TriangleAlert } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import type { Indikator } from "@/lib/kpi/indikator";

/**
 * Panduan pengisian KPI — dibaca sebelum menyentuh satu pun angka.
 *
 * MENGAPA ADA. Aturan KPI ini tidak ada di dalam kepala orang yang mengisinya:
 * berapa target Gross Sales dibentuk, kenapa outlet baru tidak dinilai, kenapa
 * satu bukti wajib dilampirkan, kenapa harga pokok minta nominal bukan persen.
 * Selama jawabannya hanya ada di percakapan, tiap orang baru mengisi dengan
 * tebakannya sendiri — dan angka yang salah isi tidak pernah terlihat salah.
 *
 * ISINYA MENGIKUTI POSISINYA. Panduan yang menyebut outlet dan hygiene audit
 * kepada Content Creator hanya membuat panduannya berhenti dibaca; yang tampil
 * adalah langkah untuk indikator yang benar-benar dinilai pada posisi itu, dan
 * daftar indikatornya dibangun dari indikatornya sendiri, bukan diketik ulang.
 */

interface Langkah {
  judul: string;
  isi: React.ReactNode;
}

function Nomor({ n }: { n: number }) {
  return (
    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
      {n}
    </span>
  );
}

function Awas({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-2 flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/[0.07] px-3 py-2 text-[12px] leading-relaxed text-amber-800 dark:text-amber-200">
      <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

/** Langkah khusus Coordinator Area — satu-satunya posisi yang dinilai per outlet. */
function langkahCa(): Langkah[] {
  return [
    {
      judul: "Pilih bulan dan nama Anda lebih dulu",
      isi: (
        <>
          Di bilah paling atas: pilih <b>tahun</b>, <b>bulan</b>, lalu <b>nama Coordinator Area</b>. Seluruh angka di
          halaman ini mengikuti tiga pilihan itu. Pilihan <b>Semua</b> hanya untuk melihat gabungan seluruh area — angka
          tidak bisa disimpan sambil memilih Semua, karena angka yang disimpan di sana tidak menempel pada siapa pun.
        </>
      ),
    },
    {
      judul: "Baca dulu tabel Indikator",
      isi: (
        <>
          Kolomnya dibaca begini: <b>Target</b> adalah yang seharusnya, <b>Actual</b> yang tercapai,{" "}
          <b>Persentase</b> = actual ÷ target (dibatasi 100%), dan <b>% Actual</b> = bobot × persentase — itulah
          sumbangan indikator tersebut ke skor bulan ini. Indikator bertulisan &ldquo;belum terukur&rdquo; TIDAK
          bernilai nol; ia dikeluarkan dari hitungan sampai datanya ada.
        </>
      ),
    },
    {
      judul: "Gross Sales — otomatis, tidak perlu diisi",
      isi: (
        <>
          Actual-nya ditarik sendiri dari ESB tiap hari, dijumlah dari seluruh outlet area Anda. Targetnya ={" "}
          <b>rata-rata 3 bulan sebelumnya + 15%</b>. Tiga outlet yang belum tersambung ESB (Ayam Goreng Busari Serdam,
          Ayam Goreng Busari Siantan, Nordu Coffee Siantan) diisi tangan oleh master admin.
          <Awas>Coordinator Area tidak punya hak mengubah Gross Sales maupun Harga Pokok Penjualan — keduanya angka yang menilai Anda sendiri. Kalau ada yang keliru, laporkan ke master admin.</Awas>
        </>
      ),
    },
    {
      judul: "Net Profit — diisi per outlet",
      isi: (
        <>
          Tekan <b>Catat Kegiatan</b> → pilih <b>Net Profit (per outlet)</b>. Isi <b>nominal rupiah</b> laba bersih tiap
          outlet; persentasenya terhadap gross sales dihitung sendiri di kolom sebelahnya. Targetnya 30% dari gross
          sales outlet itu. Angka boleh <b>minus</b> — outlet yang rugi memang ada, dan justru itu yang perlu terbaca.
          Bisa juga lewat <b>Export</b> lalu <b>Import</b> berkas Excel bila outletnya banyak.
        </>
      ),
    },
    {
      judul: "Harga Pokok Penjualan — nominal, bukan persen",
      isi: (
        <>
          Yang diisi <b>nominal rupiah</b> harga pokok, bukan persentasenya. Persentase terhadap gross sales dihitung
          otomatis. Batasnya 40%: di bawah atau tepat 40% bernilai penuh, lewat sedikit pun bernilai nol — tidak ada
          nilai separuh.
        </>
      ),
    },
    {
      judul: "Hygiene Audit / CCTV — 40 submit sebulan, wajib berbukti",
      isi: (
        <>
          Tekan <b>Catat Kegiatan</b> → <b>Hygiene Audit / CCTV Monitoring</b>. Tiap baris: tanggal, outlet, dan{" "}
          <b>bukti submit</b> (JPG, PNG, atau PDF, maksimal 10 MB). Targetnya 10x per minggu = 40 per bulan.
          <Awas>Baris tanpa bukti tidak bisa disimpan. Bukti adalah satu-satunya yang membedakan audit yang benar dilakukan dari yang hanya diketik.</Awas>
        </>
      ),
    },
    {
      judul: "Complaint — otomatis, tiap satu komplain berbiaya",
      isi: (
        <>
          Dihitung sendiri dari modul Complaints, di luar kategori kualitas makanan. Batasnya 20 sebulan, dan
          hitungannya <b>menurun tiap satu komplain</b>: satu komplain memotong 5% capaian indikator ini (0,5% dari
          skor total), 20 komplain membuatnya nol. Nol komplain bernilai penuh.
        </>
      ),
    },
    {
      judul: "Aturan tiga bulan — outlet baru tidak dinilai",
      isi: (
        <>
          Outlet yang belum genap tiga bulan berjalan dikeluarkan dari <b>seluruh</b> indikator, bukan hanya Gross
          Sales. Outlet baru selalu menyeret rata-rata ke bawah dan komplain awal yang wajar akan terhitung sebagai
          kegagalan. Di tabel detail, outlet seperti itu tetap tampil tapi ditandai{" "}
          <b>&ldquo;belum 3 bulan&rdquo;</b>.
        </>
      ),
    },
    {
      judul: "Periksa lewat tabel detail",
      isi: (
        <>
          Tombol di atas tabel: <b>Detail Hygiene Audit/CCTV</b>, <b>Detail Net Profit</b>, dan{" "}
          <b>Detail Harga Pokok Penjualan</b> memperlihatkan apa yang sudah masuk per outlet beserta persentasenya.
          Gunakan itu untuk mencari outlet yang belum disetor sebelum bulan ditutup.
        </>
      ),
    },
    {
      judul: "Simpan dan cetak laporannya",
      isi: (
        <>
          Ikon <b>unduh</b> di samping kolom cari mengeluarkan <b>laporan KPI dalam PDF</b> lengkap dengan grafiknya —
          pilih mode terang atau gelap. Bukti hygiene bisa diunduh sekaligus jadi satu arsip lewat tombol{" "}
          <b>Unduh semua bukti</b>.
          <Awas>Bulan yang sudah dikunci tidak bisa diubah lagi. Pastikan seluruh outlet terisi sebelum penutupan.</Awas>
        </>
      ),
    },
  ];
}

/** Langkah umum — dipakai posisi yang tidak dinilai per outlet. */
function langkahUmum(indikator: Indikator[]): Langkah[] {
  const dariEntri = indikator.filter((i) => i.actual.sumber === "entri" || i.actual.sumber === "pengurang");
  const otomatis = indikator.filter((i) => i.actual.sumber === "otomatis");
  const manual = indikator.filter((i) => i.actual.sumber === "manual" || i.actual.sumber === "manual_brand");
  const daftar = (d: Indikator[]) => d.map((i) => i.label).join(", ");

  return [
    {
      judul: "Pilih bulan lebih dulu",
      isi: <>Di bilah paling atas, pilih <b>tahun</b> dan <b>bulan</b>. Seluruh angka di halaman ini mengikuti pilihan itu.</>,
    },
    {
      judul: "Baca kolom tabel Indikator",
      isi: (
        <>
          <b>Target</b> yang seharusnya, <b>Actual</b> yang tercapai, <b>Persentase</b> = actual ÷ target (dibatasi
          100%), dan <b>% Actual</b> = bobot × persentase — sumbangan indikator itu ke skor bulan ini. Yang tertulis
          &ldquo;belum terukur&rdquo; tidak dihitung nol; ia dikeluarkan sampai datanya ada.
        </>
      ),
    },
    ...(dariEntri.length
      ? [
          {
            judul: "Catat kegiatan satu per satu",
            isi: (
              <>
                Tekan <b>Catat Kegiatan</b>, pilih indikatornya, lalu isi barisnya. Yang dihitung dari jumlah catatan:{" "}
                <b>{daftar(dariEntri)}</b>. Satu baris = satu poin, jadi jangan mencatat kegiatan yang sama dua kali.
              </>
            ),
          },
        ]
      : []),
    ...(manual.length
      ? [
          {
            judul: "Isi angka yang tidak bisa ditarik otomatis",
            isi: (
              <>
                Tekan <b>Input</b> untuk indikator berikut: <b>{daftar(manual)}</b>. Isi angkanya apa adanya — jangan
                dibulatkan lebih dulu, pembulatan dilakukan hanya saat ditampilkan.
              </>
            ),
          },
        ]
      : []),
    ...(otomatis.length
      ? [
          {
            judul: "Yang tidak perlu diisi sama sekali",
            isi: (
              <>
                <b>{daftar(otomatis)}</b> ditarik sendiri dari modul lain. Kalau angkanya terasa keliru, perbaiki di
                modul asalnya — mengetiknya ulang di sini tidak akan tersimpan.
              </>
            ),
          },
        ]
      : []),
    {
      judul: "Periksa sebelum bulan ditutup",
      isi: (
        <>
          Buka <b>Riwayat Input</b> untuk melihat seluruh baris yang tercatat bulan ini; menghapus satu baris ikut
          menurunkan capaian. Ikon <b>unduh</b> di samping kolom cari mengeluarkan laporan KPI dalam PDF.
          <Awas>Bulan yang sudah dikunci tidak bisa diubah lagi.</Awas>
        </>
      ),
    },
  ];
}

export function DialogPanduan({ indikator, perOutlet }: { indikator: Indikator[]; perOutlet: boolean }) {
  const [buka, setBuka] = React.useState(false);
  const langkah = React.useMemo(() => (perOutlet ? langkahCa() : langkahUmum(indikator)), [perOutlet, indikator]);

  return (
    <>
      <button
        type="button"
        onClick={() => setBuka(true)}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-2.5 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <BookOpen className="size-3.5" /> Panduan
      </button>
      <Dialog open={buka} onOpenChange={setBuka}>
        <DialogContent
          title="Panduan Pengisian KPI"
          description="Dibaca sekali, dipakai tiap bulan — urut dari langkah pertama sampai selesai."
          className="max-w-2xl"
        >
          <div className="max-h-[70vh] overflow-y-auto p-5">
            <ol className="space-y-4">
              {langkah.map((l, i) => (
                <li key={l.judul} className="flex gap-3">
                  <Nomor n={i + 1} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-foreground">{l.judul}</p>
                    <div className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">{l.isi}</div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
