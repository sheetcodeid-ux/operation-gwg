import Link from "next/link";
import { Search } from "lucide-react";
import { BrandLogo } from "./brand-logo";
import type { AppNotification, UserProfile } from "@/lib/types";
import type { MenuKey, NavItem } from "@/lib/nav";
import { MobileNav } from "./mobile-nav";
import { TopbarBrand } from "./topbar-brand";
import { NotificationCenter } from "./notifications";
import { UserMenu } from "./user-menu";
import { ThemeToggle } from "./theme-toggle";
import { LanguageToggle } from "./language-toggle";

export function Topbar({
  user,
  notifications,
  navItems,
  allowedKeys,
  homeDivision,
  isAdmin,
  grants,
  department = "",
}: {
  user: UserProfile;
  notifications: AppNotification[];
  navItems: NavItem[];
  allowedKeys: MenuKey[];
  homeDivision: string;
  isAdmin: boolean;
  grants: string[];
  department?: string;
}) {
  return (
    <header className="no-print sticky top-0 z-50 flex h-16 items-center border-b border-border bg-background/80 backdrop-blur-xl">
      {/* Left: desktop brand column (aligns with sidebar) */}
      <TopbarBrand />

      {/* Mobile brand */}
      <div className="flex items-center gap-2 px-4 lg:hidden">
        <MobileNav items={navItems} allowedKeys={allowedKeys} homeDivision={homeDivision} isAdmin={isAdmin} grants={grants} department={department} />
        <Link href="/dashboard" className="flex items-center gap-2">
          <BrandLogo />
          <span className="hidden text-sm font-semibold text-foreground sm:inline">Operational System</span>
        </Link>
      </div>

      {/* Controls */}
      <div className="ml-auto flex items-center gap-2 px-4 sm:px-6">
        <button
          type="button"
          data-command-trigger
          className="hidden h-9 w-56 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm text-muted-foreground transition-colors hover:bg-muted md:flex lg:w-72"
        >
          <Search className="size-4" />
          <span>Search...</span>
          <kbd className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">Ctrl+K</kbd>
        </button>
        <button
          type="button"
          data-command-trigger
          aria-label="Search"
          className="grid size-9 place-items-center rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground md:hidden"
        >
          <Search className="size-[18px]" />
        </button>

        <LanguageToggle />
        <ThemeToggle />
        <NotificationCenter notifications={notifications} />
        <UserMenu name={user.name} email={user.email} role={user.role} avatarUrl={user.avatarUrl} />
      </div>
    </header>
  );
}
