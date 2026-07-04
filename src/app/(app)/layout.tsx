import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { areaName, listNotifications, visibleOutlets } from "@/lib/data/store";
import { navFor } from "@/lib/nav";
import { I18nProvider } from "@/lib/i18n/provider";
import type { Lang } from "@/lib/i18n/dict";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Footer } from "@/components/layout/footer";
import { SidebarProvider } from "@/components/layout/sidebar-context";
import { ScrollReset } from "@/components/layout/scroll-reset";
import { CommandPalette } from "@/components/command/command-palette";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  // Cookie present (proxy let us through) but signature/user invalid — clear it.
  if (!user) redirect("/clear-session");

  const lang = ((await cookies()).get("gwg_lang")?.value as Lang) || "en";

  // Role-aware navigation: only the menus this role's division exposes.
  const navItems = navFor(user.role);
  const notifications = listNotifications(user);
  const outletItems = visibleOutlets(user).map((o) => ({
    id: o.id,
    name: o.name,
    code: o.code,
    areaName: areaName(o.areaId),
  }));

  return (
    <I18nProvider initialLang={lang}>
      <SidebarProvider>
        <ScrollReset />
        <div className="min-h-dvh">
          <Topbar user={user} notifications={notifications} navItems={navItems} />
          <div className="flex">
            <Sidebar items={navItems} />
            {/* overflow-x-clip: no child may widen the page — wide content must
                scroll inside its own overflow-x-auto wrapper (tables, kanban). */}
            <div className="min-w-0 flex-1 overflow-x-clip">
              <main className="px-4 py-6 sm:px-6 lg:px-8">
                <Breadcrumbs />
                {children}
              </main>
              <Footer />
            </div>
          </div>
          <CommandPalette
            navItems={[...new Map(navItems.map((n) => [n.href, n])).values()].map((n) => ({
              label: n.label,
              href: n.href,
              icon: n.icon,
              section: n.section,
            }))}
            outlets={outletItems}
          />
        </div>
      </SidebarProvider>
    </I18nProvider>
  );
}
