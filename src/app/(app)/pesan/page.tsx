import { MessagesSquare } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { requireSessionUser } from "@/lib/auth";
import { chatDirectory, chatEnabled, listThreads } from "@/lib/data/chat";
import { PageHeader } from "@/components/ui/page-header";
import { Messenger } from "@/components/chat/messenger";

export const metadata: Metadata = { title: "Pesan" };

export default async function PesanPage() {
  const user = await requireSessionUser();

  // Tidak ada penjagaan peran: Pesan memang untuk SEMUA pengguna. Batas yang
  // dijaga adalah per percakapan — hanya pesertanya yang bisa membaca isinya.
  const [threads, people] = await Promise.all([
    chatEnabled() ? listThreads(user.id) : Promise.resolve([]),
    Promise.resolve(chatDirectory(user.id)),
  ]);

  return (
    <div className="w-full">
      <PageHeader
        icon={MessagesSquare}
        title="Pesan"
        description="Terhubung ke seluruh tim. Pengajuan bisa diteruskan ke sini untuk dibahas atau diminta revisinya."
      />
      {chatEnabled() ? (
        // useSearchParams di dalam Messenger butuh batas Suspense saat prerender.
        <Suspense fallback={<div className="h-[calc(100dvh-13rem)] min-h-[26rem] rounded-xl border border-border" />}>
          <Messenger meId={user.id} initialThreads={threads} people={people} />
        </Suspense>
      ) : (
        <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Pesan membutuhkan basis data yang aktif.
        </p>
      )}
    </div>
  );
}
