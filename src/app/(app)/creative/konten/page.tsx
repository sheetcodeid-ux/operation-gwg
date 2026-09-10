import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { canReachMenu } from "@/lib/nav";
import { kelolaAntrianDesign } from "@/lib/hc-request";
import { getUsers } from "@/lib/data/store";
import { PitaCreative } from "@/components/creative/kit-creative";
import { PapanAntrianDesign } from "@/components/creative/papan-antrian";
import { papanDesign } from "@/lib/data/design-rapor";

export const metadata: Metadata = { title: "Antrian Konten" };

export default async function CreativeKontenQueuePage() {
  const user = await requireSessionUser();
  if (!canReachMenu(user, "creative_konten")) redirect("/dashboard");

  // Kandidat PIC = anggota aktif tim Creative. Akun tanpa departemen (mis. Super
  // Admin) melihat seluruh karyawan aktif — kalau tidak, daftar PIC-nya kosong
  // dan permintaan tidak bisa ditugaskan sama sekali.
  const active = getUsers().filter((u) => u.active);
  const creative = active.filter((u) => u.department === "Creative");
  const picOptions = (creative.length > 0 ? creative : active)
    .map((u) => ({ id: u.id, name: u.name, jabatan: u.jabatan ?? null }))
    .sort((a, b) => a.name.localeCompare(b.name, "id"));

  // Yang mengelola antrian membagi pekerjaan; yang mengerjakan hanya menerima
  // kolam bersama + miliknya sendiri. Pembatasannya sendiri dilakukan di server
  // (`allHcRequestsAction`); di sini hanya menentukan tampilannya.
  const kelola = kelolaAntrianDesign(user);

  // Papan angka hanya untuk yang MENGELOLA antrian. Yang mengerjakan melihat
  // pekerjaannya sendiri; menampilkan rapot rekan sedivisi kepadanya mengubah
  // alat kerja jadi papan pengumuman siapa yang tertinggal.
  const papan = kelola ? await papanDesign() : null;

  return (
    <div className="flex w-full flex-col gap-3">
      {/* Pita yang sama dengan Penilaian Request. Dua halaman Creative yang
          memakai kepala berbeda membuat divisinya terbaca seperti dua produk
          yang kebetulan sama-sama dipasang di sini. */}
      <PitaCreative
        ikon="Megaphone"
        eyebrow="Creative · Permintaan Masuk"
        judul="Antrian Konten"
        ringkas={
          kelola
            ? "Materi dari Marketing Communication — punya tanggal tayang, dan tenggat desainnya sehari sebelumnya. Tugaskan PIC-nya, lalu kirim hasilnya."
            : "Materi konten dari Marketing Communication. Ambil dari Menunggu untuk mulai mengerjakan, lalu kirim hasilnya."
        }
      />
      <PapanAntrianDesign sumber="marcomm" papan={papan} picOptions={picOptions} kelola={kelola} meId={user.id} />
    </div>
  );
}
