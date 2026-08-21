/**
 * Penutupan proses keluar karyawan — langkah kelima alur Offboarding.
 *
 * Empat langkah pertama (notifikasi, exit interview, serah aset, payroll final)
 * tercatat di `hc_cases`. Langkah kelima, "Update Database Karyawan", ada di
 * dua tempat lain: tanggal resign di Kontrak Tracker dan `active` di User
 * Management. Yang terakhir itulah satu-satunya hal yang benar-benar mencabut
 * akses — dan justru itu yang paling mudah terlupa karena letaknya di menu lain.
 *
 * Modul ini memutuskan APA yang harus terjadi; yang menjalankannya ada di
 * lapisan aksi. Dipisah supaya keputusannya bisa diuji tanpa menyentuh basis
 * data — keputusan yang salah di sini berarti mengunci akun orang yang masih
 * bekerja, dan itu bukan hal yang layak diuji langsung di produksi.
 */

export interface KasusOffboarding {
  id: string;
  jenis: string;
  nama: string;
  status: string;
  /** Penunjuk pasti ke akun karyawan manajemen; null bila belum dipilih. */
  userId: string | null;
  /** Penunjuk pasti ke baris Kontrak Tracker untuk crew outlet. */
  kontrakId: string | null;
  /** Tanggal perkaranya ditutup — dipakai sebagai tanggal resign. */
  tglSelesai: string | null;
  tanggal: string | null;
}

export interface TindakanPenutupan {
  /** Akun yang perlu dinonaktifkan. */
  nonaktifkanUser: string | null;
  /** Kontrak yang perlu diberi tanggal resign, beserta tanggalnya. */
  tandaiResign: { kontrakId: string; tanggal: string } | null;
}

const KOSONG: TindakanPenutupan = { nonaktifkanUser: null, tandaiResign: null };

/**
 * Apa yang harus dilakukan ketika sebuah perkara disimpan.
 *
 * Tidak melakukan apa pun kecuali TIGA syarat terpenuhi sekaligus: perkaranya
 * memang offboarding, statusnya selesai, dan orangnya ditunjuk dengan id.
 *
 * Syarat ketiga yang paling penting. Kalau id-nya kosong, modul ini sengaja
 * TIDAK menebak dari nama — dua karyawan bernama sama bukan hal yang aneh di
 * perusahaan seratusan orang, dan salah tebak berarti mengunci orang yang masih
 * bekerja. Perkara seperti itu ditangani lewat `perluDitutup()`: ditampilkan
 * sebagai pekerjaan yang tertinggal, bukan diselesaikan diam-diam dengan
 * tebakan.
 */
export function tindakanPenutupan(k: KasusOffboarding): TindakanPenutupan {
  if (k.jenis !== "offboarding" || k.status !== "selesai") return KOSONG;
  const tanggal = k.tglSelesai || k.tanggal;
  return {
    nonaktifkanUser: k.userId || null,
    tandaiResign: k.kontrakId && tanggal ? { kontrakId: k.kontrakId, tanggal } : null,
  };
}

export interface SisaPenutupan {
  kasusId: string;
  nama: string;
  /** Kenapa perkara ini belum benar-benar tertutup. */
  alasan: "akun-masih-aktif" | "kontrak-tanpa-tanggal-resign" | "orang-belum-ditunjuk";
}

/**
 * Perkara offboarding yang sudah ditandai selesai tapi jejaknya belum tuntas.
 *
 * Ini jaring pengaman, dan sengaja dibuat setelah penyambungan otomatis, bukan
 * sebagai gantinya. Otomatisasi hanya bekerja untuk perkara yang disimpan
 * SESUDAH fitur ini ada; yang tercatat sebelumnya, dan yang orangnya tidak
 * ditunjuk, tetap harus terlihat oleh manusia. Diam-diam melewatkannya persis
 * mengulang kesalahan yang sedang diperbaiki.
 */
export function perluDitutup(
  kasus: KasusOffboarding[],
  akunAktif: ReadonlySet<string>,
  kontrakTanpaResign: ReadonlySet<string>,
): SisaPenutupan[] {
  const sisa: SisaPenutupan[] = [];
  for (const k of kasus) {
    if (k.jenis !== "offboarding" || k.status !== "selesai") continue;
    if (!k.userId && !k.kontrakId) {
      sisa.push({ kasusId: k.id, nama: k.nama, alasan: "orang-belum-ditunjuk" });
      continue;
    }
    if (k.userId && akunAktif.has(k.userId)) {
      sisa.push({ kasusId: k.id, nama: k.nama, alasan: "akun-masih-aktif" });
    }
    if (k.kontrakId && kontrakTanpaResign.has(k.kontrakId)) {
      sisa.push({ kasusId: k.id, nama: k.nama, alasan: "kontrak-tanpa-tanggal-resign" });
    }
  }
  return sisa;
}

export const ALASAN_SISA: Record<SisaPenutupan["alasan"], string> = {
  "akun-masih-aktif": "Akunnya masih aktif — orang ini masih bisa masuk aplikasi.",
  "kontrak-tanpa-tanggal-resign": "Kontraknya belum diberi tanggal resign.",
  "orang-belum-ditunjuk": "Karyawannya belum ditunjuk, jadi tidak ada yang bisa ditutup otomatis.",
};
