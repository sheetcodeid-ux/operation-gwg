/**
 * Daftar tabel HC-MOS yang boleh ditulis lewat tindakan umum, beserta kolomnya.
 *
 * Modul-modul pilar ini bentuknya sama: daftar baris, satu formulir, simpan,
 * hapus. Menulis lapisan data dan tindakan server tersendiri untuk masing-masing
 * berarti sepuluh salinan kode yang sama — dan sepuluh tempat yang harus diingat
 * saat aturan wewenangnya berubah.
 *
 * Yang membuat pola ini aman adalah daftar putih di bawah: nama tabel dan nama
 * kolom TIDAK PERNAH datang dari peramban apa adanya. Keduanya dicocokkan
 * dengan daftar ini lebih dulu, jadi tidak ada permintaan yang bisa menyentuh
 * tabel lain atau kolom yang tidak dimaksudkan.
 */

export const TABEL_HCMOS = {
  hc_training_records: [
    "nama", "outlet_id", "program", "batch", "materi",
    "pre_test", "role_play", "post_test", "tanggal", "catatan",
  ],
  hc_competency: ["nama", "jabatan", "scope", "kompetensi", "level_standar", "level_aktual", "catatan"],
  hc_reviews: [
    "nama", "jabatan", "scope", "outlet_id", "periode", "penilai",
    "nilai", "catatan", "status", "tgl_review", "hasil_review",
  ],
  hc_career_paths: ["jabatan", "level", "scope", "jabatan_berikutnya", "syarat", "masa_minimum_bulan"],
  hc_succession: ["posisi", "pemegang", "kandidat", "kesiapan", "catatan"],
  hc_leaves: ["nama", "scope", "outlet_id", "jenis", "tgl_mulai", "tgl_selesai", "alasan", "status", "disetujui_oleh"],
  hc_payroll: ["periode", "nama", "scope", "outlet_id", "gaji_pokok", "tunjangan", "lembur", "potongan", "catatan"],
  hc_benefits: ["nama", "scope", "outlet_id", "bpjs_kesehatan", "bpjs_tk", "status", "tgl_daftar", "catatan"],
  hc_salary_grades: ["golongan", "jabatan", "scope", "gaji_min", "gaji_max", "tunjangan"],
  hc_cases: [
    "jenis", "nama", "jabatan", "scope", "outlet_id", "kategori", "tanggal", "ringkasan", "tindakan", "status",
    // Ditambahkan untuk Case Management & Offboarding — lihat migrasi 0055.
    "tgl_selesai", "eskalasi", "exit_interview", "serah_aset", "payroll_final",
  ],
  // Request Intervensi — pengganti Appraisal Review (Meeting Fitur HRD).
  // `peran_pemohon` disimpan terpisah dari `pemohon` karena yang menentukan
  // bobot sebuah permintaan adalah dari lapis mana ia datang, dan orang bisa
  // berpindah jabatan sementara catatannya tidak ikut berubah.
  hc_appraisal_sessions: ["tanggal", "peserta", "reviewer", "scope", "status", "catatan"],
  hc_interventions: [
    "nama", "jabatan", "divisi", "scope", "outlet_id",
    "pemohon", "peran_pemohon", "tanggal", "gejala", "urgensi",
    "tindakan", "status", "catatan",
  ],
} as const;

export type TabelHcmos = keyof typeof TABEL_HCMOS;

/** Kolom pengurut bawaan tiap tabel — daftar tanpa urutan tetap terasa acak. */
export const URUTAN_HCMOS: Record<TabelHcmos, { kolom: string; naik: boolean }> = {
  hc_training_records: { kolom: "tanggal", naik: false },
  hc_competency: { kolom: "nama", naik: true },
  hc_reviews: { kolom: "periode", naik: false },
  hc_career_paths: { kolom: "level", naik: true },
  hc_succession: { kolom: "posisi", naik: true },
  hc_leaves: { kolom: "tgl_mulai", naik: false },
  hc_payroll: { kolom: "periode", naik: false },
  hc_benefits: { kolom: "nama", naik: true },
  hc_salary_grades: { kolom: "golongan", naik: true },
  hc_cases: { kolom: "tanggal", naik: false },
  hc_appraisal_sessions: { kolom: "tanggal", naik: false },
  hc_interventions: { kolom: "tanggal", naik: false },
};

/** Apakah nama tabel yang diterima memang salah satu yang boleh disentuh. */
export function tabelValid(nama: string): nama is TabelHcmos {
  return Object.prototype.hasOwnProperty.call(TABEL_HCMOS, nama);
}

/** Menyaring isian menjadi kolom yang memang dikenal tabelnya. */
export function saringKolom(tabel: TabelHcmos, isi: Record<string, unknown>): Record<string, unknown> {
  const boleh = new Set<string>(TABEL_HCMOS[tabel]);
  const hasil: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(isi)) if (boleh.has(k)) hasil[k] = v;
  return hasil;
}
