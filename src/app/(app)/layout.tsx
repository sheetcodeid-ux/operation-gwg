import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { areaName, listNotifications, visibleOutlets } from "@/lib/data/store";
import { can } from "@/lib/rbac";
import { NAV_ITEMS } from "@/lib/nav";
import { I18nProvider } from "@/lib/i18n/provider";
import type { Lang } from "@/lib/i18n/dict";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Footer } from "@/components/layout/footer";
import { SidebarProvider } from "@/components/layout/sidebar-context";
import { CommandPalette } from "@/components/command/command-palette";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const lang = ((await cookies()).get("gwg_lang")?.value as Lang) || "en";

  // Role-aware navigation
  const navItems = NAV_ITEMS.filter((item) => !item.permission || can(user, item.permission));
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
        <div className="min-h-dvh">
          <Topbar user={user} notifications={notifications} navItems={navItems} />
          <div className="flex">
            <Sidebar items={navItems} />
            <div className="min-w-0 flex-1">
              <main className="px-4 py-6 sm:px-6 lg:px-8">
                <Breadcrumbs />
                {children}
              </main>
              <Footer />
            </div>
          </div>
          <CommandPalette
            navItems={navItems.map((n) => ({ label: n.label, href: n.href, icon: n.icon, section: n.section }))}
            outlets={outletItems}
          />
        </div>
      </SidebarProvider>
    </I18nProvider>
  );
}
