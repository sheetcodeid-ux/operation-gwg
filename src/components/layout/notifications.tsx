"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, CircleAlert, CalendarClock, ClipboardCheck, FileCheck2, GraduationCap, ListTodo, MessageSquareWarning, MonitorCog, TrendingDown } from "lucide-react";
import type { AppNotification, NotificationKind } from "@/lib/types";
import { Popover } from "@/components/ui/popover";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/lib/actions/notifications";
import { fromNow } from "@/lib/utils";
import { cn } from "@/lib/utils";

const KIND_ICON: Record<NotificationKind, typeof Bell> = {
  task_overdue: ListTodo,
  complaint_overdue: MessageSquareWarning,
  hygiene_overdue: CircleAlert,
  event_deadline: CalendarClock,
  score_drop: TrendingDown,
  hpp_review: ClipboardCheck,
  hc_done: FileCheck2,
  sys_update: MonitorCog,
  elearning: GraduationCap,
};

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
      if (n.outletId) router.push(`/outlets/${n.outletId}`);
      else router.refresh();
    });
  }

  return (
    <Popover
      contentClassName="w-[22rem] p-0"
      trigger={({ toggle }) => (
        <button
          onClick={toggle}
          className="relative grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Notifications"
        >
          <Bell className="size-[18px]" />
          {unread > 0 && (
            <span className="absolute right-1.5 top-1.5 grid min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
              {unread}
            </span>
          )}
        </button>
      )}
    >
      {(close) => (
        <>
          <div className="flex items-center justify-between px-3 py-2.5">
            <p className="text-sm font-semibold text-foreground">Notifications</p>
            {unread > 0 ? (
              <button onClick={markAll} className="text-xs text-primary hover:underline">
                Mark all read
              </button>
            ) : (
              <span className="text-xs text-muted-foreground">All caught up</span>
            )}
          </div>
          <div className="h-px bg-border" />
          <div className="max-h-96 overflow-y-auto p-1.5">
            {notifications.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">You&apos;re all caught up.</p>
            ) : (
              notifications.slice(0, 12).map((n) => {
                const Icon = KIND_ICON[n.kind];
                return (
                  <button
                    key={n.id}
                    onClick={() => open(n, close)}
                    className={cn(
                      "flex w-full gap-3 rounded-lg p-2.5 text-left transition-colors hover:bg-muted/60",
                      !n.read && "bg-muted/30",
                    )}
                  >
                    <div className="relative mt-0.5">
                      <div className="grid size-8 place-items-center rounded-lg bg-muted/50 ring-1 ring-border">
                        <Icon className="size-4 text-foreground/80" />
                      </div>
                      <span className={cn("absolute -right-0.5 -top-0.5 size-2 rounded-full", SEVERITY_DOT[n.severity])} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">{n.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{n.message}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground/80">{fromNow(n.createdAt)}</p>
                    </div>
                    {!n.read && <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" />}
                  </button>
                );
              })
            )}
          </div>
        </>
      )}
    </Popover>
  );
}
