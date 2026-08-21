import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { canReachMenu } from "@/lib/nav";
import { getUsers } from "@/lib/data/store";
import { getUserDepartments } from "@/lib/data/user-departments";
import { bolehUbahHc } from "@/lib/hcmos/akses";
import { BaganOrganisasi } from "@/components/hcmos/bagan-organisasi";
import type { SimpulBagan } from "@/lib/hcmos/bagan";

export const metadata: Metadata = { title: "Struktur Organisasi — HC-MOS" };

/**
 * Bagan struktur organisasi — halamannya sendiri.
 *
 * Dulu ia satu seksi di dalam Profil Organisasi, dan itu keliru: bagan dipakai
 * layar penuh dan berlama-lama, sementara isi halaman itu dibaca sekilas.
 * Menumpuk keduanya berarti bagannya selalu terjepit di kotak pendek, dan
 * ringkasan di sekelilingnya selalu terdorong jauh ke bawah.
 *
 * Halamannya sengaja nyaris kosong selain bagannya: tidak ada kartu angka,
 * tidak ada tabel. Yang datang ke sini datang untuk satu hal.
 */
export default async function BaganPage() {
  const user = await requireSessionUser();
  if (!canReachMenu(user, "hcmos")) redirect("/dashboard");

  const users = getUsers().filter((u) => u.active);
  const orangPerDep = new Map<string, { nama: string; jabatan: string }[]>();
  for (const u of users) {
    const dep = (u.department ?? "").trim();
    if (!dep) continue;
    orangPerDep.set(dep, [...(orangPerDep.get(dep) ?? []), { nama: u.name, jabatan: (u.jabatan ?? "").trim() || "—" }]);
  }
  for (const [k, v] of orangPerDep) {
    orangPerDep.set(k, [...v].sort((a, b) => a.nama.localeCompare(b.nama, "id")));
  }

  const simpul: SimpulBagan[] = (await getUserDepartments()).map((d) => ({
    id: d.id,
    nama: d.name,
    level: d.level,
    parentId: d.parentId,
    urutan: d.urutan,
    posX: d.posX,
    posY: d.posY,
    // Jumlah orang dihitung dari profil aktif, tidak pernah diketik. Angka yang
    // diketik di bagan berhenti berubah saat orangnya bertambah, dan tidak ada
    // yang menyadarinya sampai seseorang membandingkannya dengan User Management.
    jumlahOrang: (orangPerDep.get(d.name) ?? []).length,
    orang: orangPerDep.get(d.name) ?? [],
    jabatan: d.jabatan,
    deskripsi: d.deskripsi,
  }));

  // Seluruh karyawan aktif — untuk memilih siapa yang ditambahkan ke sebuah
  // role. Diambil di server, bukan dicari ulang lewat aksi tiap kali panelnya
  // dibuka: seratusan nama itu ringan, dan menunggu jaringan setiap kali panel
  // terbuka terasa jauh lebih berat daripada mengirimkannya sekali.
  const semuaOrang = users
    .map((u) => ({ id: u.id, nama: u.name, jabatan: (u.jabatan ?? "").trim() || "—", departemen: (u.department ?? "").trim() }))
    .sort((a, b) => a.nama.localeCompare(b.nama, "id"));

  // Tanpa breadcrumb, tanpa tautan kembali, tanpa keterangan: halaman ini
  // adalah kanvas, dan setiap baris di atasnya memotong tinggi kanvas itu.
  // Jalan kembali tetap ada di sidebar, tempat orang memang mencarinya.
  return <BaganOrganisasi simpul={simpul} semuaOrang={semuaOrang} bolehUbah={bolehUbahHc(user)} />;
}
