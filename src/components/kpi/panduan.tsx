"use client";

import * as React from "react";
import { BookOpen, TriangleAlert } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import type { Indikator } from "@/lib/kpi/indikator";
import { PERTUMBUHAN, TARGET_MARGIN, UMUR_SAME_STORE } from "@/lib/kpi/manajemen";

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
          <Awas>
            Gross Sales, Net Profit, dan Harga Pokok Penjualan TIDAK bisa diubah Coordinator Area — ketiganya angka yang
            menilai Anda sendiri. Satu-satunya yang Anda isi adalah Hygiene Audit/CCTV. Kalau ada angka yang keliru,
            laporkan ke master admin.
          </Awas>
        </>
      ),
    },
    {
      judul: "Net Profit — dibaca, bukan diisi",
      isi: (
        <>
          Diinput master admin dari laporan keuangan. Targetnya <b>30% dari gross sales</b> outlet itu. Buka{" "}
          <b>Detail Net Profit</b> untuk melihat angkanya per outlet beserta persentasenya terhadap gross sales — di
          situ juga terlihat outlet mana yang belum disetor. Angkanya boleh <b>minus</b>; outlet yang rugi memang ada,
          dan justru itu yang perlu terbaca.
        </>
      ),
    },
    {
      judul: "Harga Pokok Penjualan — dibaca, bukan diisi",
      isi: (
        <>
          Juga diinput master admin, dalam <b>nominal rupiah</b>; persentasenya terhadap gross sales dihitung otomatis.
          Batasnya 40%: di bawah atau tepat 40% bernilai penuh, lewat sedikit pun bernilai nol — tidak ada nilai
          separuh. Lihat rinciannya di <b>Detail Harga Pokok Penjualan</b>.
        </>
      ),
    },
    {
      judul: "Hygiene Audit / CCTV — 40 submit sebulan, wajib berbukti",
      isi: (
        <>
          Tekan <b>Catat Kegiatan</b> → <b>Hygiene Audit / CCTV Monitoring</b>. Tiap baris: tanggal, outlet, dan{" "}
          <b>bukti submit</b> (JPG, PNG, atau PDF, <b>maksimal 100 MB per berkas</b> dan boleh <b>beberapa berkas
          sekaligus</b>). Targetnya 10x per minggu = 40 per bulan. Saat mengunggah, bar <b>1–100%</b> menunjukkan
          kemajuannya — tiga berkas naik bersamaan supaya tidak menunggu satu per satu.
          <Awas>
            Baris tanpa bukti tidak bisa disimpan. Bukti adalah satu-satunya yang membedakan audit yang benar dilakukan
            dari yang hanya diketik. Foto dari ponsel baru memang bisa 20–40 MB — tidak perlu dikecilkan dulu.
          </Awas>
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
          Gunakan itu untuk mencari outlet yang belum disetor sebelum bulan ditutup. Bukti dibuka sebagai{" "}
          <b>pratinjau di halaman yang sama</b> — bukan tab baru — dan tombol panah kiri/kanan (atau tombol panah di
          papan ketik) berpindah antarbukti tanpa menutupnya. Kolom <b>Brand</b> berwarna
          (Nordu, Cattu, Busari, Lesung Pipi) memudahkan memisahkan merek yang margin dan ritmenya memang berbeda —
          ketik nama mereknya di kotak cari untuk menyaring satu merek saja.
        </>
      ),
    },
    {
      judul: "Detail Mingguan — outlet mana yang tertinggal minggu ini",
      isi: (
        <>
          Bentuk yang sama persis dengan KPI Manajemen, hanya outletnya dibatasi ke area Anda. Satu baris satu outlet,
          satu kolom satu minggu; kolom <b>Harus Dikejar</b> menyebut berapa yang harus masuk di minggu berjalan supaya
          kekurangan minggu sebelumnya ikut tertutup. Yang paling tertinggal ada di baris paling atas.
          <Awas>
            Mingguya dibagi menurut TANGGAL — 1–7, 8–14, 15–21, 22–28, lalu sisanya — bukan Senin–Minggu, supaya minggu
            ke-N bulan ini sebanding dengan minggu ke-N bulan lalu. Targetnya memakai rata-rata tiga bulan outlet itu
            sendiri + 15%, angka yang sama dengan indikator Gross Sales, jadi satu outlet tidak mungkin terbaca gagal di
            sini tapi tercapai di indikatornya.
          </Awas>
          <Awas>
            Grafiknya ikut berganti jadi <b>omzet per minggu</b>. Mingguan, bukan harian: angka harian yang ada hanya
            milik seluruh perusahaan dan tidak bisa dipisah per outlet, sehingga tidak bisa dipersempit ke satu area.
            Batang pudar berarti minggunya belum selesai — bukan berarti buruk. Outlet yang mingguanya belum ditarik ESB
            ditulis <b>&ldquo;belum ditarik&rdquo;</b>, bukan nol.
          </Awas>
        </>
      ),
    },
    {
      judul: "Cetak laporannya",
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
  const dariEntri = indikator.filter(
    (i) => i.actual.sumber === "entri" || i.actual.sumber === "pengurang" || i.actual.sumber === "harian",
  );
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

/** Kerangka dialognya — dipakai panduan posisi maupun panduan manajemen. */
function Panduan({ langkah, deskripsi }: { langkah: Langkah[]; deskripsi: string }) {
  const [buka, setBuka] = React.useState(false);
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
        <DialogContent title="Panduan Pengisian KPI" description={deskripsi} className="max-w-2xl">
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

export function DialogPanduan({ indikator, perOutlet }: { indikator: Indikator[]; perOutlet: boolean }) {
  const langkah = React.useMemo(() => (perOutlet ? langkahCa() : langkahUmum(indikator)), [perOutlet, indikator]);
  return <Panduan langkah={langkah} deskripsi="Dibaca sekali, dipakai tiap bulan — urut dari langkah pertama sampai selesai." />;
}

/**
 * Panduan Kalkulator KPI Manajemen.
 *
 * Yang paling perlu dijelaskan di sini bukan cara mengisinya — hampir semuanya
 * otomatis — melainkan DARI MANA tiap angka datang. Skor manajemen dibaca di
 * rapat korporat, dan angka yang tidak bisa ditelusuri asalnya akan
 * diperdebatkan setiap bulan tanpa pernah selesai.
 */
export function DialogPanduanManajemen() {
  const langkah = React.useMemo<Langkah[]>(
    () => [
      {
        judul: "Pilih bulannya lebih dulu",
        isi: <>Seluruh angka di halaman ini mengikuti bulan yang dipilih di bilah paling atas.</>,
      },
      {
        judul: "A — Gross Sales Corporate (bobot 40%)",
        isi: (
          <>
            Otomatis dari ESB, kecuali bulan yang diisi tangan — di situ angka ketikanlah yang dipakai. Target ={" "}
            <b>rata-rata omzet tiga bulan sebelumnya + {PERTUMBUHAN}%</b>, actual = omzet bulan berjalan.
            SELURUH outlet ikut, termasuk yang baru buka — pertumbuhan korporat tidak boleh menghukum pembukaan outlet
            baru.
          </>
        ),
      },
      {
        judul: "B — Same Store Sales (bobot 30%)",
        isi: (
          <>
            Hanya <b>outlet berumur di atas {UMUR_SAME_STORE} bulan</b>. Target tiap outlet ={" "}
            <b>rata-rata tiga bulan outlet itu sendiri + {PERTUMBUHAN}%</b>, lalu seluruhnya dijumlahkan.
            <Awas>
              Umur dihitung dari tanggal buka outlet, dengan aturan tanggal 15 yang sama dengan KPI Coordinator Area.
              Kalau tanggalnya belum diisi, yang dipakai omzetnya sendiri: outlet yang punya penjualan di KETIGA bulan
              pembanding sudah pasti berjalan lebih dari tiga bulan. Tanggal buka yang ADA tetap menang atas omzet.
            </Awas>
          </>
        ),
      },
      {
        judul: "C — EBITDA Same Store (bobot 20%)",
        isi: (
          <>
            Margin = laba bersih ÷ sales same store, target <b>{TARGET_MARGIN}%</b>. Laba bersihnya datang dari isian
            bulanan Coordinator Area, dan salesnya dari komponen B — seluruhnya otomatis, tidak ada yang diketik di
            halaman ini. Outlet yang laba bersihnya belum diisi <b>dilewati</b>, bukan dihitung nol.
          </>
        ),
      },
      {
        judul: "D — KPI All Division (bobot 10%)",
        isi: (
          <>
            Dihitung <b>dua tingkat</b>: nilai tiap posisi dirata-ratakan di dalam departemennya, lalu rata-rata
            departemen itulah yang dirata-ratakan lagi. Jadi tiap departemen bersuara sekali, berapa pun jumlah
            posisinya — Finance dengan tiga posisi tidak berbobot tiga kali Marketing Communication yang punya satu.
            <Awas>
              Seluruhnya otomatis dari modul KPI masing-masing; tidak ada satu angka pun yang diketik. Posisi baru
              cukup didaftarkan strukturnya dan langsung ikut terhitung bulan itu juga. Posisi yang modulnya belum
              menghasilkan angka DILEWATI, bukan dihitung nol — nol berarti dinilai dan gagal, sedangkan yang
              sebenarnya terjadi adalah belum diukur.
            </Awas>
          </>
        ),
      },
      {
        judul: "Membaca skornya",
        isi: (
          <>
            Skor akhir = A + B + C + D, skala 0–100. Pencapaian di atas 100% <b>tidak</b> menambah skor melebihi
            bobotnya. Ambangnya: Sangat Baik ≥ 85, Baik ≥ 70, Perlu Perhatian ≥ 50, di bawah itu Kritis.
            <Awas>
              Kolom <b>Persentase</b> berwarna hijau begitu mendekati target dan merah selama masih jauh; kolom{" "}
              <b>%</b> di sebelahnya menyebut sumbangan komponen itu ke skor perusahaan. Ikon <b>ⓘ</b> di samping nama
              komponen memuat rumusnya — arahkan kursor untuk membacanya.
            </Awas>
          </>
        ),
      },
      {
        judul: "Enam tabel, satu per pertanyaan",
        isi: (
          <>
            Pengalih di atas tabel berpindah antara <b>Komponen</b> (ringkasan keempatnya), <b>Detail Gross Sales
            Corporate</b>, <b>Detail Same Store</b>, <b>Detail EBITDA Same Store</b>, <b>Detail Mingguan</b>, dan{" "}
            <b>Detail KPI Divisi</b>.
            Ketiga tabel detail outlet berbentuk sama: bulan lalu, bulan ini, dan perbandingannya, dengan lencana{" "}
            <b>Brand</b> berwarna supaya Nordu, Cattu, Busari, dan Lesung Pipi mudah dibedakan sekilas.
          </>
        ),
      },
      {
        judul: "Grafik ikut tabel yang dibuka",
        isi: (
          <>
            Di ketiga tabel detail, grafiknya berganti jadi <b>omzet per tanggal</b>: garis biru bulan berjalan, abu-abu
            bulan lalu di tanggal yang sama, dan garis putus-putus oranye target harian. Tanggal yang{" "}
            <b>menembus target</b> ditandai titik hijau berdenyut, dan Sabtu–Minggu ditulis merah.
            <Awas>
              Angka harian datang dari catatan penjualan harian SELURUH perusahaan — ia tidak bisa dipisah per outlet
              dan tidak mengenal bulan yang diisi tangan. Pakai untuk melihat bentuk bulannya, bukan untuk mencocokkan
              totalnya dengan kartu Gross Sales.
            </Awas>
          </>
        ),
      },
      {
        judul: "Detail Mingguan — siapa yang tertinggal, dan harus mengejar berapa",
        isi: (
          <>
            Satu baris satu outlet, satu kolom satu minggu. Tiap sel memuat omzet minggu itu dan capaiannya terhadap
            target minggu itu sendiri; kolom <b>Harus Dikejar</b> menyebut berapa yang harus masuk di minggu berjalan
            supaya kekurangan minggu-minggu sebelumnya ikut tertutup. Yang paling tertinggal berada di baris paling
            atas.
            <Awas>
              Mingguya dibagi menurut TANGGAL — 1–7, 8–14, 15–21, 22–28, lalu sisanya — bukan Senin–Minggu. Minggu yang
              mengikuti hari akan bergeser tiap bulan, dan minggu ke-N dua bulan berbeda tidak lagi bisa dibandingkan.
              Minggu terakhir memang cuma 2–3 hari, karena itu targetnya ikut lebih kecil: dibagi porsi hari, bukan
              dibagi jumlah minggu.
            </Awas>
            <Awas>
              Angkanya ditarik dari ESB satu panggilan per outlet per minggu dan berjalan sendiri tiap jam. Outlet yang
              mingguanya belum ditarik ditulis <b>&ldquo;belum ditarik&rdquo;</b>, bukan nol — nol berarti tutup
              seminggu penuh. Outlet yang omzetnya diketik bulanan (belum masuk ESB) ditandai{" "}
              <b>&ldquo;diketik bulanan&rdquo;</b> dan tidak ikut dijumlahkan ke baris Seluruh Outlet, supaya totalnya
              tidak tertarik ke bawah oleh outlet yang memang tidak terukur mingguan.
            </Awas>
          </>
        ),
      },
      {
        judul: "Rincian departemen dibuka di tempat",
        isi: (
          <>
            Di <b>Detail KPI Divisi</b>, tekan nama departemen untuk membuka daftar posisinya tepat di bawah barisnya —
            lengkap dengan nilai bulan ini, bulan lalu, dan selisihnya. Beberapa departemen bisa dibuka sekaligus untuk
            dibandingkan.
          </>
        ),
      },
      {
        judul: "Unduh laporannya",
        isi: (
          <>
            Ikon <b>unduh</b> di samping kotak cari — ada di setiap tabel — mengeluarkan laporan PDF lengkap dengan
            grafiknya, dengan pilihan mode terang atau gelap.
          </>
        ),
      },
      {
        judul: "Pengaturan bobot dan target",
        isi: (
          <>
            Tombol <b>Pengaturan</b> (hanya master admin) mengatur bobot keempat komponen, laju pertumbuhan, target
            margin EBITDA, ambang tercapai, dan umur minimum same store. Berlaku untuk <b>seluruh bulan</b>, bukan
            bulan yang sedang dibuka.
            <Awas>
              Jumlah bobot wajib 100. Kalau tidak, skor tertinggi ikut bergeser dan perusahaan akan tampak gagal
              padahal pembaginya yang salah — karena itu simpan ditolak selama jumlahnya belum 100.
            </Awas>
          </>
        ),
      },
    ],
    [],
  );
  return <Panduan langkah={langkah} deskripsi="Empat komponen berbobot — dari mana angkanya datang dan bagaimana membacanya." />;
}
