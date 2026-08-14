import type { UserProfile } from "@/lib/types";

/**
 * Siapa yang boleh MENGUBAH data HC-MOS.
 *
 * Aturannya sama di banyak halaman, jadi ditulis sekali. Kalau disalin ke tiap
 * halaman, satu halaman yang tertinggal saat aturannya berubah akan membuka
 * data yang seharusnya tertutup — dan tidak ada yang menyadarinya sampai ada
 * yang mengubah sesuatu yang bukan haknya.
 */
export function bolehUbahHc(user: UserProfile | null | undefined): boolean {
  if (!user) return false;
  return user.role === "super_admin" || user.role === "legal" || user.department === "Human Capital";
}
