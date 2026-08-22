import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { canReachMenu } from "@/lib/nav";
import { getUsers } from "@/lib/data/store";
import { getSuntinganRaci } from "@/lib/data/raci";
import { bolehUbahHc } from "@/lib/hcmos/akses";
import { susunMatriks } from "@/lib/hcmos/raci";
import { MatriksRaci } from "@/components/hcmos/matriks-raci";

export const metadata: Metadata = { title: "Matriks RACI — HC-MOS" };

/**
 * Matriks RACI — halamannya sendiri, seluruh layar.
 *
 * Sengaja nyaris kosong selain matriksnya: tidak ada breadcrumb, tidak ada
 * kepala halaman, tidak ada kartu keterangan. Matriks ini dibaca berlama-lama
 * dan digulir dua arah, dan setiap baris di atasnya memotong tinggi yang
 * tersedia untuk isinya. Jalan kembali tetap ada di sidebar, tempat orang
 * memang mencarinya.
 */
export default async function RaciPage() {
  const user = await requireSessionUser();
  if (!canReachMenu(user, "hcmos")) redirect("/dashboard");

  // Matriks Juknis ditimpa suntingan yang tersimpan. Gagal membaca suntingan
  // TIDAK menggagalkan halaman — yang tampil kemudian adalah susunan Juknis,
  // kurang mutakhir tapi benar dan lengkap.
  const baris = susunMatriks(await getSuntinganRaci());

  // Nama karyawan aktif, untuk usulan saat menambah pemegang peran. Diambil di
  // server sekali, bukan dicari ulang lewat aksi tiap kali panelnya dibuka:
  // seratusan nama itu ringan, dan menunggu jaringan setiap kali panel terbuka
  // terasa jauh lebih berat daripada mengirimkannya sekali di awal.
  const orangSistem = [...new Set(getUsers().filter((u) => u.active).map((u) => u.name.trim()).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b, "id"),
  );

  return <MatriksRaci baris={baris} bolehUbah={bolehUbahHc(user)} orangSistem={orangSistem} />;
}
