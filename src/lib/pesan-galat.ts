/**
 * Merapikan pesan galat sebelum ditampilkan sebagai notifikasi.
 *
 * Pesan galat punya dua pembaca yang kebutuhannya bertolak belakang. Yang
 * membuka halaman perlu tahu apa yang terjadi dan apa yang bisa ia lakukan;
 * yang menelusuri nanti perlu bukti mentahnya. Selama ini keduanya dilayani
 * satu teks yang sama, dan yang menang selalu pembaca kedua — Coordinator Area
 * di lapangan disuguhi "Unexpected token '<', \"<body styl\"...".
 *
 * Kesepakatannya: pesan boleh membawa ekor teknis di dalam kurung siku, dan
 * fungsi ini yang memotongnya untuk tampilan. Jejak galat tetap menerima
 * pesan utuh, jadi tidak ada bukti yang hilang.
 */

/** Ambil bagian pesan yang layak dibaca orang; ekor teknisnya dibuang. */
export function pesanRingkas(pesan: string, maks = 160): string {
  const rapi = String(pesan ?? "").trim();
  if (!rapi) return "Terjadi kesalahan.";

  // Ekor teknis dimulai dari kurung siku pertama — tapi hanya kalau sebelumnya
  // sudah ada kalimat. Pesan yang SELURUHNYA teknis lebih baik tampil apa
  // adanya daripada berubah jadi teks kosong.
  const kurung = rapi.indexOf(" [");
  const inti = kurung > 0 ? rapi.slice(0, kurung).trim() : rapi;

  if (inti.length <= maks) return inti;
  // Dipotong di batas kata terdekat supaya tidak terputus di tengah kata.
  const potong = inti.slice(0, maks);
  const spasi = potong.lastIndexOf(" ");
  return `${(spasi > maks * 0.6 ? potong.slice(0, spasi) : potong).trimEnd()}…`;
}
