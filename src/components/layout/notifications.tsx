"use client";

import * as React from "react";
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
 * Satu baris = titik status, judul, pesan (maksimal dua baris), waktu relatif,
 * dan tombol ×. Tidak ada tombol centang: menandai sudah dibaca terjadi sendiri
 * saat notifikasinya dibuka.
 *
 * Daftarnya dipegang sebagai state LOKAL, bukan langsung dari prop server.
 * Sebelumnya menutup satu notifikasi memanggil `router.refresh()`, dan karena
 * aksinya merevalidasi seluruh layout, topbar ikut dipasang ulang — panelnya
 * tertutup sendiri di setiap klik. Efeknya terasa seperti tombolnya rusak,
 * padahal notifikasinya benar-benar terhapus.
 */
export function NotificationCenter({ notifications }: { notifications: AppNotification[] }) {
  const router = useRouter();
  const [items, setItems] = React.useState(notifications);

  // Data server berubah (pindah halaman, ada notifikasi baru) → samakan lagi.
  React.useEffect(() => {
    setItems(notifications);
  }, [notifications]);

  const unread = items.filter((n) => !n.read).length;

  function markAll() {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    void markAllNotificationsReadAction();
  }

  function open(n: AppNotification, close: () => void) {
    close();
    setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    void markNotificationReadAction(n.id);
    // Tujuan eksplisit lebih dulu; outlet hanya cadangan untuk notifikasi lama
    // yang dibuat sebelum ada kolom href.
    if (n.href) router.push(n.href);
    else if (n.outletId) router.push(`/outlets/${n.outletId}`);
  }

  function dismiss(e: React.MouseEvent, id: string) {
    // Tombolnya bersarang di dalam baris yang bisa diklik — tanpa ini, menutup
    // satu notifikasi malah ikut membuka halamannya.
    e.stopPropagation();
    setItems((prev) => prev.filter((n) => n.id !== id));
    void dismissNotificationAction(id);
  }

  return (
    <Popover
      contentClassName="w-[20rem] p-0 sm:w-[22rem]"
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
        <div className="flex flex-col">
          <div className="flex shrink-0 items-center justify-between px-3.5 py-2.5">
            <p className="text-sm font-semibold text-foreground">Notifikasi</p>
            {unread > 0 ? (
              <button onClick={markAll} className="text-xs text-muted-foreground transition-colors hover:text-foreground">
                Tandai semua dibaca
              </button>
            ) : (
              <span className="text-xs text-muted-foreground">Semua sudah dibaca</span>
            )}
          </div>

          {/* Tinggi dibatasi sekitar empat baris, seperti referensinya —
              panel yang memanjang sampai menutupi layar justru sulit dipakai. */}
          <div className="max-h-[19rem] min-h-0 flex-1 overflow-y-auto border-y border-border">
            {items.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">Belum ada notifikasi.</p>
            ) : (
              items.slice(0, 30).map((n) => (
                <div
                  key={n.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => open(n, close)}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && open(n, close)}
                  className={cn(
                    "flex w-full cursor-pointer items-start gap-2.5 border-b border-border/50 px-3.5 py-2.5 text-left transition-colors last:border-0 hover:bg-muted/50",
                    !n.read && "bg-muted/25",
                  )}
                >
                  <span
                    className={cn(
                      "mt-[7px] size-1.5 shrink-0 rounded-full",
                      n.read ? "bg-muted-foreground/30" : "bg-cyan-400",
                    )}
                  />

                  <div className="min-w-0 flex-1">
                    <p className={cn("truncate text-[13px] leading-tight", n.read ? "text-foreground/85" : "font-semibold text-foreground")}>
                      {n.title}
                    </p>
                    {/* Dipotong dua baris: pesan panjang membuat satu notifikasi
                        setinggi tiga baris dan daftarnya jadi tidak terbaca. */}
                    <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-muted-foreground">{n.message}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground/70">{fromNow(n.createdAt)}</p>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => dismiss(e, n.id)}
                    aria-label="Singkirkan notifikasi"
                    className="-mr-1 mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <X className="size-3.5" />
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
            className="flex shrink-0 items-center justify-center gap-2 px-3.5 py-2.5 text-[13px] text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
          >
            <Settings className="size-3.5" /> Pengaturan Notifikasi
          </button>
        </div>
      )}
    </Popover>
  );
}
