"use client";

import { Bell, CircleAlert, CalendarClock, ListTodo, MessageSquareWarning, TrendingDown } from "lucide-react";
import type { AppNotification, NotificationKind } from "@/lib/types";
import { Popover } from "@/components/ui/popover";
import { fromNow } from "@/lib/utils";
import { cn } from "@/lib/utils";

const KIND_ICON: Record<NotificationKind, typeof Bell> = {
  task_overdue: ListTodo,
  complaint_overdue: MessageSquareWarning,
  hygiene_overdue: CircleAlert,
  event_deadline: CalendarClock,
  score_drop: TrendingDown,
};

const SEVERITY_DOT: Record<AppNotification["severity"], string> = {
  info: "bg-cyan-400",
  warning: "bg-amber-400",
  critical: "bg-red-400",
};

export function NotificationCenter({ notifications }: { notifications: AppNotification[] }) {
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <Popover
      contentClassName="w-[22rem] p-0"
      trigger={({ toggle }) => (
        <button
          onClick={toggle}
          className="relative grid size-9 place-items-center rounded-lg text-foreground/80 transition-colors hover:bg-muted/50 hover:text-foreground"
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
      <div className="flex items-center justify-between px-3 py-2.5">
        <p className="text-sm font-semibold text-foreground">Notifications</p>
        <span className="text-xs text-muted-foreground">{unread} unread</span>
      </div>
      <div className="h-px bg-muted" />
      <div className="max-h-96 overflow-y-auto p-1.5">
        {notifications.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">You&apos;re all caught up.</p>
        ) : (
          notifications.slice(0, 12).map((n) => {
            const Icon = KIND_ICON[n.kind];
            return (
              <div
                key={n.id}
                className={cn(
                  "flex gap-3 rounded-lg p-2.5 transition-colors hover:bg-muted/50",
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
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{fromNow(n.createdAt)}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </Popover>
  );
}
