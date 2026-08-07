import type { Metadata } from "next";
import { Suspense } from "react";
import { requireSessionUser } from "@/lib/auth";
import { chatDirectory, chatEnabled, listThreads } from "@/lib/data/chat";
import { Messenger } from "@/components/chat/messenger";

export const metadata: Metadata = { title: "Pesan" };

/**
 * Pesan mengisi seluruh area isi — tanpa breadcrumb, judul halaman, atau footer.
 *
 * Ini aplikasi, bukan dokumen: judul percakapan sudah ada di kepala kolom
 * tengah, dan kerangka halaman biasa hanya membuat isinya lebih tinggi dari
 * layar sehingga semuanya ikut bergeser saat digulir. Pelepasan kerangka itu
 * diatur di `MainShell`.
 */
export default async function PesanPage() {
  const user = await requireSessionUser();

  // Tidak ada penjagaan peran: Pesan memang untuk SEMUA pengguna. Batas yang
  // dijaga adalah per percakapan — hanya pesertanya yang bisa membaca isinya.
  const [threads, people] = await Promise.all([
    chatEnabled() ? listThreads(user.id) : Promise.resolve([]),
    Promise.resolve(chatDirectory(user.id)),
  ]);

  if (!chatEnabled()) {
    return (
      <div className="grid flex-1 place-items-center p-6">
        <p className="text-sm text-muted-foreground">Pesan membutuhkan basis data yang aktif.</p>
      </div>
    );
  }

  return (
    // useSearchParams di dalam Messenger butuh batas Suspense saat prerender.
    <Suspense fallback={<div className="flex-1" />}>
      <Messenger meId={user.id} initialThreads={threads} people={people} />
    </Suspense>
  );
}
