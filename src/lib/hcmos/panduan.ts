/**
 * Panduan tiap halaman Human Capital — cara mengisinya, dan sambungannya.
 *
 * MENGAPA INI ADA.
 *
 * HC-MOS bukan kumpulan halaman yang berdiri sendiri; ia satu rantai. Kontrak
 * yang tidak diisi membuat Database Karyawan bolong, KPI "Kepatuhan Kontrak"
 * anjlok, dan angka turnover di Dashboard Monitoring salah — tanpa ada satu
 * pun pesan galat, karena secara teknis tidak ada yang gagal. Kesalahan
 * seperti itu tidak ketahuan dari layarnya sendiri. Yang membuatnya ketahuan
 * adalah tahu bahwa layar itu punya hilir.
 *
 * Maka tiap halaman di sini menjawab empat hal yang tidak terbaca dari
 * tampilannya:
 *
 *   1. untuk apa halaman ini, dan siapa yang mengisinya — supaya tidak ada
 *      dua orang mengisi hal yang sama dengan cara berbeda;
 *   2. bagaimana mengisinya, kolom demi kolom, termasuk yang wajib;
 *   3. DATANYA MASUK DARI MANA dan KELUAR KE MANA — inilah bagian yang
 *      paling sering tidak diketahui, dan yang paling mahal kalau salah;
 *   4. kesalahan yang sudah pernah terjadi, ditulis supaya tidak terulang.
 *
 * BERKAS INI SUMBER KEBENARANNYA. Halaman tidak menuliskan panduannya
 * sendiri-sendiri: kalau boleh, panduan yang sama akan hidup di dua tempat dan
 * mulai berbeda diam-diam — persis penyakit yang dihindari `pillars.ts`.
 *
 * Sambungan sengaja disimpan sebagai PASANGAN DUA ARAH: bila A berkata
 * "keluar ke B", B harus berkata "masuk dari A". Itu diperiksa oleh tes,
 * bukan oleh kedisiplinan penulisnya — peta yang setengah tersambung lebih
 * menyesatkan daripada tidak ada peta sama sekali.
 */

/**
 * Halaman yang DIISI orang, atau halaman yang hanya DIBACA.
 *
 * Pembedaan ini menentukan isi panduannya. Dashboard Monitoring tidak punya
 * kolom untuk diisi; menuliskan "panduan pengisian" di sana justru membuat
 * orang mencari tombol yang memang tidak ada. Yang dibutuhkan pembacanya:
 * angkanya datang dari mana, dan kalau salah, halaman mana yang diperbaiki.
 */
export type JenisPanduan = "isi" | "baca";

export type ArahSambungan = "masuk" | "keluar";

export interface Sambungan {
  arah: ArahSambungan;
  /** Id panduan lawan bicaranya — dipakai untuk memeriksa timbal baliknya. */
  ke: string;
  /** Apa yang mengalir, dalam kalimat yang berarti bagi pembacanya. */
  isi: string;
}

export interface Isian {
  nama: string;
  wajib: boolean;
  /** Cara mengisinya, bukan pengulangan namanya. */
  cara: string;
}

export interface Panduan {
  id: string;
  judul: string;
  /** Rute halamannya. Diperiksa tes terhadap daftar menu yang benar-benar ada. */
  href: string;
  jenis: JenisPanduan;
  /**
   * Pilar HC-MOS pemilik halaman ini — slug dari `pillars.ts`.
   *
   * Dari sinilah nama pilar dan PIC-nya diambil untuk bilah konteks di kepala
   * halaman. Dulu ketiganya diketik ulang di tiap halaman sebagai Badge, dan
   * itu keliru: begitu satu orang berpindah peran, dua belas halaman menyebut
   * nama yang salah dan tidak ada yang menyadarinya.
   */
  pilar?: string;
  /** Cakupannya. Kosong berarti dua-duanya. */
  scope?: "manajemen" | "outlet";
  /** Untuk apa halaman ini ada — satu-dua kalimat. */
  untuk: string;
  /** Siapa yang mengisi atau membacanya. */
  siapa: string;
  /** Kapan dikerjakan — irama kerjanya, bukan jam bukanya. */
  kapan: string;
  /** Urutan langkah. Untuk halaman baca: cara membacanya. */
  langkah: string[];
  /** Kolom demi kolom. Halaman baca boleh mengosongkannya. */
  isian: Isian[];
  sambungan: Sambungan[];
  /** Kesalahan yang sudah pernah terjadi. Kosong bila memang belum ada. */
  salah: string[];
}

/**
 * Sambungan yang berulang di banyak halaman, ditulis sekali.
 *
 * Hampir semua modul bermuara ke Monitoring dan KPI. Menuliskannya berulang
 * membuat kalimatnya perlahan berbeda-beda di tiap halaman padahal maksudnya
 * sama.
 */
const KE_MONITORING = (isi: string): Sambungan => ({ arah: "keluar", ke: "monitoring", isi });
const KE_KPI = (isi: string): Sambungan => ({ arah: "keluar", ke: "kpi", isi });

export const PANDUAN: Panduan[] = [
  {
    id: "hcmos",
    judul: "Dashboard HC-MOS",
    href: "/hc-mos",
    jenis: "baca",
    untuk:
      "Pintu masuk seluruh Human Capital: sembilan pilar HC-MOS, penanggung jawab tiap pilar, dan jalan ke modul yang menjalankannya.",
    siapa: "Seluruh tim Human Capital, dan siapa pun yang perlu tahu satu urusan HC ditangani siapa.",
    kapan: "Setiap kali tidak yakin satu pekerjaan HC masuk pilar mana atau harus menghubungi siapa.",
    langkah: [
      "Cari pilarnya lebih dulu — sembilan kartu di halaman ini mengikuti Juknis HC-MOS, bukan mengikuti susunan menu.",
      "Buka kartunya untuk melihat sub-menu, fungsi tiap sub-menu, dan matriks RACI-nya.",
      "Sub-menu yang sudah punya modul berjalan menampilkan tautannya — pakai tautan itu, jangan mencari modul serupa lewat pencarian menu.",
    ],
    isian: [],
    sambungan: [
      { arah: "keluar", ke: "pilar", isi: "Kartu pilar membuka halaman pilarnya beserta seluruh sub-menu." },
      { arah: "keluar", ke: "raci", isi: "Susunan pilar dan pemegang perannya dibaca dari sumber yang sama." },
      { arah: "masuk", ke: "monitoring", isi: "Angka ringkas di kartu diambil dari metrik Monitoring." },
    ],
    salah: [
      "Membuat modul baru untuk sub-menu yang sebenarnya sudah berjalan dengan nama lain. Periksa tautan di kartunya lebih dulu.",
    ],
  },
  {
    id: "pilar",
    judul: "Halaman Pilar",
    href: "/hc-mos/organization-development",
    jenis: "baca",
    untuk:
      "Rincian satu pilar: penanggung jawabnya, seluruh sub-menu beserta fungsinya, dan siapa memegang peran R/A/C/I untuk tiap aktivitas.",
    siapa: "PIC pilar dan siapa pun yang hendak mengajukan sesuatu ke pilar tersebut.",
    kapan: "Sebelum memulai aktivitas yang masuk pilar ini — supaya jelas harus minta persetujuan siapa.",
    langkah: [
      "Baca penanggung jawab pilarnya di kartu paling atas; dialah pemilik prosesnya.",
      "Turun ke sub-menu yang sesuai, baca fungsinya.",
      "Periksa baris RACI-nya: A adalah yang menyetujui, R yang mengerjakan, C yang wajib diajak bicara, I yang cukup diberi tahu.",
      "Kalau sub-menunya punya tautan modul, kerjakan di sana — bukan di luar sistem.",
    ],
    isian: [],
    sambungan: [
      { arah: "masuk", ke: "hcmos", isi: "Dibuka dari kartu pilar di dashboard." },
      { arah: "masuk", ke: "raci", isi: "Baris RACI yang tampil di sini dibaca dari matriksnya." },
      { arah: "keluar", ke: "dokumen", isi: "SOP tiap pilar tersimpan di Pusat Dokumen dengan penanda pilarnya." },
    ],
    salah: [
      "Menganggap PIC pilar otomatis pemegang A untuk semua aktivitas di dalamnya. Sering berbeda — bacalah barisnya, jangan menebak.",
    ],
  },
  {
    id: "raci",
    judul: "Matriks RACI",
    href: "/hc-mos/raci",
    jenis: "isi",
    pilar: "organization-development",
    untuk:
      "Menetapkan siapa memegang peran Responsible, Accountable, Consulted, dan Informed untuk setiap aktivitas HC — supaya tidak ada pekerjaan yang tidak bertuan atau punya dua pemilik.",
    siapa: "Human Capital (Head HC dan Organization & People Development). Yang lain membaca.",
    kapan:
      "Setiap kali ada orang masuk, keluar, atau berpindah jabatan; dan saat peninjauan struktur — bukan setahun sekali.",
    langkah: [
      "Cari barisnya lewat kolom pencarian, atau saring lewat pilar dan nama orang.",
      "Klik sel yang hendak diubah; panelnya terbuka di sisi kanan.",
      "Tambah atau hapus nama. Nama diusulkan dari daftar karyawan aktif — pakai usulannya supaya ejaannya seragam.",
      "Buka tab Pemeriksaan sebelum selesai: di sana terlihat baris yang belum punya A, punya A lebih dari satu, atau belum punya R sama sekali.",
      "Kalau satu orang berganti nama atau keluar, pakai Ganti Nama supaya seluruh barisnya ikut berubah sekaligus.",
    ],
    isian: [
      { nama: "Responsible (R)", wajib: true, cara: "Yang benar-benar mengerjakan. Boleh lebih dari satu orang." },
      {
        nama: "Accountable (A)",
        wajib: true,
        cara: "Tepat satu orang — yang menanggung hasil akhirnya. Dua nama di sini berarti tidak ada yang menanggung.",
      },
      { nama: "Consulted (C)", wajib: false, cara: "Yang pendapatnya harus diminta sebelum diputuskan." },
      { nama: "Informed (I)", wajib: false, cara: "Yang cukup diberi tahu setelah diputuskan." },
    ],
    sambungan: [
      { arah: "masuk", ke: "bagan", isi: "Nama yang diusulkan berasal dari karyawan aktif di struktur organisasi." },
      { arah: "masuk", ke: "hcmos", isi: "Susunan pilar dan aktivitasnya mengikuti kerangka HC-MOS." },
      { arah: "keluar", ke: "pilar", isi: "Baris yang sama tampil di halaman pilar masing-masing." },
    ],
    salah: [
      "Mengisi A dengan dua nama karena keduanya merasa bertanggung jawab. Justru itu tandanya perlu dipisah jadi dua aktivitas.",
      "Mengetik nama secara manual sehingga satu orang muncul dua kali dengan ejaan berbeda dan tidak pernah terhitung utuh.",
    ],
  },
  {
    id: "bagan",
    judul: "Struktur Organisasi",
    href: "/hc-mos/bagan",
    jenis: "isi",
    pilar: "organization-development",
    untuk:
      "Bagan siapa membawahi siapa. Inilah yang menentukan alur persetujuan di seluruh sistem, bukan sekadar gambar untuk dicetak.",
    siapa: "Human Capital. Perubahan atasan berdampak ke persetujuan, jadi tidak dibuka untuk divisi lain.",
    kapan: "Segera setelah ada mutasi, promosi, atau karyawan masuk/keluar. Menunda berarti persetujuan lari ke orang yang salah.",
    langkah: [
      "Cari orangnya lewat pencarian, atau telusuri cabangnya dari atas.",
      "Klik kartunya untuk melihat rinciannya; ubah atasan langsung dari sana.",
      "Periksa hasilnya di tampilan penuh — cabang yang menggantung tanpa atasan paling mudah terlihat di situ.",
    ],
    isian: [
      { nama: "Atasan langsung", wajib: true, cara: "Satu orang. Kosong hanya untuk puncak struktur." },
      { nama: "Jabatan", wajib: true, cara: "Nama jabatan resmi, sama dengan yang tertulis di kontrak." },
      { nama: "Departemen", wajib: true, cara: "Pilih dari daftar; departemen baru dibuat lebih dulu di User Management." },
    ],
    sambungan: [
      { arah: "masuk", ke: "karyawan", isi: "Daftar orang dan jabatannya berasal dari basis data karyawan." },
      { arah: "keluar", ke: "raci", isi: "Nama yang bisa dipilih sebagai pemegang peran." },
      { arah: "keluar", ke: "struktur", isi: "Profil Organisasi menggambar ulang struktur yang sama per brand." },
      { arah: "keluar", ke: "kinerja", isi: "Atasan langsung menentukan siapa menilai siapa." },
    ],
    salah: [
      "Mengubah jabatan tanpa mengubah atasan sehingga orangnya naik pangkat tapi persetujuannya tetap lewat atasan lama.",
    ],
  },
  {
    id: "struktur",
    judul: "Profil Organisasi",
    href: "/hc-mos/struktur",
    jenis: "baca",
    pilar: "organization-development",
    untuk: "Peta organisasi GWG Group — kantor pusat dan struktur operasional tiap brand dalam satu tampilan.",
    siapa: "Seluruh karyawan; dipakai untuk orientasi karyawan baru.",
    kapan: "Saat onboarding, dan saat perlu tahu satu brand dijalankan siapa.",
    langkah: [
      "Pilih brand-nya untuk melihat struktur operasionalnya.",
      "Untuk melihat atasan-bawahan per orang, buka Struktur Organisasi — halaman ini menggambarkan bentuk organisasinya, bukan jalur persetujuannya.",
    ],
    isian: [],
    sambungan: [
      { arah: "masuk", ke: "bagan", isi: "Bentuknya mengikuti bagan yang sama." },
      { arah: "keluar", ke: "modul", isi: "Dipakai sebagai bahan orientasi karyawan baru." },
    ],
    salah: [],
  },
  {
    id: "karyawan",
    judul: "Database Karyawan",
    href: "/hc-mos/karyawan",
    jenis: "baca",
    pilar: "organization-development",
    untuk:
      "Basis data induk karyawan. Halaman ini tidak punya formulir — isinya dirakit dari dua sumber supaya tidak ada data karyawan yang diketik dua kali.",
    siapa: "Human Capital.",
    kapan: "Saat perlu jumlah dan sebaran karyawan, atau memastikan satu orang benar-benar tercatat.",
    langkah: [
      "Karyawan Manajemen datang dari User Management — kalau ada yang kurang, tambahkan akunnya di sana.",
      "Karyawan Outlet datang dari Kontrak Tracker — kalau ada yang kurang, tambahkan barisnya di sana.",
      "Pakai kelompok divisi untuk melihat sebarannya; angka nonaktif adalah yang sudah keluar, bukan yang lupa diisi.",
    ],
    isian: [],
    sambungan: [
      { arah: "masuk", ke: "kontrak", isi: "Seluruh karyawan outlet beserta jabatan dan masa kontraknya." },
      { arah: "keluar", ke: "bagan", isi: "Orang yang bisa dipasang di struktur organisasi." },
      KE_MONITORING("Jumlah karyawan sebagai penyebut hampir semua metrik."),
    ],
    salah: [
      "Mencari tombol tambah di halaman ini. Menambah di sini akan membuat salinan kedua dari orang yang sama — tambahkan di sumbernya.",
    ],
  },
  {
    id: "kontrak",
    judul: "Kontrak Tracker",
    href: "/hc-mos/kontrak",
    jenis: "isi",
    pilar: "legal-compliance",
    untuk:
      "Mencatat PKWT/PKWTT seluruh outlet dan Manajemen: masa berlakunya, prioritas perpanjangannya, dan Update Bulanan dari supervisor.",
    siapa:
      "Supervisor outlet mengisi karyawan cabangnya. Human Capital mengisi karyawan Manajemen (kantor pusat & gudang) dan meninjau semuanya.",
    kapan:
      "Saat karyawan masuk, saat kontrak diperpanjang, saat karyawan keluar, dan setiap awal bulan untuk Update Bulanan.",
    langkah: [
      "Buka tab Karyawan, pilih outletnya. Karyawan Manajemen ditambahkan lewat tombol + Karyawan Manajemen dan memang tidak punya outlet.",
      "Isi identitas dan kontraknya; unggah berkasnya langsung — jangan menempel tautan Drive.",
      "Tanggal berakhir menentukan prioritas perpanjangan; kolom itu yang dibaca peringatan kontrak akan habis.",
      "Karyawan keluar: ubah statusnya dan isi alasan serta kategori turnover — dua kolom itu yang menghidupkan angka turnover.",
      "Setiap awal bulan, isi Update Bulanan outlet Anda. Yang tidak mengisi terhitung tidak patuh di KPI.",
    ],
    isian: [
      { nama: "Nama Lengkap", wajib: true, cara: "Sesuai KTP, bukan nama panggilan — inilah yang dipakai seluruh modul lain." },
      { nama: "NIP", wajib: false, cara: "Kosongkan bila belum terbit; jangan diisi angka sementara." },
      { nama: "Jabatan", wajib: true, cara: "Sesuai kontrak." },
      { nama: "Outlet", wajib: false, cara: "Kosong berarti karyawan Manajemen (kantor pusat/gudang), bukan berarti belum diisi." },
      { nama: "Jenis", wajib: true, cara: "PKWT untuk kontrak berjangka, PKWTT untuk tetap." },
      { nama: "Tanggal Mulai / Berakhir", wajib: true, cara: "PKWTT boleh tanpa tanggal berakhir; PKWT wajib punya." },
      { nama: "Kontrak Ke-", wajib: false, cara: "Urutan perpanjangan. Penting untuk memantau batas perpanjangan PKWT." },
      { nama: "Berkas Kontrak, Scan KTP, Foto", wajib: false, cara: "Diunggah langsung, maksimal 10 MB per berkas." },
      { nama: "Alasan Keluar & Kategori Turnover", wajib: true, cara: "Wajib begitu status diubah jadi keluar — tanpa ini angka turnover tidak bisa dibaca." },
    ],
    sambungan: [
      { arah: "masuk", ke: "rekrutmen", isi: "Kandidat yang diterima menjadi baris karyawan baru di sini." },
      { arah: "masuk", ke: "hc_antrian", isi: "Kontrak yang sudah terbit dicatat masa berlakunya di sini." },
      { arah: "masuk", ke: "relasi", isi: "Karyawan yang selesai offboarding ditutup barisnya di sini." },
      { arah: "keluar", ke: "karyawan", isi: "Seluruh karyawan outlet di basis data induk." },
      { arah: "keluar", ke: "kompensasi", isi: "Daftar karyawan yang dipantau kehadiran, payroll, dan BPJS-nya." },
      { arah: "keluar", ke: "hc_pengajuan", isi: "Kontrak yang akan habis jadi dasar pengajuan perpanjangan." },
      KE_KPI("Kepatuhan Kontrak Kerja, Kepatuhan Update Bulanan, dan Turnover."),
      KE_MONITORING("Jumlah karyawan, kontrak akan berakhir, dan turnover."),
    ],
    salah: [
      "Menempel tautan Google Drive di kolom berkas. Tautannya mati begitu pemiliknya berganti; unggah berkasnya.",
      "Mengosongkan outlet untuk karyawan cabang yang belum tahu ditempatkan di mana. Kosong berarti Manajemen, dan orangnya akan hilang dari rekap cabang.",
      "Menghapus baris karyawan yang keluar. Ubah statusnya — menghapus membuat turnover terbaca nol.",
    ],
  },
  {
    id: "rekrutmen",
    judul: "Rekrutmen & Seleksi",
    href: "/hc-mos/rekrutmen",
    jenis: "isi",
    pilar: "recruitment-selection",
    untuk: "Melacak kandidat dari melamar sampai hari pertama masuk, beserta jadwal wawancara dan ceklis onboarding-nya.",
    siapa: "Tim Rekrutmen Human Capital. Tertutup untuk divisi lain karena berisi data pribadi orang yang belum jadi karyawan.",
    kapan: "Begitu ada permintaan karyawan disetujui, dan setiap kali satu kandidat berpindah tahap.",
    langkah: [
      "Mulai dari Permintaan Karyawan yang sudah disetujui — jangan merekrut tanpa permintaan, karena KPI pemenuhannya dihitung dari sana.",
      "Tambahkan kandidat beserta posisi dan sumbernya.",
      "Jadwalkan wawancara dan catat pewawancaranya.",
      "Pindahkan tahapnya setiap ada perkembangan; tahap yang tidak pernah dipindahkan membuat kecepatan pemenuhan terbaca lambat.",
      "Kandidat diterima: jalankan ceklis onboarding, lalu buat baris kontraknya di Kontrak Tracker.",
    ],
    isian: [
      { nama: "Nama Lengkap", wajib: true, cara: "Sesuai KTP — nama inilah yang terbawa ke kontrak bila diterima." },
      { nama: "Posisi Dilamar", wajib: true, cara: "Sama persis dengan posisi di permintaan karyawan yang disetujui." },
      { nama: "Scope", wajib: true, cara: "Manajemen untuk divisi kantor, Outlet untuk cabang." },
      { nama: "Sumber", wajib: false, cara: "Dari mana kandidat datang — dipakai menilai saluran mana yang paling menghasilkan." },
      { nama: "Email & Telepon", wajib: false, cara: "Minimal salah satu, kalau tidak kandidatnya tidak bisa dihubungi lagi." },
      { nama: "Tahap", wajib: true, cara: "Dipindahkan mengikuti kenyataan, bukan diisi belakangan sekaligus." },
      { nama: "Jadwal Wawancara & Pewawancara", wajib: false, cara: "Wajib begitu masuk tahap wawancara." },
      { nama: "Mentor & Tanggal Mulai", wajib: false, cara: "Diisi saat onboarding dimulai." },
    ],
    sambungan: [
      { arah: "masuk", ke: "hc_permintaan", isi: "Permintaan karyawan yang sudah disetujui menjadi lowongan yang dikerjakan." },
      { arah: "keluar", ke: "kontrak", isi: "Kandidat diterima dicatat sebagai karyawan berkontrak." },
      { arah: "keluar", ke: "fast-track", isi: "Karyawan baru outlet masuk batch Fast Start." },
      KE_KPI("Pemenuhan Permintaan Pegawai, Kecepatan Pemenuhan, dan Penyelesaian Onboarding."),
    ],
    salah: [
      "Merekrut lebih dulu lalu membuat permintaannya belakangan. Pemenuhan jadi terbaca lebih dari 100% dan kecepatannya tidak berarti apa-apa.",
      "Meninggalkan kandidat yang gagal di tahap lama. Pindahkan ke tahap akhirnya supaya antrean mencerminkan yang benar-benar berjalan.",
    ],
  },
  {
    id: "modul",
    judul: "Modul Pelatihan (LMS)",
    href: "/hc-mos/modul",
    jenis: "isi",
    pilar: "learning-development",
    untuk: "Kurikulum pelatihan Manajemen dan Outlet beserta pelaksanaannya — modul apa yang berjalan dan siapa pesertanya.",
    siapa: "Learning & Development Human Capital.",
    kapan: "Saat menyusun kurikulum, dan setiap kali satu kelas dijadwalkan atau selesai.",
    langkah: [
      "Susun modulnya lebih dulu: judul, durasi, dan sasaran pesertanya.",
      "Jadwalkan pelaksanaannya, lalu catat pesertanya.",
      "Modul belajar mandiri diisi materinya langsung supaya bisa dibuka karyawan kapan saja.",
      "Tandai selesai hanya bila materinya benar-benar tuntas — angka partisipasi dibaca dari sini.",
    ],
    isian: [
      { nama: "Judul Modul", wajib: true, cara: "Nama yang dikenali pesertanya, bukan kode internal." },
      { nama: "Scope", wajib: true, cara: "Manajemen atau Outlet — menentukan siapa yang melihatnya." },
      { nama: "Durasi", wajib: true, cara: "Dalam jam; dipakai menghitung total jam pelatihan." },
      { nama: "Jadwal", wajib: false, cara: "Kosong berarti belum dijadwalkan, dan modulnya terhitung belum berjalan." },
      { nama: "Peserta", wajib: false, cara: "Dipilih dari karyawan aktif, jangan diketik bebas." },
    ],
    sambungan: [
      { arah: "masuk", ke: "kompetensi", isi: "Kesenjangan kompetensi menentukan modul apa yang perlu dibuat." },
      { arah: "masuk", ke: "struktur", isi: "Bahan orientasi organisasi untuk karyawan baru." },
      { arah: "masuk", ke: "dokumen", isi: "SOP dan Culture & Value sebagai bahan kelas." },
      { arah: "keluar", ke: "fast-track", isi: "Modul wajib crew outlet dijalankan sebagai batch Fast Start." },
      { arah: "keluar", ke: "hc_pelatihan", isi: "Pelatihan yang butuh biaya diajukan lewat jalur pengajuan pelatihan." },
      KE_MONITORING("Jam pelatihan dan jumlah peserta."),
    ],
    salah: ["Menandai modul selesai supaya angkanya bagus padahal kelasnya belum jalan. Angkanya dipakai menilai L&D sendiri."],
  },
  {
    id: "fast-track",
    judul: "Fast Start & Fast Track",
    href: "/hc-mos/fast-track",
    jenis: "isi",
    pilar: "learning-development",
    scope: "outlet",
    untuk: "Pelaksanaan program wajib crew outlet per batch — Pre Test, Role Play, dan Post Test, dengan kelulusan minimal 65.",
    siapa: "Learning & Development bersama Outlet Manager.",
    kapan: "Setiap batch karyawan baru outlet, dan saat crew disiapkan naik jenjang.",
    langkah: [
      "Buat batch-nya, masukkan pesertanya.",
      "Jalankan Pre Test sebelum materi diberikan — kalau dibalik, peningkatannya tidak bisa diukur.",
      "Catat Role Play sebagai praktiknya.",
      "Jalankan Post Test setelah materi. Nilainya diakumulasikan jadi satu nilai akhir.",
      "Peserta di bawah 65 diulang materinya, bukan diluluskan dengan catatan.",
    ],
    isian: [
      { nama: "Batch", wajib: true, cara: "Satu batch berisi peserta yang mulai bersamaan." },
      { nama: "Peserta", wajib: true, cara: "Dipilih dari karyawan aktif outlet." },
      { nama: "Nilai Pre / Role Play / Post", wajib: true, cara: "Angka 0–100. Kosong berarti belum diuji, bukan nol." },
    ],
    sambungan: [
      { arah: "masuk", ke: "rekrutmen", isi: "Karyawan baru outlet masuk sebagai peserta batch." },
      { arah: "masuk", ke: "modul", isi: "Materi yang diujikan berasal dari kurikulum." },
      { arah: "keluar", ke: "assessment", isi: "Nilai Pre dan Post terhimpun jadi rekap penilaian materi." },
    ],
    salah: [
      "Mengisi Pre Test dan Post Test di hari yang sama setelah materi selesai. Peningkatannya jadi angka karangan.",
      "Mengisi 0 untuk yang belum diuji. Kosongkan — nol berarti diuji dan gagal total.",
    ],
  },
  {
    id: "assessment",
    judul: "Pre Test & Post Test",
    href: "/hc-mos/assessment",
    jenis: "baca",
    pilar: "learning-development",
    scope: "outlet",
    untuk: "Rekap seluruh materi Fast Start / Fast Track beserta nilai Pre, Role Play, dan Post tiap peserta.",
    siapa: "Learning & Development, dan Outlet Manager untuk crew-nya.",
    kapan: "Setelah satu batch selesai, dan saat menilai siapa siap naik jenjang.",
    langkah: [
      "Baca rata-rata peningkatan Pre → Post; itulah ukuran materinya berhasil atau tidak.",
      "Materi dengan peningkatan kecil berarti materinya perlu diperbaiki, bukan pesertanya.",
      "Nilai per orang dipakai di penilaian kinerja dan pertimbangan kenaikan golongan.",
    ],
    isian: [],
    sambungan: [
      { arah: "masuk", ke: "fast-track", isi: "Seluruh nilai berasal dari pelaksanaan batch." },
      { arah: "keluar", ke: "kinerja", isi: "Nilai akhir jadi salah satu bahan penilaian." },
      { arah: "keluar", ke: "talent", isi: "Kelulusan jadi syarat jenjang karier crew." },
    ],
    salah: [],
  },
  {
    id: "kinerja",
    judul: "Penilaian Kinerja",
    href: "/hc-mos/kinerja",
    jenis: "isi",
    pilar: "performance-management",
    untuk: "Penilaian kinerja karyawan per periode oleh atasan langsungnya.",
    siapa: "Atasan langsung menilai; Human Capital memantau kelengkapannya.",
    kapan: "Setiap periode penilaian, dan sebelum sesi Appraisal Review dijadwalkan.",
    langkah: [
      "Pilih periodenya. Penilaian selalu terikat periode — tanpa itu tidak bisa dibandingkan antar-waktu.",
      "Penilai terisi otomatis dari atasan langsung di struktur organisasi. Kalau salah, perbaiki strukturnya, bukan kolom ini.",
      "Isi skor tiap aspek dan catatan penilaiannya.",
      "Catatan wajib untuk skor sangat rendah atau sangat tinggi — itu yang dibaca saat sesi appraisal.",
      "Selesaikan penilaian sebelum sesi Appraisal Review; sesi tanpa penilaian tidak ada bahan bicaranya.",
    ],
    isian: [
      { nama: "Periode", wajib: true, cara: "Pilih dari daftar; jangan menilai di periode yang sudah ditutup." },
      { nama: "Nama Karyawan", wajib: true, cara: "Dipilih dari karyawan aktif." },
      { nama: "Penilai", wajib: true, cara: "Terisi dari atasan langsung. Perbaiki lewat Struktur Organisasi bila keliru." },
      { nama: "Skor per aspek", wajib: true, cara: "Sesuai skala yang tertera; kosong berarti belum dinilai." },
      { nama: "Catatan Penilaian", wajib: false, cara: "Wajib untuk skor ekstrem — inilah yang jadi bahan sesi appraisal." },
    ],
    sambungan: [
      { arah: "masuk", ke: "bagan", isi: "Atasan langsung menentukan siapa berhak menilai." },
      { arah: "masuk", ke: "kompetensi", isi: "Aspek yang dinilai mengikuti matriks kompetensi jabatannya." },
      { arah: "masuk", ke: "assessment", isi: "Nilai Pre/Post crew jadi bahan pertimbangan." },
      { arah: "keluar", ke: "appraisal", isi: "Hasil penilaian dibahas di sesi bersama atasan." },
      { arah: "keluar", ke: "intervensi", isi: "Skor rendah memicu permintaan intervensi." },
      { arah: "keluar", ke: "talent", isi: "Skor tinggi berulang jadi dasar suksesi." },
    ],
    salah: [
      "Menilai seluruh anak buah dengan skor sama supaya tidak ada yang tersinggung. Penilaian seperti itu tidak bisa dipakai untuk apa pun.",
      "Mengubah kolom penilai secara manual karena strukturnya belum diperbarui. Yang salah strukturnya.",
    ],
  },
  {
    id: "kompetensi",
    judul: "Competency Matrix",
    href: "/hc-mos/kinerja?tab=kompetensi",
    jenis: "baca",
    pilar: "learning-development",
    untuk: "Kompetensi apa yang dituntut tiap jabatan, dan sejauh mana orangnya sudah memenuhi.",
    siapa: "Human Capital dan atasan langsung.",
    kapan: "Saat menyusun kebutuhan pelatihan dan saat mempertimbangkan promosi.",
    langkah: [
      "Baca per jabatan: kompetensi yang dituntut ada di barisnya.",
      "Selisih antara yang dituntut dan yang dimiliki adalah kebutuhan pelatihannya.",
      "Bawa selisih itu ke Modul Pelatihan — di situlah ia jadi kelas.",
    ],
    isian: [],
    sambungan: [
      { arah: "masuk", ke: "hc_pelatihan", isi: "Pelatihan yang terlaksana menutup kesenjangan kompetensinya." },
      { arah: "keluar", ke: "modul", isi: "Kesenjangan kompetensi jadi dasar penyusunan modul." },
      { arah: "keluar", ke: "kinerja", isi: "Aspek yang dinilai mengikuti kompetensi jabatannya." },
      { arah: "keluar", ke: "talent", isi: "Syarat kompetensi tiap jenjang karier." },
    ],
    salah: [],
  },
  {
    id: "intervensi",
    judul: "Request Intervensi",
    href: "/hc-mos/kinerja?tab=intervensi",
    jenis: "isi",
    pilar: "performance-management",
    untuk: "Permintaan bantuan Human Capital atas satu masalah kinerja atau perilaku yang tidak bisa diselesaikan atasannya sendiri.",
    siapa: "Atasan langsung, Outlet Manager, atau Owner. Ditangani Human Capital.",
    kapan: "Setelah ditegur langsung tapi tidak berubah — bukan sebagai langkah pertama.",
    langkah: [
      "Tuliskan masalahnya secara spesifik: apa yang terjadi, kapan, sudah pernah ditangani bagaimana.",
      "Kirim; permintaannya masuk antrean Human Capital.",
      "Human Capital menindaklanjuti dan mengubah statusnya sampai selesai.",
      "Kalau berujung sanksi, dokumennya diterbitkan lewat Pengajuan Dokumen, bukan ditulis di sini.",
    ],
    isian: [
      { nama: "Karyawan", wajib: true, cara: "Dipilih dari karyawan aktif." },
      { nama: "Uraian Masalah", wajib: true, cara: "Kejadian dan tanggalnya. Penilaian sifat tanpa kejadian tidak bisa ditindaklanjuti." },
      { nama: "Yang sudah dilakukan", wajib: false, cara: "Supaya Human Capital tidak mengulang langkah yang sudah gagal." },
      { nama: "Status", wajib: true, cara: "Diubah Human Capital sampai selesai, jangan dibiarkan menggantung." },
    ],
    sambungan: [
      { arah: "masuk", ke: "kinerja", isi: "Skor rendah jadi pemicu permintaan intervensi." },
      { arah: "keluar", ke: "relasi", isi: "Yang berkembang jadi perkara masuk Case Management." },
      { arah: "keluar", ke: "hc_pengajuan", isi: "Surat Teguran dan sanksi diterbitkan lewat pengajuan dokumen." },
    ],
    salah: ["Menuliskan kesimpulan tanpa kejadian — 'malas', 'tidak cocok'. Tidak bisa jadi dasar tindakan apa pun."],
  },
  {
    id: "appraisal",
    judul: "Appraisal Review",
    href: "/hc-mos/appraisal",
    jenis: "isi",
    pilar: "performance-management",
    untuk: "Sesi peninjauan hasil appraisal bersama atasan langsung, sebelum penilaiannya difinalisasi.",
    siapa: "Atasan langsung bersama karyawannya; Human Capital menjadwalkan dan memantau.",
    kapan: "Setelah penilaian kinerja periode itu terisi, sebelum tenggat sesi.",
    langkah: [
      "Jadwalkan sesinya; tenggatnya terlihat di daftar.",
      "Bahas hasil penilaian bersama karyawannya.",
      "Tuliskan hasil peninjauan bersama — kesepakatan, bukan pengulangan skornya.",
      "Sesi lewat tenggat tetap tampil merah sampai diisi; jangan dihapus.",
    ],
    isian: [
      { nama: "Tanggal Appraisal Review", wajib: true, cara: "Tanggal sesi benar-benar dilaksanakan." },
      { nama: "Hasil Peninjauan Bersama Atasan", wajib: true, cara: "Kesepakatan yang dicapai dan tindak lanjutnya." },
    ],
    sambungan: [
      { arah: "masuk", ke: "kinerja", isi: "Skor dan catatan yang jadi bahan sesi." },
      { arah: "keluar", ke: "talent", isi: "Kesepakatan jenjang karier lanjutan." },
      { arah: "keluar", ke: "kompensasi", isi: "Hasil appraisal jadi dasar peninjauan golongan." },
    ],
    salah: ["Mengisi hasil peninjauan tanpa sesinya benar-benar terjadi. Karyawannya akan tahu, dan kepercayaan pada seluruh prosesnya hilang."],
  },
  {
    id: "talent",
    judul: "Career Path & Succession",
    href: "/hc-mos/talent",
    jenis: "baca",
    pilar: "talent-career",
    untuk: "Jenjang karier tiap jalur jabatan dan calon pengganti untuk posisi kunci.",
    siapa: "Human Capital dan Kepala Divisi.",
    kapan: "Saat merencanakan promosi dan saat memetakan risiko posisi kosong.",
    langkah: [
      "Baca jenjangnya: dari jabatan sekarang, ke mana orang bisa naik dan apa syaratnya.",
      "Di tab Succession Plan, lihat posisi kunci beserta calon penggantinya.",
      "Posisi kunci tanpa calon adalah risiko yang harus ditutup lewat pelatihan atau rekrutmen.",
    ],
    isian: [],
    sambungan: [
      { arah: "masuk", ke: "kinerja", isi: "Skor kinerja berulang jadi dasar pencalonan." },
      { arah: "masuk", ke: "kompetensi", isi: "Syarat kompetensi tiap jenjang." },
      { arah: "masuk", ke: "assessment", isi: "Kelulusan Fast Track sebagai syarat naik jenjang crew." },
      { arah: "masuk", ke: "appraisal", isi: "Kesepakatan jenjang karier dari sesi appraisal." },
      { arah: "keluar", ke: "hc_pengajuan", isi: "Promosi diterbitkan sebagai Surat Promosi." },
    ],
    salah: [],
  },
  {
    id: "kompensasi",
    judul: "Compensation & Benefit",
    href: "/hc-mos/kompensasi",
    jenis: "isi",
    pilar: "compensation-benefit",
    untuk: "Kehadiran, cuti, payroll, BPJS, dan struktur golongan kompensasi.",
    siapa: "Human Capital saja — halaman ini berisi gaji per karyawan.",
    kapan: "Kehadiran dan cuti harian; payroll dan BPJS mengikuti jadwal bulanan.",
    langkah: [
      "Tab Kehadiran: pantau kehadiran hari ini dan cuti/izin yang sedang berjalan.",
      "Tab Payroll: ikuti jadwal rutinnya; yang belum lengkap terlihat sebelum tanggal bayar.",
      "Tab BPJS: kejar yang belum terdaftar sama sekali lebih dulu, baru yang baru punya salah satu.",
      "Tab Golongan: struktur kompensasinya; perubahan di sini berdampak ke seluruh karyawan segolongan.",
    ],
    isian: [
      { nama: "Cuti/Izin", wajib: true, cara: "Tanggal mulai dan selesai; tanpa tanggal selesai orangnya terhitung cuti selamanya." },
      { nama: "Status BPJS TK & KES", wajib: true, cara: "Keduanya dicatat terpisah — satu terdaftar bukan berarti lengkap." },
      { nama: "Golongan", wajib: true, cara: "Dipilih dari struktur kompensasi, jangan mengetik angka gaji langsung." },
    ],
    sambungan: [
      { arah: "masuk", ke: "kontrak", isi: "Daftar karyawan yang dipantau berasal dari kontrak yang berlaku." },
      { arah: "masuk", ke: "appraisal", isi: "Hasil appraisal jadi dasar peninjauan golongan." },
      KE_MONITORING("Kehadiran, cuti berjalan, dan kelengkapan BPJS."),
    ],
    salah: [
      "Mencatat BPJS 'sudah diurus' padahal baru salah satu. Kolomnya dua karena memang dua program yang berbeda.",
    ],
  },
  {
    id: "relasi",
    judul: "Case Management & Offboarding",
    href: "/hc-mos/relasi",
    jenis: "isi",
    pilar: "employee-relations",
    untuk: "Penanganan perkara kepegawaian dan proses keluar karyawan sampai tuntas.",
    siapa: "Human Capital saja — isinya menyebut nama karyawan dalam perkara.",
    kapan: "Begitu perkara masuk, dan begitu ada karyawan mengajukan atau diminta keluar.",
    langkah: [
      "Catat perkaranya beserta kronologi dan tanggalnya.",
      "Ikuti tahapannya sampai ditutup; perkara terbuka tanpa perkembangan lebih berbahaya daripada yang ditutup dengan hasil tidak ideal.",
      "Tab Offboarding: jalankan ceklis keluar — serah terima, pengembalian aset, penyelesaian hak.",
      "Setelah tuntas, ubah status karyawannya di Kontrak Tracker beserta alasan dan kategori turnover.",
    ],
    isian: [
      { nama: "Karyawan", wajib: true, cara: "Dipilih dari karyawan aktif." },
      { nama: "Kronologi", wajib: true, cara: "Urutan kejadian beserta tanggalnya — inilah yang berlaku bila perkaranya berlanjut." },
      { nama: "Tahap / Status", wajib: true, cara: "Diperbarui setiap ada perkembangan." },
      { nama: "Ceklis Offboarding", wajib: true, cara: "Semua butir dituntaskan sebelum karyawannya dinyatakan keluar." },
    ],
    sambungan: [
      { arah: "masuk", ke: "intervensi", isi: "Intervensi yang berkembang jadi perkara masuk ke sini." },
      { arah: "keluar", ke: "kontrak", isi: "Karyawan yang keluar ditutup barisnya beserta alasannya." },
      { arah: "keluar", ke: "hc_pengajuan", isi: "Surat peringatan dan surat keluar diterbitkan lewat pengajuan dokumen." },
      KE_MONITORING("Jumlah perkara terbuka dan proses keluar berjalan."),
    ],
    salah: [
      "Menyelesaikan offboarding tapi lupa menutup barisnya di Kontrak Tracker. Orangnya terhitung masih bekerja di semua angka.",
    ],
  },
  {
    id: "dokumen",
    judul: "Pusat Dokumen",
    href: "/hc-mos/dokumen?jenis=culture",
    jenis: "isi",
    pilar: "legal-compliance",
    untuk: "Satu tempat untuk Culture & Value, SOP tiap pilar, kebijakan, dan dokumen kepatuhan — beserta versi dan masa berlakunya.",
    siapa: "Human Capital menerbitkan; seluruh karyawan membaca sesuai haknya.",
    kapan: "Saat dokumen baru terbit dan saat dokumen lama direvisi — versi lama tidak dihapus, diganti statusnya.",
    langkah: [
      "Pilih jenisnya lebih dulu; jenis menentukan siapa yang bisa membacanya.",
      "Untuk SOP, isi pilarnya supaya muncul di halaman pilar yang benar.",
      "Isi versi dan masa berlaku. Dokumen tanpa masa berlaku tidak pernah kedaluwarsa dan akan dipakai orang selamanya.",
      "Revisi diterbitkan sebagai versi baru; versi lama diubah statusnya, bukan dihapus.",
    ],
    isian: [
      { nama: "Judul", wajib: true, cara: "Nama resmi dokumennya." },
      { nama: "Jenis", wajib: true, cara: "Culture, SOP, Kebijakan, atau Compliance — menentukan tempat dan haknya." },
      { nama: "Pilar", wajib: false, cara: "Wajib untuk SOP; itulah yang menautkannya ke halaman pilar." },
      { nama: "Versi", wajib: true, cara: "Naikkan setiap revisi. Dua dokumen berversi sama tidak bisa dibedakan." },
      { nama: "Berlaku Mulai / Sampai", wajib: true, cara: "Sampai boleh kosong hanya untuk dokumen yang memang berlaku terus." },
      { nama: "Isi Dokumen / Tautan Berkas", wajib: true, cara: "Isi langsung atau unggah berkasnya." },
    ],
    sambungan: [
      { arah: "masuk", ke: "pilar", isi: "SOP ditempatkan pada pilar yang memilikinya." },
      { arah: "keluar", ke: "modul", isi: "SOP dan Culture jadi bahan pelatihan dan orientasi." },
    ],
    salah: [
      "Menghapus versi lama saat menerbitkan revisi. Yang lama tetap diperlukan untuk menilai kejadian yang terjadi saat ia masih berlaku.",
    ],
  },
  {
    id: "monitoring",
    judul: "Dashboard Monitoring",
    href: "/hc-mos/monitoring",
    jenis: "baca",
    pilar: "hr-analytics",
    untuk: "Sebelas metrik HR yang seluruhnya dihitung dari data yang sudah masuk — tidak ada angka yang diketik di sini.",
    siapa: "Head of Human Capital dan Owner.",
    kapan: "Rutin mingguan, dan sebelum rapat manajemen.",
    langkah: [
      "Baca angkanya, lalu telusuri ke modul sumbernya bila ada yang janggal.",
      "Angka yang salah selalu berarti sumbernya belum diisi — perbaikannya di modul itu, bukan di sini.",
      "Metrik kosong berarti belum ada datanya sama sekali, bukan berarti nilainya nol.",
    ],
    isian: [],
    sambungan: [
      { arah: "masuk", ke: "kontrak", isi: "Jumlah karyawan, kontrak akan berakhir, dan turnover." },
      { arah: "masuk", ke: "karyawan", isi: "Jumlah karyawan sebagai penyebut." },
      { arah: "masuk", ke: "kompensasi", isi: "Kehadiran, cuti berjalan, dan kelengkapan BPJS." },
      { arah: "masuk", ke: "modul", isi: "Jam pelatihan dan jumlah peserta." },
      { arah: "masuk", ke: "relasi", isi: "Perkara terbuka dan proses keluar berjalan." },
      { arah: "keluar", ke: "hcmos", isi: "Angka ringkas di kartu pilar." },
    ],
    salah: ["Memperbaiki angka dengan mengubah tampilannya. Tidak ada kolom yang bisa diubah di sini — dan memang disengaja."],
  },
  {
    id: "kpi",
    judul: "Report & KPI Human Capital",
    href: "/hc-mos/kpi",
    jenis: "baca",
    pilar: "hr-analytics",
    untuk: "Enam indikator kinerja Human Capital beserta bobot dan targetnya, dihitung otomatis per periode.",
    siapa: "Head of Human Capital dan Owner.",
    kapan: "Setiap akhir periode, dan saat menyusun rencana perbaikan.",
    langkah: [
      "Baca capaian tiap indikator terhadap targetnya; bobotnya berbeda-beda.",
      "Setiap indikator menyebutkan sumbernya — telusuri ke sana kalau angkanya di luar dugaan.",
      "Tindak lanjut yang disarankan tiap indikator adalah titik perbaikan yang paling cepat berdampak.",
    ],
    isian: [],
    sambungan: [
      { arah: "masuk", ke: "hc_permintaan", isi: "Pemenuhan Permintaan Pegawai dan Kecepatan Pemenuhan." },
      { arah: "masuk", ke: "kontrak", isi: "Kepatuhan Kontrak Kerja, Kepatuhan Update Bulanan, dan Turnover." },
      { arah: "masuk", ke: "rekrutmen", isi: "Penyelesaian Onboarding." },
    ],
    salah: ["Menganggap indikator 'Belum Terukur' sama dengan nilai buruk. Artinya datanya belum ada, dan itu masalah yang berbeda."],
  },
  {
    id: "hc_pengajuan",
    judul: "Pengajuan Dokumen Karyawan",
    href: "/hc/pengajuan",
    jenis: "isi",
    pilar: "organization-development",
    scope: "outlet",
    untuk: "Mengajukan dokumen karyawan — BPJS, PKWT, Surat Teguran, Surat Promosi — ke tim Human Capital, lalu mengunduh hasilnya.",
    siapa: "Supervisor cabang dan Coordinator Area.",
    kapan: "Begitu kebutuhannya muncul; jangan menumpuk sampai akhir bulan.",
    langkah: [
      "Pilih jenis dokumennya. Isian yang muncul menyesuaikan jenisnya — kontrak menanyakan durasi, promosi menanyakan jabatan sebelumnya.",
      "Isi data karyawannya dan unggah KTP bila diminta.",
      "Kirim. Statusnya bisa diikuti dari halaman yang sama.",
      "Setelah berstatus Selesai, unduh dokumen jadinya dari sini.",
      "Kalau pengajuannya batal, minta Human Capital membatalkannya — jangan dibiarkan menggantung di antrean.",
    ],
    isian: [
      { nama: "Jenis Dokumen", wajib: true, cara: "Menentukan isian berikutnya, jadi pilih yang benar sejak awal." },
      { nama: "Nama Karyawan", wajib: true, cara: "Sesuai KTP dan sesuai yang tercatat di Kontrak Tracker." },
      { nama: "Scan KTP", wajib: false, cara: "Wajib untuk dokumen yang menyertakan identitas. Foto dari HP sudah cukup." },
      { nama: "Durasi Kontrak", wajib: false, cara: "Hanya untuk jenis kontrak." },
      { nama: "Jabatan Sebelumnya", wajib: false, cara: "Hanya untuk Surat Promosi — suratnya menyebut jabatan lama dan baru." },
      { nama: "Kronologi", wajib: false, cara: "Wajib untuk surat teguran; tanpa kejadian dan tanggalnya suratnya tidak bisa diterbitkan." },
    ],
    sambungan: [
      { arah: "masuk", ke: "kontrak", isi: "Kontrak yang akan habis jadi dasar pengajuan perpanjangan." },
      { arah: "masuk", ke: "intervensi", isi: "Hasil intervensi yang berujung sanksi diterbitkan dari sini." },
      { arah: "masuk", ke: "talent", isi: "Promosi yang disepakati diterbitkan sebagai Surat Promosi." },
      { arah: "masuk", ke: "relasi", isi: "Surat peringatan dan surat keluar dari perkara kepegawaian." },
      { arah: "keluar", ke: "hc_antrian", isi: "Seluruh pengajuan masuk antrean Human Capital." },
    ],
    salah: [
      "Mengirim ulang pengajuan yang sama karena mengira yang pertama gagal. Periksa daftarnya dulu — dobel berarti dua dokumen terbit.",
      "Membiarkan pengajuan yang sudah tidak diperlukan tetap di antrean. Mintalah dibatalkan supaya antreannya jujur.",
    ],
  },
  {
    id: "hc_antrian",
    judul: "Antrian Dokumen",
    href: "/hc/antrian",
    jenis: "isi",
    pilar: "organization-development",
    untuk: "Meninjau dan mengerjakan pengajuan dokumen dari seluruh cabang, lalu mengirim dokumen jadinya kembali ke pemohon.",
    siapa: "Tim Human Capital.",
    kapan: "Setiap hari kerja; antrean yang menumpuk terbaca sebagai keterlambatan di KPI.",
    langkah: [
      "Saring berdasarkan status untuk melihat yang belum dikerjakan.",
      "Buka pengajuannya, periksa kelengkapan datanya. Yang kurang ditanyakan lewat kolom tanya, bukan lewat pesan di luar sistem.",
      "Kerjakan dokumennya, unggah hasilnya, lalu tandai Selesai — pemohonnya langsung bisa mengunduh.",
      "Pengajuan yang batal ditutup dengan tombol batalkan beserta alasannya; jangan dihapus dan jangan ditandai selesai.",
    ],
    isian: [
      { nama: "Status", wajib: true, cara: "Dipindahkan mengikuti kenyataan: Menunggu → Diproses → Selesai." },
      { nama: "Berkas Hasil", wajib: true, cara: "Diunggah sebelum ditandai Selesai — Selesai tanpa berkas membuat pemohon menunggu sia-sia." },
      { nama: "Alasan Pembatalan", wajib: false, cara: "Wajib saat membatalkan. Pemohonnya diberi tahu beserta alasannya." },
    ],
    sambungan: [
      { arah: "masuk", ke: "hc_pengajuan", isi: "Seluruh pengajuan dari supervisor dan Coordinator Area." },
      { arah: "keluar", ke: "kontrak", isi: "Kontrak yang sudah terbit dicatat masa berlakunya." },
    ],
    salah: [
      "Menandai Selesai supaya antrean bersih padahal dokumennya belum diunggah. Pemohon melihat Selesai dan berhenti menunggu.",
    ],
  },
  {
    id: "hc_permintaan",
    judul: "Permintaan Karyawan",
    href: "/hc/permintaan",
    jenis: "isi",
    pilar: "recruitment-selection",
    untuk: "Meninjau permintaan tenaga kerja — dipisah Manajemen (divisi kantor) dan Outlet (cabang, diajukan supervisor).",
    siapa: "Human Capital meninjau; divisi dan supervisor mengajukan lewat menu Pengajuan.",
    kapan: "Begitu permintaan masuk. Ini titik awal seluruh rantai rekrutmen.",
    langkah: [
      "Baca permintaannya: posisi, jumlah, alasan, dan kapan dibutuhkan.",
      "Setujui atau tolak beserta alasannya — permintaan yang didiamkan tetap terhitung belum terpenuhi.",
      "Yang disetujui dikerjakan di Rekrutmen; itulah yang menghitung pemenuhan dan kecepatannya.",
    ],
    isian: [
      { nama: "Keputusan", wajib: true, cara: "Setujui atau tolak. Menunda tanpa keputusan merusak dua indikator KPI sekaligus." },
      { nama: "Alasan", wajib: false, cara: "Wajib saat menolak, supaya pengaju tahu apa yang perlu diperbaiki." },
    ],
    sambungan: [
      { arah: "keluar", ke: "rekrutmen", isi: "Permintaan yang disetujui jadi lowongan yang dikerjakan." },
      { arah: "keluar", ke: "kpi", isi: "Pemenuhan Permintaan Pegawai dan Kecepatan Pemenuhan." },
    ],
    salah: ["Menyetujui secara lisan lalu langsung merekrut. Tanpa keputusan tercatat, pemenuhannya tidak pernah terhitung."],
  },
  {
    id: "hc_pelatihan",
    judul: "Pelatihan",
    href: "/hc/pelatihan",
    jenis: "isi",
    pilar: "learning-development",
    untuk: "Meninjau pengajuan pelatihan dari departemen. Disetujui di sini, lalu Finance menyetujui dananya.",
    siapa: "Human Capital meninjau; seluruh departemen mengajukan.",
    kapan: "Begitu pengajuan masuk — pelatihan biasanya punya tanggal pelaksanaan yang tidak bisa mundur.",
    langkah: [
      "Periksa relevansi pelatihannya terhadap kebutuhan kompetensi pesertanya.",
      "Setujui atau tolak beserta alasannya.",
      "Yang disetujui berlanjut ke persetujuan dana oleh Finance — persetujuan di sini belum berarti dananya turun.",
      "Setelah terlaksana, catat modul dan pesertanya di Modul Pelatihan supaya terhitung jam pelatihan.",
    ],
    isian: [
      { nama: "Keputusan", wajib: true, cara: "Setujui atau tolak; jangan didiamkan sampai tanggal pelaksanaannya lewat." },
      { nama: "Catatan", wajib: false, cara: "Wajib saat menolak." },
    ],
    sambungan: [
      { arah: "masuk", ke: "modul", isi: "Pelatihan berbiaya yang butuh persetujuan diajukan lewat jalur ini." },
      { arah: "keluar", ke: "kompetensi", isi: "Pelatihan yang terlaksana menutup kesenjangan kompetensi." },
    ],
    salah: ["Menyetujui di sini lalu menganggap dananya otomatis cair. Persetujuan Finance adalah langkah terpisah."],
  },
];

const PETA = new Map(PANDUAN.map((p) => [p.id, p]));

export function panduanUntuk(id: string): Panduan | undefined {
  return PETA.get(id);
}

export const PANDUAN_IDS: string[] = PANDUAN.map((p) => p.id);

export const sambunganMasuk = (p: Panduan): Sambungan[] => p.sambungan.filter((s) => s.arah === "masuk");
export const sambunganKeluar = (p: Panduan): Sambungan[] => p.sambungan.filter((s) => s.arah === "keluar");

/** Judul dan rute lawan bicara satu sambungan — untuk menggambar petanya. */
export function tujuanSambungan(s: Sambungan): { judul: string; href: string } | undefined {
  const p = PETA.get(s.ke);
  return p ? { judul: p.judul, href: p.href } : undefined;
}

/**
 * Peta yang tidak nyambung dua arah lebih menyesatkan daripada tidak ada peta.
 *
 * Dipakai tes. Dikembalikan sebagai daftar keluhan, bukan dilemparkan sebagai
 * galat, supaya tesnya bisa menyebut SEMUA yang salah sekaligus alih-alih
 * berhenti di yang pertama.
 */
export function periksaPanduan(): string[] {
  const keluhan: string[] = [];

  for (const p of PANDUAN) {
    if (!p.untuk.trim()) keluhan.push(`${p.id}: belum punya penjelasan "untuk apa"`);
    if (p.langkah.length === 0) keluhan.push(`${p.id}: belum punya langkah`);
    if (p.jenis === "isi" && p.isian.length === 0) keluhan.push(`${p.id}: halaman isian tanpa satu pun keterangan kolom`);
    if (p.sambungan.length === 0) keluhan.push(`${p.id}: berdiri sendiri tanpa sambungan ke mana pun`);

    for (const s of p.sambungan) {
      const lawan = PETA.get(s.ke);
      if (!lawan) {
        keluhan.push(`${p.id}: menyambung ke "${s.ke}" yang tidak ada`);
        continue;
      }
      if (s.ke === p.id) {
        keluhan.push(`${p.id}: menyambung ke dirinya sendiri`);
        continue;
      }
      const balik: ArahSambungan = s.arah === "masuk" ? "keluar" : "masuk";
      if (!lawan.sambungan.some((x) => x.ke === p.id && x.arah === balik)) {
        keluhan.push(`${p.id} → ${s.ke} (${s.arah}) tidak dibalas ${s.ke} → ${p.id} (${balik})`);
      }
    }
  }

  const unik = new Set(PANDUAN_IDS);
  if (unik.size !== PANDUAN.length) keluhan.push("ada id panduan yang kembar");

  return keluhan;
}
