/**
 * Pembagian bulan menjadi minggu, dan hitungan kejar-mengejar antarminggu.
 *
 * KENAPA MINGGU KALENDER TANGGAL, BUKAN SENIN–MINGGU. Minggu yang mengikuti
 * hari akan bergeser tiap bulan: Agustus dimulai Sabtu, September dimulai
 * Selasa, dan "minggu ke-1" keduanya memuat jumlah akhir pekan yang berbeda.
 * Yang dibandingkan di halaman ini adalah minggu ke-N bulan ini dengan minggu
 * ke-N bulan lalu, jadi pembagiannya harus sama persis tiap bulan — tanggal
 * 1–7, 8–14, 15–21, 22–28, lalu sisanya.
 *
 * Minggu terakhir SENGAJA dibiarkan pendek (2–3 hari) alih-alih digabung ke
 * minggu ke-4. Digabung, minggu ke-4 jadi 9–10 hari dan angkanya selalu
 * terlihat paling besar tanpa ada yang benar-benar naik.
 */

/** Satu minggu dalam bulan: nomor, tanggal awal–akhir, dan jumlah harinya. */
export interface RentangMinggu {
  minggu: number;
  dari: number;
  sampai: number;
  hari: number;
}

/** Jumlah hari satu periode "YYYY-MM". */
export function hariBulan(periode: string): number {
  const [th, bl] = periode.split("-").map(Number);
  return new Date(Date.UTC(th, bl, 0)).getUTCDate();
}

/** Minggu-minggu satu bulan: 1–7, 8–14, 15–21, 22–28, lalu sisanya. */
export function mingguBulan(periode: string): RentangMinggu[] {
  const hari = hariBulan(periode);
  const daftar: RentangMinggu[] = [];
  for (let dari = 1; dari <= hari; dari += 7) {
    const sampai = Math.min(dari + 6, hari);
    daftar.push({ minggu: daftar.length + 1, dari, sampai, hari: sampai - dari + 1 });
  }
  return daftar;
}

/** Tanggal awal dan akhir minggu itu sebagai "YYYY-MM-DD". */
export function tanggalMinggu(periode: string, m: RentangMinggu): { dari: string; sampai: string } {
  const p = (n: number) => String(n).padStart(2, "0");
  return { dari: `${periode}-${p(m.dari)}`, sampai: `${periode}-${p(m.sampai)}` };
}

/** Nomor minggu sebuah tanggal (1–5). */
export const mingguTanggal = (tanggal: number): number => Math.ceil(tanggal / 7);

/** Satu outlet dengan angka per minggu; `null` = minggunya belum ada datanya. */
export interface SumberMinggu {
  id: string;
  nama: string;
  kode: string;
  /** Target sebulan outlet itu — dasar seluruh target mingguannya. */
  targetBulan: number;
  /** Actual tiap minggu, urut minggu ke-1 dst. Panjangnya sama dengan jumlah minggu. */
  actual: (number | null)[];
  /** Hari yang sudah ada datanya di tiap minggu — minggu berjalan belum penuh. */
  hariAda: number[];
  /**
   * Outlet ini tidak punya rincian mingguan sama sekali (omzetnya diketik
   * bulanan karena belum masuk ESB). Dibedakan dari "kebetulan nol": nol
   * berarti tidak jualan, sedangkan ini berarti tidak terukur.
   */
  tanpaRincian?: boolean;
}

/** Hasil hitung satu outlet: target tiap minggu, capaian, dan angka kejarnya. */
export interface BarisMinggu extends SumberMinggu {
  /** Target tiap minggu PENUH = target bulan × porsi harinya. */
  target: number[];
  /**
   * Target tiap minggu sebanding hari yang SUDAH ada datanya. Sama dengan
   * `target` untuk minggu yang sudah lengkap; lebih kecil untuk minggu berjalan.
   */
  targetHariAda: number[];
  /** Capaian tiap minggu dalam persen; null bila minggunya belum ada datanya. */
  capaian: (number | null)[];
  /** Jumlah seluruh actual yang sudah ada. */
  terkumpul: number;
  /** Target sebanding hari yang sudah ada datanya. */
  targetSampai: number;
  /** Kekurangan terhadap `targetSampai`; 0 bila sudah di atas target. */
  kurang: number;
  /** Minggu pertama yang datanya belum lengkap — minggu yang harus mengejar. */
  mingguKejar: number | null;
  /**
   * Berapa yang harus masuk di `mingguKejar` supaya kekurangan minggu-minggu
   * sebelumnya ikut tertutup: target minggu itu sendiri + kekurangannya.
   * Null bila bulannya sudah habis — tidak ada lagi minggu untuk mengejar.
   */
  kejar: number | null;
  /** Capaian kumulatif terhadap `targetSampai`, dalam persen. */
  persen: number | null;
}

/**
 * Target mingguan = target bulan dibagi PORSI HARI, bukan dibagi jumlah minggu.
 *
 * Bulan 31 hari punya lima minggu yang hari terakhirnya cuma tiga hari.
 * Membaginya rata lima membuat minggu terakhir mustahil dicapai dan keempat
 * minggu lain terlalu longgar — dan angka yang salahnya sistematis begitu
 * berhenti dipakai orang.
 */
export function targetMinggu(targetBulan: number, minggu: RentangMinggu[], hari: number): number[] {
  return minggu.map((m) => (hari === 0 ? 0 : (targetBulan * m.hari) / hari));
}

/** Hitung target, capaian, dan angka kejar satu outlet. */
export function hitungBarisMinggu(s: SumberMinggu, minggu: RentangMinggu[], hari: number): BarisMinggu {
  const target = targetMinggu(s.targetBulan, minggu, hari);
  // Capaian minggu BERJALAN diukur terhadap hari yang sudah lewat di dalamnya,
  // bukan terhadap seminggu penuh. Kalau tidak, minggu yang baru jalan tiga
  // hari selalu terbaca 40-an persen dan selalu merah — bukan karena
  // outletnya tertinggal, melainkan karena empat harinya belum datang. Angka
  // yang salahnya sistematis begitu berhenti dipakai orang.
  const targetHariAda = minggu.map((m, i) => (hari === 0 ? 0 : (s.targetBulan * s.hariAda[i]) / hari));
  const capaian = s.actual.map((a, i) => (a === null || targetHariAda[i] <= 0 ? null : (a / targetHariAda[i]) * 100));

  const terkumpul = s.actual.reduce<number>((t, a) => t + (a ?? 0), 0);
  const hariAda = s.hariAda.reduce((t, n) => t + n, 0);
  const targetSampai = hari === 0 ? 0 : (s.targetBulan * hariAda) / hari;
  const kurang = Math.max(0, targetSampai - terkumpul);

  // Minggu yang mengejar adalah minggu pertama yang HARINYA belum lengkap —
  // bukan minggu pertama yang actual-nya kosong. Minggu berjalan yang baru
  // terisi dua hari sudah punya angka, tapi ia justru minggu yang masih bisa
  // dikejar; melewatinya membuat kolom kejar menunjuk minggu yang salah.
  const iKejar = minggu.findIndex((m, i) => s.hariAda[i] < m.hari);
  const mingguKejar = iKejar === -1 ? null : minggu[iKejar].minggu;
  // Sisa target minggu itu, bukan target penuhnya: hari yang sudah berjalan di
  // dalamnya sudah menyumbang ke `terkumpul`, jadi menghitungnya dua kali
  // membuat angka kejarnya lebih besar daripada yang sebenarnya kurang.
  const sisaTargetKejar =
    iKejar === -1 || hari === 0
      ? 0
      : (s.targetBulan * (minggu[iKejar].hari - s.hariAda[iKejar])) / hari;
  const kejar = iKejar === -1 ? null : sisaTargetKejar + kurang;

  return {
    ...s,
    target,
    targetHariAda,
    capaian,
    terkumpul,
    targetSampai,
    kurang,
    mingguKejar,
    kejar,
    persen: targetSampai <= 0 ? null : (terkumpul / targetSampai) * 100,
  };
}

/** Hitung seluruh outlet sekaligus. */
export function hitungMinggu(sumber: SumberMinggu[], minggu: RentangMinggu[], hari: number): BarisMinggu[] {
  return sumber.map((s) => hitungBarisMinggu(s, minggu, hari));
}

/**
 * Baris KORPORAT: jumlah seluruh outlet, dihitung ulang lewat jalur yang sama.
 *
 * Bukan dengan menjumlahkan hasil per outlet — outlet yang tidak punya rincian
 * mingguan akan menyumbang nol ke tiap minggu tapi tetap menyumbang targetnya,
 * dan totalnya akan selalu terlihat gagal. Yang dijumlahkan hanya outlet yang
 * BENAR-BENAR terukur mingguan, target maupun actual-nya.
 */
export function korporatMinggu(baris: BarisMinggu[], minggu: RentangMinggu[], hari: number): BarisMinggu | null {
  const ikut = baris.filter((b) => !b.tanpaRincian);
  if (ikut.length === 0) return null;
  const actual = minggu.map((_, i) =>
    ikut.some((b) => b.actual[i] !== null) ? ikut.reduce<number>((t, b) => t + (b.actual[i] ?? 0), 0) : null,
  );
  return hitungBarisMinggu(
    {
      id: "korporat",
      nama: "Seluruh outlet",
      kode: "",
      targetBulan: ikut.reduce((t, b) => t + b.targetBulan, 0),
      actual,
      // Hari yang dianggap ada = yang PALING BANYAK dimiliki satu outlet.
      // Memakai yang paling sedikit membuat satu outlet yang tertinggal
      // menarik mundur seluruh perusahaan seolah datanya belum ada.
      hariAda: minggu.map((_, i) => Math.max(...ikut.map((b) => b.hariAda[i]))),
    },
    minggu,
    hari,
  );
}
