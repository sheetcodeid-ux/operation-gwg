"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessagesSquare } from "lucide-react";
import { chatThreadsAction, chatUnreadTotalAction } from "@/lib/actions/chat";
import type { ChatThread } from "@/lib/chat-shared";
import { Popover } from "@/components/ui/popover";
import { ThreadRow, useChatDock } from "./chat-dock";
import { cn } from "@/lib/utils";

/**
 * Pintu masuk Pesan di topbar: lencana belum dibaca + daftar percakapan.
 *
 * Diklik, ia membuka daftar percakapan — bukan langsung melompat ke halaman
 * Pesan. Memilih satu orang membuka jendela obrolan kecil di sudut layar,
 * sehingga membalas tidak berarti meninggalkan pekerjaan yang sedang berjalan.
 *
 * Hitungannya disegarkan berkala dan BERHENTI saat tab tidak terlihat — ini
 * ada di setiap halaman, jadi kalau dibiarkan jalan terus ia akan jadi
 * permintaan paling sering di seluruh aplikasi tanpa ada yang melihatnya.
 */
const POLL_MS = 30_000;

export function ChatBell() {
  const pathname = usePathname();
  const dock = useChatDock();
  const [unread, setUnread] = React.useState(0);
  const [threads, setThreads] = React.useState<ChatThread[] | null>(null);
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

  // Daftar percakapan diambil saat panelnya DIBUKA, bukan saat halaman dirender:
  // lonceng ini ada di setiap halaman, dan hampir semuanya tidak pernah diklik.
  const muat = React.useCallback(async () => {
    setThreads(await chatThreadsAction());
  }, []);

  return (
    <Popover
      contentClassName="w-[20rem] p-0 sm:w-[22rem]"
      trigger={({ open, toggle }) => (
        <button
          type="button"
          onClick={() => {
            if (!open) void muat();
            toggle();
          }}
          aria-label={unread > 0 ? `Pesan, ${unread} belum dibaca` : "Pesan"}
          title="Pesan"
          className={cn(
            "relative grid size-9 place-items-center rounded-lg transition-colors hover:bg-muted hover:text-foreground",
            onChat || open ? "text-foreground" : "text-muted-foreground",
          )}
        >
          <MessagesSquare className="size-[18px]" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-brand-500 px-1 text-[10px] font-bold tabular-nums text-white ring-2 ring-background">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </button>
      )}
    >
      {(close) => (
        <div className="flex flex-col">
          <div className="flex shrink-0 items-center justify-between px-3.5 py-2.5">
            <p className="text-sm font-semibold text-foreground">Pesan</p>
            <Link
              href="/pesan"
              onClick={close}
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Buka semua
            </Link>
          </div>

          <div className="max-h-[19rem] min-h-0 flex-1 overflow-y-auto border-y border-border">
            {threads === null ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">Memuat…</p>
            ) : threads.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                Belum ada percakapan. Mulai dari halaman Pesan.
              </p>
            ) : (
              threads.slice(0, 20).map((t) => (
                <ThreadRow
                  key={t.id}
                  t={t}
                  onPick={() => {
                    close();
                    dock.open({
                      id: t.id,
                      title: t.title,
                      subtitle: t.subtitle,
                      avatarUrl: t.kind === "dm" ? t.others[0]?.avatarUrl : null,
                    });
                  }}
                />
              ))
            )}
          </div>

          <Link
            href="/pesan"
            onClick={close}
            className="flex shrink-0 items-center justify-center gap-2 px-3.5 py-2.5 text-[13px] text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
          >
            <MessagesSquare className="size-3.5" /> Lihat semua di Pesan
          </Link>
        </div>
      )}
    </Popover>
  );
}
