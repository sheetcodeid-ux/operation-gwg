/**
 * Membaca angka dari sel Excel yang bisa berisi apa saja — SATU pembaca untuk
 * seluruh jalur unggah di aplikasi ini.
 *
 * KENAPA INI TIDAK BOLEH DISALIN. Excel di Indonesia menulis ribuan dengan
 * TITIK: "1.234.567". Cara yang tampak wajar —
 *
 *     Number(String(v).replace(/[^\d.-]/g, "")) || 0
 *
 * — menghasilkan NaN untuk teks itu, lalu `|| 0` mengubahnya jadi NOL. Angkanya
 * tidak ditolak, tidak memberi pesan, dan tidak kosong: ia tersimpan sebagai
 * nol. Rp 1,2 miliar berubah jadi Rp 0 tanpa satu pun tanda, dan yang
 * membacanya berbulan-bulan kemudian hanya melihat outlet yang seolah tidak
 * berbelanja apa pun.
 *
 * Itu bukan kemungkinan teoretis: rumus di atas persis yang dipakai tiga
 * halaman unggah Operation sebelum pembaca ini dibuat.
 *
 * Sel yang memang bertipe angka tidak lewat jalur teks sama sekali.
 */
export function angkaExcel(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;

  let t = String(v).replace(/[^\d.,-]/g, "").trim();
  if (!t) return null;
  const koma = t.lastIndexOf(",");
  const titik = t.lastIndexOf(".");
  if (koma >= 0 && titik >= 0) {
    // Yang di belakang adalah pemisah desimal; yang di depan pemisah ribuan.
    t = koma > titik ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
  } else if (koma >= 0) {
    // Satu koma: desimal bila menyisakan 1–2 angka, selain itu pemisah ribuan.
    t = t.length - koma - 1 <= 2 ? t.replace(",", ".") : t.replace(/,/g, "");
  } else if (titik >= 0) {
    t = t.length - titik - 1 === 3 ? t.replace(/\./g, "") : t;
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/**
 * Sama, tapi sel kosong dibaca NOL.
 *
 * Dipakai kolom yang memang selalu punya angka (beban, pembelian): di situ
 * kosong berarti nol rupiah. Untuk kolom yang kosongnya berarti "belum
 * dilaporkan", pakai `angkaExcel` dan jaga null-nya — dua hal itu menuntut
 * tindakan yang berbeda, dan menyamakannya menuduh orang tidak bekerja.
 */
export const angkaExcelNol = (v: unknown): number => angkaExcel(v) ?? 0;
