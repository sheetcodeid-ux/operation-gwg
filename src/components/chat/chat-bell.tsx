"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessagesSquare } from "lucide-react";
import { chatUnreadTotalAction } from "@/lib/actions/chat";
import { cn } from "@/lib/utils";

/**
 * Pintu masuk Pesan di topbar, lengkap dengan jumlah yang belum dibaca.
 *
 * Hitungannya disegarkan berkala dan BERHENTI saat tab tidak terlihat — ini
 * ada di setiap halaman, jadi kalau dibiarkan jalan terus ia akan jadi
 * permintaan paling sering di seluruh aplikasi tanpa ada yang melihatnya.
 */
const POLL_MS = 30_000;

export function ChatBell() {
  const pathname = usePathname();
  const [unread, setUnread] = React.useState(0);
  const onChat = pathname.startsWith("/pesan");

  React.useEffect(() => {
    let stop = false;
    const tick = async () => {
      if (stop || document.visibilityState !== "visible") return;
      const n = await chatUnreadTotalAction();
      if (!stop) setUnread(n);
    };
    void tick();
    const id = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      stop = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
    // Saat berpindah halaman hitungannya diambil ulang — mis. setelah membaca
    // percakapan lalu keluar dari /pesan.
  }, [pathname]);

  return (
    <Link
      href="/pesan"
      aria-label={unread > 0 ? `Pesan, ${unread} belum dibaca` : "Pesan"}
      title="Pesan"
      className={cn(
        "relative grid size-9 place-items-center rounded-lg transition-colors hover:bg-muted hover:text-foreground",
        onChat ? "text-foreground" : "text-muted-foreground",
      )}
    >
      <MessagesSquare className="size-[18px]" />
      {unread > 0 && (
        <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-brand-500 px-1 text-[10px] font-bold tabular-nums text-white ring-2 ring-background">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}
