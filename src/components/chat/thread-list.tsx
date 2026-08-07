"use client";

import * as React from "react";
import {
  Archive,
  ArrowLeft,
  ArchiveRestore,
  CheckCheck,
  ChevronRight,
  MessageSquarePlus,
  MoreVertical,
  Search,
  Star,
  Trash2,
  Users,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Popover } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { ReplyStatsButton } from "./reply-stats";
import { shortTime, type ChatThread } from "@/lib/chat-shared";

/**
 * Kolom kiri: cari, saring, dan daftar percakapan.
 *
 * Saringannya berupa chip yang bisa digeser ke samping — dengan lima kategori
 * plus jumlahnya, deretan yang dipaksa muat akan terpotong di layar sempit.
 */

export type ChatFilter = "semua" | "belum" | "favorit" | "grup";

const FILTERS: { key: ChatFilter; label: string }[] = [
  { key: "semua", label: "Semua" },
  { key: "belum", label: "Belum dibaca" },
  { key: "favorit", label: "Favorit" },
  { key: "grup", label: "Grup" },
];

export function ThreadList({
  threads,
  activeId,
  onSelect,
  onPrefetch,
  onNew,
  onHide,
  onMarkAllRead,
  onToggleFavorite,
  onToggleArchive,
  onExit,
  onOpenStats,
  className,
}: {
  threads: ChatThread[];
  activeId: string | null;
  onSelect: (id: string) => void;
  /** Siapkan isi percakapan sebelum diklik — lihat catatan di Messenger. */
  onPrefetch: (id: string) => void;
  onNew: () => void;
  onHide: (id: string) => void;
  onMarkAllRead: () => void;
  onToggleFavorite: (id: string, on: boolean) => void;
  onToggleArchive: (id: string, on: boolean) => void;
  /** Keluar dari Pesan. Di ponsel topbar disembunyikan, jadi ini satu-satunya
   *  jalan kembali ke halaman sebelumnya. */
  onExit: () => void;
  /** Buka ringkasan kecepatan balas + temuan yang menggantung. */
  onOpenStats: () => void;
  className?: string;
}) {
  const [q, setQ] = React.useState("");
  const [filter, setFilter] = React.useState<ChatFilter>("semua");
  const [showArchive, setShowArchive] = React.useState(false);

  const archived = threads.filter((t) => t.archived);
  const inbox = threads.filter((t) => !t.archived);
  const base = showArchive ? archived : inbox;

  const shown = React.useMemo(() => {
    const term = q.trim().toLowerCase();
    return base.filter((t) => {
      if (filter === "belum" && t.unread === 0) return false;
      if (filter === "favorit" && !t.favorite) return false;
      if (filter === "grup" && t.kind !== "group") return false;
      if (!term) return true;
      return (
        t.title.toLowerCase().includes(term) ||
        t.lastMessageText.toLowerCase().includes(term) ||
        t.others.some((p) => p.name.toLowerCase().includes(term))
      );
    });
  }, [base, q, filter]);

  const counts: Record<ChatFilter, number> = {
    semua: inbox.length,
    belum: inbox.filter((t) => t.unread > 0).length,
    favorit: inbox.filter((t) => t.favorite).length,
    grup: inbox.filter((t) => t.kind === "group").length,
  };
  const totalUnread = inbox.reduce((n, t) => n + t.unread, 0);

  return (
    <div className={cn("flex min-h-0 flex-col border-border bg-card", className)}>
      <div className="shrink-0 px-3 pt-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="flex min-w-0 items-center gap-1.5 text-base font-bold text-foreground">
            <button
              type="button"
              onClick={showArchive ? () => setShowArchive(false) : onExit}
              aria-label={showArchive ? "Kembali ke Pesan" : "Keluar dari Pesan"}
              className="-ml-1.5 grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted lg:hidden"
            >
              <ArrowLeft className="size-5" />
            </button>
            {showArchive ? "Diarsipkan" : "Pesan"}
            {!showArchive && totalUnread > 0 && (
              <span className="rounded-full bg-brand-500 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-white">
                {totalUnread > 99 ? "99+" : totalUnread}
              </span>
            )}
          </h2>
          <div className="flex items-center gap-1">
            {!showArchive && totalUnread > 0 && (
              <button
                type="button"
                onClick={onMarkAllRead}
                title="Tandai semua telah dibaca"
                aria-label="Tandai semua telah dibaca"
                className="grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted"
              >
                <CheckCheck className="size-[18px]" />
              </button>
            )}
            <ReplyStatsButton onClick={onOpenStats} />
            <Button size="sm" onClick={onNew} className="size-9 shrink-0 p-0" aria-label="Percakapan baru">
              <MessageSquarePlus className="size-[18px]" />
            </Button>
          </div>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari orang atau pesan…"
            className="h-10 w-full rounded-full border border-border bg-muted/40 pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-brand-500 focus:bg-background"
          />
        </div>
      </div>

      {/* Chip saringan — digeser ke samping kalau tidak muat. */}
      {!showArchive && (
        <div className="no-scrollbar shrink-0 overflow-x-auto px-3 py-2.5">
          <div className="flex w-max gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  filter === f.key
                    ? "border-brand-500 bg-brand-500/15 text-brand-700 dark:text-brand-300"
                    : "border-border text-muted-foreground hover:bg-muted",
                )}
              >
                {f.label}
                {counts[f.key] > 0 && f.key !== "semua" && (
                  <span className="tabular-nums opacity-70">{counts[f.key]}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {/* Baris arsip — pintu masuk, bukan kategori tersendiri di chip. */}
        {archived.length > 0 && (
          <button
            type="button"
            onClick={() => setShowArchive((v) => !v)}
            className="flex w-full items-center gap-3 border-b border-border/60 px-3 py-3 text-left transition-colors hover:bg-muted/50"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
              {showArchive ? <ChevronRight className="size-5 rotate-180" /> : <Archive className="size-5" />}
            </span>
            <span className="flex-1 text-sm font-medium text-foreground">
              {showArchive ? "Kembali ke Pesan" : "Diarsipkan"}
            </span>
            {!showArchive && (
              <span className="text-xs font-semibold tabular-nums text-muted-foreground">{archived.length}</span>
            )}
          </button>
        )}

        {shown.length === 0 ? (
          <p className="px-6 py-12 text-center text-xs leading-relaxed text-muted-foreground">
            {base.length === 0
              ? showArchive
                ? "Tidak ada percakapan yang diarsipkan."
                : "Belum ada percakapan. Tekan tombol tulis di kanan atas untuk mulai mengobrol."
              : "Tidak ada yang cocok dengan pencarian itu."}
          </p>
        ) : (
          shown.map((t) => (
            <ThreadRow
              key={t.id}
              t={t}
              active={t.id === activeId}
              onSelect={() => onSelect(t.id)}
              onPrefetch={() => onPrefetch(t.id)}
              onHide={() => onHide(t.id)}
              onToggleFavorite={() => onToggleFavorite(t.id, !t.favorite)}
              onToggleArchive={() => onToggleArchive(t.id, !t.archived)}
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
  onPrefetch,
  onHide,
  onToggleFavorite,
  onToggleArchive,
}: {
  t: ChatThread;
  active: boolean;
  onSelect: () => void;
  onPrefetch: () => void;
  onHide: () => void;
  onToggleFavorite: () => void;
  onToggleArchive: () => void;
}) {
  const solo = t.others[0];
  return (
    <div
      className={cn(
        "group relative flex w-full items-center gap-3 border-b border-border/60 pl-3 pr-1 transition-colors",
        active ? "bg-brand-500/10" : "hover:bg-muted/50",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        onPointerEnter={onPrefetch}
        onTouchStart={onPrefetch}
        className="flex min-w-0 flex-1 items-center gap-3 py-3 text-left"
      >
        {t.kind === "group" ? (
          <span className="grid size-12 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
            <Users className="size-6" />
          </span>
        ) : (
          <Avatar name={solo?.name ?? "?"} src={solo?.avatarUrl} size={48} />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="flex min-w-0 items-center gap-1.5 truncate text-[15px] font-medium text-foreground">
              <span className="truncate">{t.title}</span>
              {t.favorite && <Star className="size-3 shrink-0 fill-amber-400 text-amber-400" />}
            </p>
            <span
              className={cn(
                "shrink-0 text-[11px] tabular-nums",
                t.unread > 0 ? "font-semibold text-brand-600 dark:text-brand-400" : "text-muted-foreground",
              )}
            >
              {shortTime(t.lastMessageAt)}
            </span>
          </div>
          <div className="mt-0.5 flex items-center justify-between gap-2">
            <p className={cn("truncate text-[13px]", t.unread > 0 ? "text-foreground" : "text-muted-foreground")}>
              {t.lastSenderIsMe && t.lastMessageText ? "Anda: " : ""}
              {t.lastMessageText || <span className="italic">Belum ada pesan</span>}
            </p>
            {t.unread > 0 && (
              <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-brand-500 px-1.5 text-[11px] font-bold tabular-nums text-white">
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
            className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted"
            aria-label={`Opsi untuk ${t.title}`}
          >
            <MoreVertical className="size-4" />
          </button>
        )}
      >
        {(close) => (
          <div className="w-52 p-1">
            <MenuItem
              icon={Star}
              label={t.favorite ? "Hapus dari favorit" : "Tandai favorit"}
              onClick={() => {
                close();
                onToggleFavorite();
              }}
            />
            <MenuItem
              icon={t.archived ? ArchiveRestore : Archive}
              label={t.archived ? "Keluarkan dari arsip" : "Arsipkan"}
              onClick={() => {
                close();
                onToggleArchive();
              }}
            />
            <div className="my-1 h-px bg-border" />
            <MenuItem
              icon={Trash2}
              label="Hapus percakapan"
              danger
              onClick={() => {
                close();
                onHide();
              }}
            />
          </div>
        )}
      </Popover>
    </div>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors",
        danger ? "text-destructive hover:bg-destructive/10" : "text-foreground hover:bg-muted",
      )}
    >
      <Icon className="size-4 shrink-0" />
      {label}
    </button>
  );
}
