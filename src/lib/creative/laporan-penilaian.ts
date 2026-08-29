import {
  AMBANG_HIJAU,
  AMBANG_KUNING,
  BOBOT_BRIEF,
  BOBOT_WAKTU,
  LABEL_META,
  labelPeriode,
  type RekapArea,
} from "./penilaian-request";

/**
 * Naskah laporan yang dikirim ke Coordinator Area.
 *
 * MENGAPA TEKS, BUKAN TAUTAN SAJA. Tautan menuntut orangnya membuka aplikasi,
 * mencari menunya, lalu memasang saringan yang sama persis — tiga langkah yang
 * cukup untuk membuat laporannya tidak pernah dibaca. Isinya karena itu berdiri
 * sendiri: dibaca di notifikasi ponsel pun sudah utuh, dan tautannya untuk yang
 * ingin menelusuri.
 *
 * MENGAPA CARA HITUNGNYA IKUT DIKIRIM. Laporan ini menilai orang. Angka yang
 * sampai tanpa penjelasan akan dijawab "dari mana angkanya?", dan pertanyaan itu
 * tidak bisa dijawab lewat notifikasi — jadi jawabannya dikirim lebih dulu.
 */

/** Batas aman satu pesan chat (`MAX_BODY` 4000) dengan ruang sisa. */
export const BATAS_NASKAH = 3800;

/** Paling banyak sekian nama per area; sisanya diringkas. */
export const MAKS_NAMA_PER_AREA = 12;

const satuDesimal = (n: number) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(n);

export interface IsiLaporan {
  /** "" berarti seluruh periode. */
  periode: string;
  area: RekapArea[];
  catatan: string;
  pengirim: string;
}

export function judulLaporan(periode: string): string {
  return `Penilaian Request Design — ${periode ? labelPeriode(periode) : "seluruh periode"}`;
}

/**
 * Satu baris ringkas per orang.
 *
 * Urutan datanya disengaja: label dulu (yang dicari sekilas), lalu persen
 * mendadak (angka yang dibawa ke rapat), baru skor. Skor ditaruh belakangan
 * karena ia gabungan — paling mudah diperdebatkan, dan paling tidak berguna
 * sebagai kalimat pembuka.
 */
function barisOrang(o: RekapArea["orang"][number], urutan: number): string {
  const tenggang = o.rataHari === null ? "tanpa tanggal" : `rata-rata ${satuDesimal(o.rataHari)} hari`;
  return `${urutan}. ${o.nama} — ${LABEL_META[o.label].label} · ${o.persenMendadak}% mendadak (${o.mendadak}/${o.jumlah}) · ${tenggang} · skor ${o.rataSkor}`;
}

export function susunLaporan(isi: IsiLaporan): string {
  const { area, periode, catatan, pengirim } = isi;
  const total = area.reduce((a, x) => a + x.jumlah, 0);
  const mendadak = area.reduce((a, x) => a + x.mendadak, 0);

  const bagian: string[] = [];
  bagian.push(`📊 ${judulLaporan(periode)}`);
  bagian.push(
    total === 0
      ? "Belum ada permintaan design yang dinilai pada periode ini."
      : `${total} permintaan dinilai · ${mendadak} mendadak (${Math.round((mendadak / total) * 100)}%)`,
  );

  for (const a of area) {
    const kepala = `▸ ${a.areaNama} — ${LABEL_META[a.label].label} · ${a.jumlah} permintaan · ${a.persenMendadak}% mendadak`;
    const orang = a.orang.slice(0, MAKS_NAMA_PER_AREA).map((o, i) => `   ${barisOrang(o, i + 1)}`);
    const sisa = a.orang.length - orang.length;
    if (sisa > 0) orang.push(`   …dan ${sisa} pemohon lain.`);
    bagian.push([kepala, ...orang].join("\n"));
  }

  bagian.push(
    `Cara bacanya: ${BOBOT_WAKTU} poin dari selisih hari antara permintaan dikirim dan tanggal dibutuhkannya — dihitung otomatis dari data, tidak ada yang mengisinya. ${BOBOT_BRIEF} poin dari ceklis kelengkapan brief, dicentang saat hasil design di-ACC. Hijau ≥ ${AMBANG_HIJAU}, kuning ≥ ${AMBANG_KUNING}, di bawah itu merah.`,
  );

  if (catatan.trim()) bagian.push(`Catatan ${pengirim}: ${catatan.trim()}`);
  bagian.push("Rinciannya di menu Creative › Penilaian Request.");

  return potong(bagian.join("\n\n"));
}

/**
 * Potong di batas BARIS, bukan di tengah kalimat.
 *
 * Laporan yang terputus di tengah angka lebih buruk daripada laporan yang
 * jujur bilang ada sisa yang tidak muat — yang pertama terbaca seperti data
 * yang salah.
 */
function potong(teks: string): string {
  if (teks.length <= BATAS_NASKAH) return teks;
  const ekor = "\n\n…daftarnya terlalu panjang untuk satu pesan. Selengkapnya di menu Creative › Penilaian Request.";
  const muat = BATAS_NASKAH - ekor.length;
  const dipotong = teks.slice(0, muat);
  const batas = dipotong.lastIndexOf("\n");
  return (batas > 0 ? dipotong.slice(0, batas) : dipotong.trimEnd()) + ekor;
}
