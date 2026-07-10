import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { areaName, listNotifications, visibleOutlets } from "@/lib/data/store";
import { accessibleMenuKeys, homeDivision, navAll, setNavExtras } from "@/lib/nav";
import { getNavExtra } from "@/lib/data/nav";
import { I18nProvider } from "@/lib/i18n/provider";
import type { Lang } from "@/lib/i18n/dict";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Footer } from "@/components/layout/footer";
import { SidebarProvider } from "@/components/layout/sidebar-context";
import { NavLockProvider } from "@/components/layout/nav-lock";
import { ScrollReset } from "@/components/layout/scroll-reset";
import { CommandPalette } from "@/components/command/command-palette";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  // Cookie present (proxy let us through) but signature/user invalid — clear it.
  if (!user) redirect("/clear-session");

  const lang = ((await cookies()).get("gwg_lang")?.value as Lang) || "en";

  // Merge admin-defined sidebar divisions before building the nav. Empty ⇒
  // identical to the built-in sidebar.
  setNavExtras(await getNavExtra());

  // Everyone sees the FULL sidebar (all divisions, like admin); access is
  // enforced per-item — divisions that aren't the user's own render locked.
  const navItems = navAll();
  const allowedKeys = accessibleMenuKeys(user.role);
  const home = homeDivision(user.role);
  const isAdmin = user.role === "super_admin";
  const grants = user.grants ?? [];
  const department = user.department ?? "";
  const allowed = new Set(allowedKeys);
  const grantSet = new Set(grants);
  const canOpen = (n: (typeof navItems)[number]) =>
    isAdmin || (n.section === home && allowed.has(n.key)) || n.section === department || grantSet.has(`${n.section}:${n.key}`);
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
        <NavLockProvider>
          <ScrollReset />
          <div className="min-h-dvh">
            <Topbar user={user} notifications={notifications} navItems={navItems} allowedKeys={allowedKeys} homeDivision={home} isAdmin={isAdmin} grants={grants} department={department} />
            <div className="flex">
              <Sidebar items={navItems} allowedKeys={allowedKeys} homeDivision={home} isAdmin={isAdmin} grants={grants} department={department} />
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
              navItems={[...new Map(navItems.filter(canOpen).map((n) => [n.href, n])).values()].map((n) => ({
                label: n.label,
                href: n.href,
                icon: n.icon,
                section: n.section,
              }))}
              outlets={outletItems}
            />
          </div>
        </NavLockProvider>
      </SidebarProvider>
    </I18nProvider>
  );
}
