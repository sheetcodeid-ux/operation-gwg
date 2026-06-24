import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { listNotifications } from "@/lib/data/store";
import { can } from "@/lib/rbac";
import { NAV_ITEMS } from "@/lib/nav";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  // Role-aware navigation
  const navItems = NAV_ITEMS.filter((item) => !item.permission || can(user, item.permission));
  const notifications = listNotifications(user);

  return (
    <div className="flex min-h-dvh">
      <Sidebar items={navItems} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar user={user} notifications={notifications} navItems={navItems} />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
