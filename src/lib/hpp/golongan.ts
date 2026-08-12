/**
 * Pemisah bahan baku: dapur, bar, atau dipakai keduanya.
 *
 * Tinggal di sini — BUKAN di `data/hpp-ingredients.ts` — karena tabel dan
 * formulir Master Bahan Baku adalah komponen client, sedangkan modul data
 * mengimpor "server-only". Mengimpor nilainya dari sana menyeret klien
 * Supabase ke dalam bundel browser dan menggagalkan build.
 *
 * `general` sengaja jadi bawaan: banyak bahan memang dipakai dapur maupun bar
 * (gula, es batu, kemasan), dan bahan lama tidak boleh salah tergolong hanya
 * karena kolomnya baru ditambahkan.
 */
export const INGREDIENT_GOLONGAN = ["makanan", "minuman", "general"] as const;
export type IngredientGolongan = (typeof INGREDIENT_GOLONGAN)[number];

export const GOLONGAN_LABEL: Record<IngredientGolongan, string> = {
  makanan: "Makanan",
  minuman: "Minuman",
  general: "General",
};

/** Baca nilai dari basis data yang mungkin kosong / tak dikenal. */
export const asGolongan = (v: unknown): IngredientGolongan =>
  INGREDIENT_GOLONGAN.includes(v as IngredientGolongan) ? (v as IngredientGolongan) : "general";

/**
 * Baca golongan dari teks bebas hasil impor.
 *
 * Kolomnya boleh ditulis "Makanan", "makanan", "Food", atau dikosongkan.
 * Yang tidak dikenali jatuh ke `general` — menebak salah lebih berbahaya
 * daripada menandai bahannya dipakai keduanya.
 */
export function parseGolongan(v: string | undefined | null): IngredientGolongan {
  const t = (v ?? "").trim().toLowerCase();
  if (t.startsWith("makan") || t === "food" || t === "kitchen" || t === "dapur") return "makanan";
  if (t.startsWith("minum") || t === "beverage" || t === "drink" || t === "bar") return "minuman";
  return "general";
}
