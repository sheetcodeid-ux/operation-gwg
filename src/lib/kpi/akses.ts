import type { KodePosisi } from "./struktur";
import type { UserProfile } from "@/lib/types";
import { canReachMenu, type MenuKey } from "@/lib/nav";

/**
 * Menu sidebar untuk tiap posisi.
 *
 * Dipisah dari daftar menu supaya halamannya bisa memeriksa izin dengan kunci
 * yang PERSIS sama dengan yang dipakai sidebar. Menyalin pemetaan ini di dua
 * tempat berarti suatu saat sidebar menampilkan baris yang halamannya menolak
 * membuka — dan yang terlihat pengguna cuma menu yang melempar balik.
 */
export const MENU_POSISI: Record<KodePosisi, string> = {
  operational_ca: "kpi_op_ca",
  creative_content: "kpi_creative_content",
  creative_sosmed: "kpi_creative_sosmed",
  finance_accounting: "kpi_fin_accounting",
  finance_finance: "kpi_fin_finance",
  finance_tax: "kpi_fin_tax",
  marcomm: "kpi_marcomm",
  pdq_food: "kpi_pdq_food",
  pdq_beverage: "kpi_pdq_beverage",
  pdq_head_food: "kpi_pdq_head_food",
  pdq_head_pdq: "kpi_pdq_head_pdq",
};

/**
 * Siapa boleh mengubah bobot dan target.
 *
 * Sengaja lebih sempit daripada yang boleh membaca. Bobot adalah kebijakan
 * perusahaan; kalau orang yang dinilai bisa mengubahnya sendiri, angkanya
 * berhenti berarti apa pun.
 */
export const bolehAturKpi = (user: UserProfile | null): boolean => user?.role === "super_admin";

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
