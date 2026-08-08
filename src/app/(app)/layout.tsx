import { cookies } from "next/headers";
import { requireSessionUser } from "@/lib/auth";
import { areaName, listNotifications, visibleOutlets } from "@/lib/data/store";
import { accessibleMenuKeys, canReachMenu, homeDivision, navAll, navOpenPredicate, setNavExtras } from "@/lib/nav";
import { isSystemSupport } from "@/lib/system-shared";
import { getNavExtra } from "@/lib/data/nav";
import { assessmentMenuOpen } from "@/lib/data/assessment-menu";
import { I18nProvider } from "@/lib/i18n/provider";
import type { Lang } from "@/lib/i18n/dict";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { MainShell } from "@/components/layout/main-shell";
import { ChromeSlot } from "@/components/layout/chrome-slot";
import { SidebarProvider } from "@/components/layout/sidebar-context";
import { NavLockProvider } from "@/components/layout/nav-lock";
import { ScrollReset } from "@/components/layout/scroll-reset";
import { CommandPalette } from "@/components/command/command-palette";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Cookie present (proxy let us through) but signature/user invalid — dibersihkan
  // lalu diarahkan ke login. Halaman di dalamnya memakai penjaga yang sama,
  // karena layout dan halaman dirender bersamaan: redirect di sini saja tidak
  // menghentikan halaman yang sudah jalan.
  const user = await requireSessionUser();

  const lang = ((await cookies()).get("gwg_lang")?.value as Lang) || "en";

  // Merge admin-defined sidebar divisions before building the nav. Empty ⇒
  // identical to the built-in sidebar.
  setNavExtras(await getNavExtra());

  // Everyone sees the FULL sidebar (all divisions, like admin); access is
  // enforced per-item — divisions that aren't the user's own render locked.
  const navItems = navAll();
  // Assessment bukan menu tetap: ia hanya terbuka selama periodenya berjalan dan
  // hanya untuk orang yang benar-benar ikut. Tanpa penyaringan ini setiap akun
  // `member` selalu memegang menu itu — dan karena menu itu ada di divisi Human
  // Capital, orang Creative melihat divisi HC ikut terbuka di sidebar-nya.
  const assessmentOpen = await assessmentMenuOpen(user);
  const allowedKeys = accessibleMenuKeys(user.role).filter((k) => k !== "assessment" || assessmentOpen);
  const home = homeDivision(user.role);
  const isAdmin = user.role === "super_admin";
  // "Antrian System" is gated by job title, not the grant system — unlock it for
  // the System Support team (Operational + jabatan System Support) by injecting
  // its grant so the sidebar/command palette show it for them only.
  const grants = isSystemSupport(user) && !isAdmin ? [...(user.grants ?? []), "Operation:sys_review"] : user.grants ?? [];
  const department = user.department ?? "";
  const canOpen = navOpenPredicate({ homeDivision: home, allowedKeys, department, grants, isAdmin });
  const notifications = await listNotifications(user);
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
          {/* h-dvh + overflow-hidden: halaman layar-penuh (Pesan) mengatur
              gulirannya sendiri di dalam panel. Halaman biasa tetap menggulir
              seperti sebelumnya lewat pembungkus overflow-y-auto di bawah. */}
          <div className="flex h-dvh flex-col overflow-hidden">
            {/* Di ponsel, Pesan mengambil alih seluruh layar — topbar disembunyikan
                supaya tidak ada dua baris kepala bertumpuk. */}
            <ChromeSlot>
              <Topbar user={user} notifications={notifications} navItems={navItems} allowedKeys={allowedKeys} homeDivision={home} isAdmin={isAdmin} grants={grants} department={department} />
            </ChromeSlot>
            <div className="flex min-h-0 flex-1">
              <Sidebar items={navItems} allowedKeys={allowedKeys} homeDivision={home} isAdmin={isAdmin} grants={grants} department={department} />
              {/* overflow-x-clip: no child may widen the page — wide content must
                  scroll inside its own overflow-x-auto wrapper (tables, kanban). */}
              <div data-scroll-root className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-clip overflow-y-auto">
                <MainShell showHome={canReachMenu(user, "dashboard")}>{children}</MainShell>
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
