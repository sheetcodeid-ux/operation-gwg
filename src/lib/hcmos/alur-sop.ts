/**
 * Alur kerja tiap pilar — isi SOP-nya, bukan status pengerjaannya.
 *
 * Perbedaan itu yang menentukan bentuknya di layar. Rujukan HC-MOS menggambar
 * alur ini lengkap dengan penanda "Selesai / Berjalan / Belum Mulai", seolah
 * ada satu proses tunggal yang sedang berjalan sekarang. Di sistem yang benar-
 * benar dipakai, anggapan itu tidak berlaku: pada saat yang sama ada belasan
 * perubahan struktur, puluhan rekrutmen, dan ratusan pengajuan dokumen, masing-
 * masing di langkah yang berbeda.
 *
 * Jadi yang ditampilkan di sini adalah PROSEDURNYA — urutan langkah dan siapa
 * mengerjakan apa. Status yang sebenarnya hidup di modulnya masing-masing:
 * antrean dokumen punya statusnya sendiri, rekrutmen punya tahap kandidatnya
 * sendiri. Menempelkan status palsu di sini hanya membuat orang percaya sistem
 * sedang memantau sesuatu yang sebenarnya tidak dipantau.
 */

export interface LangkahSop {
  judul: string;
  /** Siapa mengerjakan apa pada langkah ini. */
  isi: string;
}

export interface AlurSop {
  /** Slug pilar — cocok dengan `HC_PILLARS[].slug`. */
  pilar: string;
  ringkas: string;
  langkah: LangkahSop[];
}

export const ALUR_SOP: AlurSop[] = [
  {
    pilar: "organization-development",
    ringkas: "Dari permintaan perubahan struktur hingga publikasi",
    langkah: [
      { judul: "Pengajuan Perubahan", isi: "Kepala Divisi / Outlet Manager mengajukan perubahan struktur" },
      { judul: "Review Riva", isi: "Organization & People Development meninjau kelayakan" },
      { judul: "Approval Adrian", isi: "Head of HC memvalidasi & menyetujui perubahan" },
      { judul: "Update Database", isi: "Uswatun memperbarui data struktur & kepegawaian" },
      { judul: "Publikasi & Informasi", isi: "Struktur baru diinformasikan ke seluruh karyawan" },
    ],
  },
  {
    pilar: "recruitment-selection",
    ringkas: "Dari kebutuhan tenaga kerja sampai hari pertama masuk",
    langkah: [
      { judul: "Manpower Request", isi: "Divisi atau outlet mengajukan kebutuhan tenaga kerja" },
      { judul: "Sourcing & Screening", isi: "Dini menjaring & menyaring kandidat" },
      { judul: "Interview & Seleksi", isi: "Wawancara bersama hiring manager terkait" },
      { judul: "Offering & Kontrak", isi: "Penawaran & penandatanganan kontrak" },
      { judul: "Onboarding", isi: "Integrasi karyawan baru ke timnya" },
    ],
  },
  {
    pilar: "learning-development",
    ringkas: "Dari kebutuhan belajar sampai sertifikasi",
    langkah: [
      { judul: "Identifikasi Kebutuhan", isi: "Berdasarkan Competency Matrix & hasil penilaian" },
      { judul: "Penyusunan Modul", isi: "Riva menyiapkan modul kelas atau belajar mandiri" },
      { judul: "Approval Adrian", isi: "Validasi materi & jadwal pelatihan" },
      { judul: "Pelaksanaan & Publikasi", isi: "Modul dipublikasikan atau kelas dijalankan" },
      { judul: "Evaluasi & Sertifikasi", isi: "Penilaian hasil belajar & penerbitan sertifikat" },
    ],
  },
  {
    pilar: "performance-management",
    ringkas: "Dari penetapan periode sampai tindak lanjut",
    langkah: [
      { judul: "Penetapan Periode Penilaian", isi: "Ditetapkan Riva & disetujui Adrian" },
      { judul: "Pengisian Penilaian", isi: "Atasan langsung menilai anggota timnya" },
      { judul: "Request Intervensi", isi: "Diajukan satu lapis di atas bila ada kinerja yang turun" },
      { judul: "Finalisasi & Tindak Lanjut", isi: "Kenaikan golongan atau rencana pengembangan" },
    ],
  },
  {
    pilar: "talent-career",
    ringkas: "Dari pemetaan talent sampai rencana pengembangan",
    langkah: [
      { judul: "Pemetaan Talent", isi: "Berdasarkan hasil penilaian kinerja & kompetensi" },
      { judul: "Diskusi dengan Kepala Divisi", isi: "Validasi kesiapan kandidat suksesi" },
      { judul: "Penetapan Rencana Pengembangan", isi: "Disetujui Adrian" },
    ],
  },
  {
    pilar: "compensation-benefit",
    ringkas: "Dari rekap kehadiran sampai slip gaji",
    langkah: [
      { judul: "Rekap Kehadiran & Lembur", isi: "Input data dari Attendance & Cuti" },
      { judul: "Perhitungan Payroll", isi: "Uswatun memproses bersama Finance" },
      { judul: "Approval Adrian", isi: "Validasi sebelum pencairan" },
      { judul: "Pencairan & Slip Gaji", isi: "Dikirim ke seluruh karyawan" },
    ],
  },
  {
    pilar: "employee-relations",
    ringkas: "Dari laporan kasus sampai dokumentasi",
    langkah: [
      { judul: "Laporan / Temuan Kasus", isi: "Dilaporkan atasan langsung atau Outlet Manager" },
      { judul: "Investigasi & Klarifikasi", isi: "Adrian bersama pihak terkait" },
      { judul: "Keputusan & Tindak Lanjut", isi: "Sanksi, mediasi, atau penyelesaian lain" },
      { judul: "Dokumentasi", isi: "Dicatat pada Case Management" },
    ],
  },
  {
    pilar: "legal-compliance",
    ringkas: "Dari kebutuhan kebijakan sampai sosialisasi",
    langkah: [
      { judul: "Identifikasi Kebutuhan", isi: "Berdasarkan regulasi atau kebutuhan internal" },
      { judul: "Penyusunan Draf", isi: "Adrian bersama Riva & Uswatun" },
      { judul: "Review & Approval", isi: "Ditinjau sebelum berlaku efektif" },
      { judul: "Sosialisasi", isi: "Diinformasikan ke seluruh karyawan" },
    ],
  },
  {
    pilar: "hr-analytics",
    ringkas: "Dari pengumpulan data sampai perbaikan proses",
    langkah: [
      { judul: "Pengumpulan Data", isi: "Dari seluruh pilar HC — Dini, Riva, Uswatun" },
      { judul: "Analisis & Dashboard", isi: "Adrian menyusun laporan & temuannya" },
      { judul: "Review dengan Owner", isi: "Presentasi hasil & rekomendasi" },
      { judul: "Tindak Lanjut", isi: "Implementasi perbaikan proses" },
    ],
  },
];

export const alurPilar = (slug: string): AlurSop | undefined => ALUR_SOP.find((a) => a.pilar === slug);

/**
 * Tahapan onboarding — beda per scope, dan bedanya nyata.
 *
 * Hari pertama seorang staf kantor berurusan dengan akun, perangkat, dan target
 * tiga bulan; hari pertama seorang crew outlet berurusan dengan seragam, SOP
 * penyajian, dan jadwal shift. Menyamakan keduanya membuat separuh ceklisnya
 * selalu dilewati, dan ceklis yang biasa dilewati berhenti dibaca.
 */
export const TAHAP_ONBOARDING_MANAJEMEN: LangkahSop[] = [
  { judul: "Hari Pertama", isi: "Perkenalan perusahaan, brand, dan struktur organisasi" },
  { judul: "Administrasi & Kontrak", isi: "Penandatanganan kontrak & kelengkapan dokumen" },
  { judul: "Orientasi Jobdesk & KPI", isi: "Penjelasan jobdesk, target KPI, dan SOP divisi oleh atasan langsung" },
  { judul: "Self-Learning Wajib", isi: "Modul GWG, Core Values, K3, dan Kode Etik" },
  { judul: "Evaluasi 30 Hari", isi: "Penilaian kesiapan kerja mandiri oleh Kepala Divisi" },
];

export const TAHAP_ONBOARDING_OUTLET: LangkahSop[] = [
  { judul: "Hari Pertama", isi: "Perkenalan outlet, tim, dan brand yang dijalankan" },
  { judul: "Administrasi & Kontrak", isi: "Penandatanganan PKWT & kelengkapan berkas" },
  { judul: "Seragam & SOP Outlet", isi: "Seragam, atribut, SOP penyajian, dan keselamatan kerja" },
  { judul: "Fast Start", isi: "Modul dasar wajib crew baru lewat Self-Learning" },
  { judul: "Fast Track", isi: "Modul lanjutan sesuai posisi & brand" },
  { judul: "Evaluasi Masa Percobaan", isi: "Penilaian oleh Supervisor / Outlet Manager" },
];
