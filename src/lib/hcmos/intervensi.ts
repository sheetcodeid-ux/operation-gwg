/**
 * Request Intervensi Kinerja — istilah dan aturannya.
 *
 * Dipisah dari komponennya supaya server (yang menyimpan) dan layar (yang
 * menampilkan) memakai daftar nilai yang sama persis. Daftar yang disalin ke
 * dua tempat selalu berakhir sama: satu sisi menerima nilai yang sisi lain
 * tolak, dan gejalanya membingungkan — pilihannya ada di layar tapi simpannya
 * gagal.
 */

export const PERAN_PEMOHON = ["head", "owner", "hc"] as const;
export type PeranPemohon = (typeof PERAN_PEMOHON)[number];

export const LABEL_PERAN_PEMOHON: Record<PeranPemohon, string> = {
  head: "Head Divisi",
  owner: "Owner",
  hc: "Human Capital",
};

export const STATUS_INTERVENSI = ["baru", "diproses", "selesai", "ditutup"] as const;
export type StatusIntervensi = (typeof STATUS_INTERVENSI)[number];

export const LABEL_STATUS_INTERVENSI: Record<StatusIntervensi, string> = {
  baru: "Baru",
  diproses: "Sedang Ditangani",
  selesai: "Selesai",
  ditutup: "Ditutup",
};

export const URGENSI_INTERVENSI = ["urgent", "normal", "rendah"] as const;
export type UrgensiIntervensi = (typeof URGENSI_INTERVENSI)[number];

export const LABEL_URGENSI_INTERVENSI: Record<UrgensiIntervensi, string> = {
  urgent: "Urgent",
  normal: "Normal",
  rendah: "Rendah",
};

/**
 * Siapa yang seharusnya mengajukan, dilihat dari posisi orang yang bermasalah.
 *
 * Aturannya sederhana tapi mudah tertukar saat formulirnya diisi buru-buru:
 * permintaan selalu datang dari SATU LAPIS DI ATAS. Head divisi tidak meminta
 * intervensi untuk dirinya sendiri — kalau ia yang bermasalah, yang meminta
 * adalah Owner.
 */
export function peranPemohonUntuk(posisi: "anggota" | "head"): PeranPemohon {
  return posisi === "head" ? "owner" : "head";
}
