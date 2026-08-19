/**
 * Core Values GWG Group.
 *
 * Ditulis di sini, bukan disimpan di basis data, karena nilai inti perusahaan
 * bukan data yang berubah lewat formulir — ia berubah lewat keputusan, dan
 * ketika berubah, seluruh materi onboarding ikut disesuaikan. Menaruhnya di
 * tabel yang bisa disunting siapa saja yang punya akses membuat nilai yang
 * seharusnya paling stabil justru jadi yang paling gampang bergeser.
 *
 * Poster, deck onboarding, dan turunannya tetap diunggah sebagai dokumen di
 * Pusat Dokumen — yang berubah sering memang berkasnya, bukan nilainya.
 */

export interface NilaiInti {
  /** Nama ikon lucide. */
  icon: string;
  nama: string;
  arti: string;
}

export const CORE_VALUES: NilaiInti[] = [
  { icon: "HeartHandshake", nama: "Hospitality First", arti: "Melayani pelanggan dan rekan kerja dengan tulus." },
  { icon: "ShieldCheck", nama: "Integrity", arti: "Jujur dan konsisten dalam setiap tindakan." },
  { icon: "Sparkles", nama: "Consistency in Quality", arti: "Menjaga standar produk & layanan di semua brand." },
  { icon: "UsersRound", nama: "Teamwork", arti: "Kolaborasi lintas outlet dan divisi." },
  { icon: "TrendingUp", nama: "Growth Mindset", arti: "Terbuka terhadap pembelajaran dan perbaikan berkelanjutan." },
];
