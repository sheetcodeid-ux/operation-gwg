/**
 * Konversi kemasan → satuan pakai.
 *
 * Barang dibeli per dus/karton, tapi resep memakai pcs. Modul ini kecil dan
 * bebas dependensi server supaya kalkulator (client) dan lapisan data (server)
 * memakai rumus yang sama persis — bukan dua salinan yang bisa berbeda.
 */

export interface PackedItem {
  buyPrice: number;
  buyQty: number;
  buyUnit: string;
  /** Isi per satuan beli (1 dus = 24 pcs ⇒ 24). Barang satuan bernilai 1. */
  contentQty?: number;
  /** Satuan yang dipakai resep (pcs). Kosong ⇒ sama dengan satuan beli. */
  contentUnit?: string;
}

/** Harga per satuan pakai: 1 dus Rp120.000 isi 24 ⇒ Rp5.000/pcs. */
export function unitPrice(i: Pick<PackedItem, "buyPrice" | "buyQty" | "contentQty">): number {
  const divisor = (i.buyQty || 1) * (i.contentQty || 1);
  return divisor ? i.buyPrice / divisor : i.buyPrice;
}

/**
 * Bentuk bahan sebagaimana dipakai resep — kemasan sudah dijabarkan, sehingga
 * kalkulator cukup membagi harga dengan qty seperti biasa.
 */
export function recipeUnits(i: PackedItem): { buyPrice: number; buyQty: number; buyUnit: string } {
  return {
    buyPrice: i.buyPrice,
    buyQty: (i.buyQty || 1) * (i.contentQty || 1),
    buyUnit: i.contentUnit || i.buyUnit,
  };
}
