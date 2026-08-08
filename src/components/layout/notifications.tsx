"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, Settings, X } from "lucide-react";
import type { AppNotification } from "@/lib/types";
import { Popover } from "@/components/ui/popover";
import {
  dismissNotificationAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/lib/actions/notifications";
import { fromNow } from "@/lib/utils";
import { cn } from "@/lib/utils";

/**
 * Pusat notifikasi.
 *
 * Satu baris = satu titik status, judul, pesan, waktu relatif, dan tombol ×.
 * Tidak ada tombol centang: menandai sudah dibaca terjadi sendiri saat
 * notifikasinya dibuka, jadi tombol terpisah hanya menambah pilihan tanpa
 * menambah kemampuan.
 *
 * Menekan barisnya membuka halaman tujuannya. Notifikasi yang tidak membawa
 * tujuan praktis tidak bisa ditindaklanjuti — orangnya masih harus mencari
 * sendiri hal yang dimaksud — jadi hampir semua pengirim mengisi `href`.
 */

const SEVERITY_DOT: Record<AppNotification["severity"], string> = {
  info: "bg-cyan-400",
  warning: "bg-amber-400",
  critical: "bg-red-400",
};

export function NotificationCenter({ notifications }: { notifications: AppNotification[] }) {
  const router = useRouter();
  const [, start] = useTransition();
  const unread = notifications.filter((n) => !n.read).length;

  function markAll() {
    start(async () => {
      await markAllNotificationsReadAction();
      router.refresh();
    });
  }

  function open(n: AppNotification, close: () => void) {
    close();
    start(async () => {
      await markNotificationReadAction(n.id);
      // Tujuan eksplisit lebih dulu; outlet hanya cadangan untuk notifikasi
      // lama yang dibuat sebelum ada kolom href.
      if (n.href) router.push(n.href);
      else if (n.outletId) router.push(`/outlets/${n.outletId}`);
      else router.refresh();
    });
  }

  function dismiss(e: React.MouseEvent, id: string) {
    // Jangan ikut membuka barisnya — tombolnya bersarang di dalam baris.
    e.stopPropagation();
    start(async () => {
      await dismissNotificationAction(id);
      router.refresh();
    });
  }

  return (
    <Popover
      contentClassName="w-[21rem] p-0 sm:w-[24rem]"
      trigger={({ toggle }) => (
        <button
          onClick={toggle}
          className="relative grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Notifikasi"
        >
          <Bell className="size-[18px]" />
          {unread > 0 && (
            <span className="absolute right-1.5 top-1.5 grid min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </button>
      )}
    >
      {(close) => (
        <div className="flex max-h-[75dvh] flex-col">
          <div className="flex shrink-0 items-center justify-between px-4 py-3">
            <p className="text-[15px] font-semibold text-foreground">Notifikasi</p>
            {unread > 0 ? (
              <button onClick={markAll} className="text-[13px] text-muted-foreground transition-colors hover:text-foreground">
                Tandai semua dibaca
              </button>
            ) : (
              <span className="text-[13px] text-muted-foreground">Semua sudah dibaca</span>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto border-y border-border">
            {notifications.length === 0 ? (
              <p className="px-4 py-12 text-center text-sm text-muted-foreground">Belum ada notifikasi.</p>
            ) : (
              notifications.slice(0, 30).map((n) => (
                <div
                  key={n.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => open(n, close)}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && open(n, close)}
                  className={cn(
                    "flex w-full cursor-pointer gap-3 border-b border-border/60 px-4 py-3 text-left transition-colors last:border-0 hover:bg-muted/50",
                    !n.read && "bg-muted/30",
                  )}
                >
                  {/* Titik status — penanda paling ringkas untuk "sudah dibaca
                      atau belum" tanpa memakan ruang baris. */}
                  <span
                    className={cn(
                      "mt-1.5 size-2 shrink-0 rounded-full",
                      n.read ? "bg-muted-foreground/30" : SEVERITY_DOT[n.severity],
                    )}
                  />

                  <div className="min-w-0 flex-1">
                    <p className={cn("text-[14px] leading-snug", n.read ? "text-foreground/80" : "font-semibold text-foreground")}>
                      {n.title}
                    </p>
                    <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{n.message}</p>
                    <p className="mt-1 text-[12px] text-muted-foreground/70">
                      {fromNow(n.createdAt)}
                      {n.actorName && ` · ${n.actorName}`}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => dismiss(e, n.id)}
                    aria-label="Singkirkan notifikasi"
                    className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ))
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              close();
              router.push("/profile");
            }}
            className="flex shrink-0 items-center justify-center gap-2 px-4 py-3 text-[14px] text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
          >
            <Settings className="size-4" /> Pengaturan Notifikasi
          </button>
        </div>
      )}
    </Popover>
  );
}
