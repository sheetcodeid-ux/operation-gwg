import { Search } from "lucide-react";
import type { AppNotification, UserProfile } from "@/lib/types";
import type { NavItem } from "@/lib/nav";
import { ROLE_LABEL } from "@/lib/constants";
import { MobileNav } from "./mobile-nav";
import { NotificationCenter } from "./notifications";
import { UserMenu } from "./user-menu";
import { ThemeToggle } from "./theme-toggle";
import { Badge } from "@/components/ui/badge";

export function Topbar({
  user,
  notifications,
  navItems,
}: {
  user: UserProfile;
  notifications: AppNotification[];
  navItems: NavItem[];
}) {
  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-xl sm:px-6">
      <MobileNav items={navItems} />

      <div className="flex items-center gap-2">
        <span className="relative flex size-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
        </span>
        <span className="hidden text-xs text-muted-foreground sm:inline">Live</span>
      </div>

      <button
        type="button"
        data-command-trigger
        className="ml-1 hidden max-w-md flex-1 items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted/70 md:flex"
      >
        <Search className="size-4" />
        <span>Search outlets, tasks, complaints…</span>
        <kbd className="ml-auto rounded border border-border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground">
          ⌘K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-2">
        <Badge tone="brand" className="hidden sm:inline-flex">
          {ROLE_LABEL[user.role]}
        </Badge>
        <ThemeToggle />
        <NotificationCenter notifications={notifications} />
        <div className="mx-1 hidden h-6 w-px bg-border sm:block" />
        <UserMenu name={user.name} email={user.email} role={user.role} />
      </div>
    </header>
  );
}
