/**
 * Standar kompetensi jabatan outlet.
 *
 * Ini ACUAN, bukan penilaian. Angkanya menyatakan level yang DIHARAPKAN pada
 * sebuah jabatan, dan dipakai sebagai pembanding saat menilai seseorang di
 * Competency Matrix. Tanpa acuan tertulis, "level 3" hanya berarti apa yang
 * kebetulan dipikirkan penilainya hari itu, dan dua orang di outlet berbeda
 * mendapat angka berbeda untuk kemampuan yang sama.
 *
 * Skalanya sengaja pendek. Skala 1–10 terlihat lebih teliti tapi tidak pernah
 * dipakai konsisten: yang mengisi akan berkutat di 6–8, dan selisih satu angka
 * berhenti punya arti.
 */

export const SKALA_KOMPETENSI = { min: 1, max: 5 } as const;

export const ARTI_LEVEL: Record<number, string> = {
  1: "Dasar — masih perlu didampingi",
  2: "Berkembang — bisa dengan arahan",
  3: "Cakap — mandiri untuk tugas rutin",
  4: "Mahir — menangani kasus tidak biasa",
  5: "Panutan — mampu melatih orang lain",
};

/** Jabatan outlet yang punya standar, urut dari jenjang terendah. */
export const JABATAN_STANDAR = ["Barista", "Shift Leader", "Supervisor"] as const;
export type JabatanStandar = (typeof JABATAN_STANDAR)[number];

export interface StandarKompetensi {
  kompetensi: string;
  level: Record<JabatanStandar, number>;
}

export const STANDAR_OUTLET: StandarKompetensi[] = [
  { kompetensi: "Standar Produk & Resep", level: { Barista: 3, "Shift Leader": 4, Supervisor: 5 } },
  { kompetensi: "Layanan Pelanggan", level: { Barista: 4, "Shift Leader": 4, Supervisor: 5 } },
  { kompetensi: "Pengelolaan Kas & Kasir", level: { Barista: 2, "Shift Leader": 4, Supervisor: 5 } },
  { kompetensi: "Kepemimpinan Tim", level: { Barista: 1, "Shift Leader": 3, Supervisor: 5 } },
];
