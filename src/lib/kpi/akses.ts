import type { UserProfile } from "@/lib/types";
import { canReachMenu, type MenuKey } from "@/lib/nav";

// Pemetaan posisi → menu pindah ke `struktur.ts`, bersama posisinya sendiri.
// Diteruskan dari sini supaya pemanggil lama tidak perlu ikut berubah.
export { MENU_POSISI } from "./struktur";

/**
 * Siapa boleh mengubah bobot dan target.
 *
 * Sengaja lebih sempit daripada yang boleh membaca. Bobot adalah kebijakan
 * perusahaan; kalau orang yang dinilai bisa mengubahnya sendiri, angkanya
 * berhenti berarti apa pun.
 */
export const bolehAturKpi = (user: UserProfile | null): boolean => user?.role === "super_admin";

/**
 * Siapa boleh mengubah angka bulanan per outlet — Gross Sales, Net Profit, dan
 * Harga Pokok Penjualan.
 *
 * KETIGANYA adalah angka yang MENILAI Coordinator Area, dan ketiganya bergerak
 * searah dengan skornya: penjualan yang lebih besar menaikkan capaian, laba
 * yang lebih besar menaikkan capaian, harga pokok yang lebih kecil menaikkan
 * capaian. Membiarkan yang dinilai mengetik sendiri angka penilainya sama
 * dengan meniadakan penilaiannya — dan tidak ada di antara ketiganya yang bisa
 * dikecualikan tanpa membuka celah yang sama.
 *
 * Yang tersisa untuk Coordinator Area hanyalah Hygiene Audit/CCTV, dan itu pun
 * wajib berbukti.
 */
export const bolehAngkaOutlet = (user: UserProfile | null): boolean => user?.role === "super_admin";

/**
 * PIC yang WAJIB dipakai orang ini — atau null bila ia boleh melihat semuanya.
 *
 * Coordinator Area boleh membuka KPI-nya sendiri untuk memantau, tapi hanya
 * areanya: capaian rekannya bukan urusannya, dan membiarkannya terbuka membuat
 * rapor orang lain beredar tanpa sepengetahuan yang dinilai.
 *
 * Yang memegang menu Ringkasan KPI dikecualikan — menu itu memang diberikan
 * kepada orang yang tugasnya membaca capaian seluruh departemen.
 */
export function picTerkunci(user: UserProfile | null): string | null {
  if (!user || user.role !== "area_coordinator") return null;
  return canReachMenu(user, "kpi" as MenuKey) ? null : user.id;
}
