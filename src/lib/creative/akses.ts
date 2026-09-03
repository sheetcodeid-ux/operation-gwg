import { canReachMenu } from "@/lib/nav";
import type { UserProfile } from "@/lib/types";

/**
 * Siapa melihat apa di dashboard penilaian.
 *
 * Dipisah dari halamannya supaya bisa diuji tanpa merender apa pun, dan supaya
 * jawabannya sama di tiga tempat yang menanyakannya: halaman, aksi kirim
 * laporan, dan penyaringan barisnya.
 */

/** Tim Creative dan super admin melihat seluruh wilayah dan bisa membandingkan. */
export function bolehLihatSemuaArea(user: UserProfile | null): boolean {
  if (!user) return false;
  if (user.role === "super_admin") return true;
  if (user.role === "area_coordinator") return false;
  return canReachMenu(user, "creative_design");
}

/**
 * Yang boleh MENGIRIM laporannya ke Coordinator Area.
 *
 * Sengaja lebih sempit daripada yang boleh membacanya. Laporan ini menilai
 * orang; ia harus datang dari tim yang mengerjakan desainnya, bukan dari siapa
 * saja yang kebetulan bisa membuka halamannya.
 */
export function bolehKirimLaporanPenilaian(user: UserProfile | null): boolean {
  if (!user) return false;
  if (user.role === "area_coordinator") return false;
  return user.role === "super_admin" || canReachMenu(user, "creative_design");
}
