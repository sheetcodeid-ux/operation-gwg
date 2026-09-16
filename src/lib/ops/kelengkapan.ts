import type { FaktaPenjualan } from "./sales-fact";

/**
 * GERBANG KELENGKAPAN DATA — sebelum Signal V.1 boleh lahir.
 *
 * Sinyal yang lahir dari data separuh jadi adalah alarm palsu, dan alarm palsu
 * adalah cara tercepat membuat orang berhenti memercayai seluruh sistem. Outlet
 * yang lima belas harinya belum ditarik akan terbaca turun lima puluh persen,
 * lalu seseorang dikirim memperbaiki sesuatu yang tidak pernah rusak.
 *
 * AMBANGNYA TIDAK DITULIS DI SINI. Angka 95% yang sempat diusulkan masih
 * keputusan terbuka (`docs/operational-v1/decisions.md`, nomor 14) dan belum
 * diputuskan pemiliknya. Menuliskannya sebagai tetapan berarti mengarang
 * keputusan bisnis dan menyebarkannya ke tiap pemanggil — dua kesalahan
 * sekaligus. Jadi ambangnya WAJIB disuntikkan, dan tidak ada nilai bawaan.
 *
 * PHASE 4 yang mengunci dari mana ambang itu dibaca. Polanya sudah ada:
 * `op_settings.data` (jsonb, digabung dengan bawaan lewat `mergeSettings` di
 * `./settings-types`) adalah tempat seluruh ambang operasional lain disimpan,
 * dan menambahkannya di sana berarti satu tempat lagi yang sudah punya halaman
 * pengaturannya sendiri. Sampai itu diputuskan, berkas ini cuma menyediakan
 * bentuknya.
 *
 * MURNI — tanpa basis data. Bisa diuji, dan bisa dipakai di mana saja.
 */

/**
 * Ambang kelengkapan, 0–100.
 *
 * Bertipe tersendiri, bukan `number` telanjang, supaya yang memanggil harus
 * menyebut dari mana angkanya datang — dan supaya pencarian "siapa saja yang
 * memakai ambang ini" bisa dijawab TypeScript, bukan grep.
 */
export interface AmbangKelengkapan {
  /** Persen minimum supaya periode dianggap layak dinilai. 0–100. */
  persen: number;
  /** Dari mana angkanya datang — ikut dicatat supaya bisa dilacak. */
  sumber: "op_settings" | "parameter" | "bawaan-phase-4";
}

/** Keadaan sebuah periode terhadap ambangnya. */
export type StatusKelengkapan =
  /** Cukup lengkap untuk dinilai. */
  | "lengkap"
  /** Ada datanya, tapi belum mencapai ambang. */
  | "tidak_lengkap"
  /** Tidak ada satu baris pun. Bukan nol jualan — memang belum ada apa-apa. */
  | "tidak_tersedia"
  /** Ada barisnya, tapi sebagiannya tidak bisa dipercaya. */
  | "invalid";

export interface HasilKelengkapan {
  status: StatusKelengkapan;
  /** Berapa pasangan outlet×tanggal yang seharusnya ada. */
  wajib: number;
  /** Yang benar-benar ada DAN sah. */
  ada: number;
  /** Yang seharusnya ada tapi tidak ada sama sekali. */
  hilang: number;
  /** Yang ada tapi angkanya tidak sah — dihitung terpisah dari yang hilang. */
  cacat: number;
  /** 0–100. Null bila `wajib` nol — tidak ada yang bisa dipersentasekan. */
  persen: number | null;
  ambang: AmbangKelengkapan;
  /** Benar bila Signal boleh dilahirkan untuk periode ini. */
  bolehDinilai: boolean;
  /** Kalimat siap tampil — supaya alasannya tidak ditulis ulang tiap halaman. */
  alasan: string;
}

export interface MasukanKelengkapan {
  /** Berapa pasangan outlet×tanggal yang seharusnya ada di periode ini. */
  wajib: number;
  /** Fakta penjualan yang sudah lolos `saringFakta`. */
  fakta: readonly FaktaPenjualan[];
  /**
   * Baris yang ditemui tapi angkanya tidak sah — dari `HasilFakta.dibuang.cacat`.
   *
   * Dipisah dari yang hilang dengan sengaja. "Belum ditarik" dan "tertarik tapi
   * rusak" menuntut tindakan yang berbeda: yang pertama menunggu cron, yang
   * kedua menunggu orang memeriksa sumbernya.
   */
  cacat?: number;
  ambang: AmbangKelengkapan;
}

/**
 * Nilai kelengkapan satu periode.
 *
 * NOL JUALAN BUKAN DATA HILANG, dan itu pembedaan yang paling mudah dilanggar.
 * Outlet yang buka tapi tidak menjual apa pun tetap punya baris ber-`net = 0`;
 * ia dihitung ADA. Yang dihitung hilang cuma pasangan yang barisnya memang
 * tidak pernah sampai. Menyamakan keduanya membuat outlet yang sepi terbaca
 * seperti outlet yang datanya belum ditarik — dan yang kedua akan ditunggu,
 * sementara yang pertama seharusnya ditindaklanjuti sekarang.
 */
export function nilaiKelengkapan(m: MasukanKelengkapan): HasilKelengkapan {
  const cacat = Math.max(0, m.cacat ?? 0);
  const ada = m.fakta.length;
  const wajib = Math.max(0, m.wajib);
  const hilang = Math.max(0, wajib - ada - cacat);
  const persen = wajib > 0 ? (ada / wajib) * 100 : null;

  const status = tentukanStatus({ wajib, ada, cacat, persen, ambang: m.ambang.persen });
  return {
    status,
    wajib,
    ada,
    hilang,
    cacat,
    persen,
    ambang: m.ambang,
    bolehDinilai: status === "lengkap",
    alasan: kalimat({ status, wajib, ada, hilang, cacat, persen, ambang: m.ambang.persen }),
  };
}

function tentukanStatus(x: {
  wajib: number;
  ada: number;
  cacat: number;
  persen: number | null;
  ambang: number;
}): StatusKelengkapan {
  // Tidak ada yang diminta berarti tidak ada yang kurang. Periode tanpa outlet
  // — mis. sebelum outlet pertama buka — bukan periode yang datanya hilang.
  if (x.wajib === 0) return "lengkap";
  // Baris rusak mengalahkan segalanya. Periode yang 99% lengkap tapi memuat
  // angka yang tidak bisa dipercaya bukan periode yang "hampir lengkap" —
  // angka yang salah lebih berbahaya daripada angka yang tidak ada, karena
  // yang tidak ada masih kelihatan tidak ada.
  if (x.cacat > 0) return "invalid";
  if (x.ada === 0) return "tidak_tersedia";
  return (x.persen ?? 0) >= x.ambang ? "lengkap" : "tidak_lengkap";
}

function kalimat(x: {
  status: StatusKelengkapan;
  wajib: number;
  ada: number;
  hilang: number;
  cacat: number;
  persen: number | null;
  ambang: number;
}): string {
  const p = x.persen === null ? "—" : `${x.persen.toFixed(1)}%`;
  switch (x.status) {
    case "lengkap":
      return x.wajib === 0
        ? "Tidak ada outlet yang perlu dihitung pada periode ini."
        : `Data ${p} lengkap, memenuhi ambang ${x.ambang}%.`;
    case "tidak_lengkap":
      return `Data baru ${p} dari ambang ${x.ambang}% — ${x.hilang} dari ${x.wajib} angka belum masuk.`;
    case "tidak_tersedia":
      return `Belum ada satu angka pun dari ${x.wajib} yang diharapkan. Ini bukan nol jualan — datanya memang belum ditarik.`;
    case "invalid":
      return `${x.cacat} angka tidak bisa dibaca. Periode ini tidak dinilai sampai sumbernya diperiksa.`;
  }
}

/**
 * Berapa pasangan outlet×tanggal yang seharusnya ada.
 *
 * Yang dipakai HARI YANG SUDAH LEWAT, bukan seluruh hari dalam bulannya. Hari
 * ini masih berjalan, jadi menuntut angkanya sudah masuk berarti setiap periode
 * berjalan selamanya terbaca tidak lengkap.
 */
export const wajibPasangan = (jumlahOutlet: number, hariBerjalan: number): number =>
  Math.max(0, jumlahOutlet) * Math.max(0, hariBerjalan);
