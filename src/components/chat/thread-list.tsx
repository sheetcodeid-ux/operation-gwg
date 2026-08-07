"use client";

import * as React from "react";
import { CheckCheck, MessageSquarePlus, MoreVertical, Search, Trash2, Users } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Popover } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { shortTime, type ChatThread } from "@/lib/chat-shared";

/**
 * Kolom kiri: cari, daftar percakapan, dan tombol mulai obrolan baru.
 *
 * Pencarian mencocokkan nama percakapan MAUPUN nama pesertanya, karena grup
 * sering dicari lewat orang di dalamnya, bukan judulnya.
 */
export function ThreadList({
  threads,
  activeId,
  onSelect,
  onNew,
  onHide,
  onMarkAllRead,
  className,
}: {
  threads: ChatThread[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onHide: (id: string) => void;
  onMarkAllRead: () => void;
  className?: string;
}) {
  const [q, setQ] = React.useState("");

  const shown = React.useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return threads;
    return threads.filter(
      (t) =>
        t.title.toLowerCase().includes(term) ||
        t.lastMessageText.toLowerCase().includes(term) ||
        t.others.some((p) => p.name.toLowerCase().includes(term)),
    );
  }, [threads, q]);

  const totalUnread = threads.reduce((n, t) => n + t.unread, 0);

  return (
    <div className={cn("flex min-h-0 flex-col border-border bg-card", className)}>
      <div className="shrink-0 border-b border-border p-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            Pesan
            {totalUnread > 0 && (
              <span className="rounded-full bg-brand-500 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-white">
                {totalUnread > 99 ? "99+" : totalUnread}
              </span>
            )}
          </h2>
          <div className="flex items-center gap-1">
            {totalUnread > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onMarkAllRead}
                className="h-8 gap-1.5 px-2 text-xs text-muted-foreground"
                title="Tandai semua telah dibaca"
              >
                <CheckCheck className="size-4" />
                <span className="hidden xl:inline">Tandai dibaca</span>
              </Button>
            )}
            <Button size="sm" onClick={onNew} className="h-8 gap-1.5 px-2.5">
              <MessageSquarePlus className="size-4" />
              <span className="hidden sm:inline">Baru</span>
            </Button>
          </div>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari orang atau pesan…"
            className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-brand-500"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {shown.length === 0 ? (
          <p className="px-4 py-10 text-center text-xs text-muted-foreground">
            {threads.length === 0
              ? "Belum ada percakapan. Tekan “Baru” untuk mulai mengobrol."
              : "Tidak ada yang cocok dengan pencarian itu."}
          </p>
        ) : (
          shown.map((t) => (
            <ThreadRow
              key={t.id}
              t={t}
              active={t.id === activeId}
              onSelect={() => onSelect(t.id)}
              onHide={() => onHide(t.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function ThreadRow({
  t,
  active,
  onSelect,
  onHide,
}: {
  t: ChatThread;
  active: boolean;
  onSelect: () => void;
  onHide: () => void;
}) {
  const solo = t.others[0];
  return (
    <div
      className={cn(
        "group relative flex w-full items-center gap-3 border-b border-border/60 px-3 py-2.5 text-left transition-colors",
        active ? "bg-brand-500/10" : "hover:bg-muted/50",
      )}
    >
      <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        {t.kind === "group" ? (
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground ring-1 ring-border">
            <Users className="size-5" />
          </span>
        ) : (
          <Avatar name={solo?.name ?? "?"} src={solo?.avatarUrl} size={40} />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className={cn("truncate text-sm", t.unread > 0 ? "font-semibold text-foreground" : "font-medium text-foreground")}>
              {t.title}
            </p>
            <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">{shortTime(t.lastMessageAt)}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className={cn("truncate text-xs", t.unread > 0 ? "text-foreground" : "text-muted-foreground")}>
              {t.lastSenderIsMe && t.lastMessageText ? "Anda: " : ""}
              {t.lastMessageText || <span className="italic text-muted-foreground">Belum ada pesan</span>}
            </p>
            {t.unread > 0 && (
              <span className="grid h-4 min-w-4 shrink-0 place-items-center rounded-full bg-brand-500 px-1 text-[10px] font-bold tabular-nums text-white">
                {t.unread > 99 ? "99+" : t.unread}
              </span>
            )}
          </div>
        </div>
      </button>

      <Popover
        align="end"
        portal
        trigger={({ toggle }) => (
          <button
            type="button"
            onClick={toggle}
            className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted"
            aria-label="Opsi percakapan"
          >
            <MoreVertical className="size-4" />
          </button>
        )}
      >
        {(close) => (
          <div className="w-56 p-1">
            <button
              type="button"
              onClick={() => {
                close();
                onHide();
              }}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="size-4" /> Hapus percakapan
            </button>
            <p className="px-2.5 py-1.5 text-[10px] leading-relaxed text-muted-foreground">
              Hanya hilang dari daftar Anda. Lawan bicara tetap punya riwayatnya, dan percakapan muncul lagi kalau ada
              pesan baru.
            </p>
          </div>
        )}
      </Popover>
    </div>
  );
}
