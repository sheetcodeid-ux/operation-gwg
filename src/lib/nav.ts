import type { Permission } from "./rbac";

export interface NavItem {
  label: string;
  href: string;
  icon: string; // lucide icon name
  /** Permission required to see this item; undefined = always visible. */
  permission?: Permission;
  /** Section grouping in the sidebar. */
  section: "Overview" | "Operations" | "Quality" | "Insights" | "Admin";
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: "LayoutDashboard", section: "Overview" },
  { label: "Analytics", href: "/analytics", icon: "ChartSpline", section: "Overview", permission: "view_reports" },

  { label: "Work Tracker", href: "/work-tracker", icon: "ListChecks", section: "Operations" },
  { label: "Event Tracker", href: "/events", icon: "CalendarRange", section: "Operations" },

  { label: "Hospitality", href: "/hospitality", icon: "ConciergeBell", section: "Quality" },
  { label: "Hygiene", href: "/hygiene", icon: "SprayCan", section: "Quality" },
  { label: "Complaints", href: "/complaints", icon: "MessageSquareWarning", section: "Quality" },

  { label: "Outlets", href: "/outlets", icon: "Store", section: "Insights" },
  { label: "Reports", href: "/reports", icon: "FileText", section: "Insights", permission: "view_reports" },

  { label: "User Management", href: "/admin/users", icon: "Users", section: "Admin", permission: "manage_users" },
  { label: "Organization", href: "/admin/organization", icon: "Network", section: "Admin", permission: "manage_org" },
  { label: "Audit Logs", href: "/admin/audit", icon: "ScrollText", section: "Admin", permission: "view_audit_logs" },
];

export const NAV_SECTIONS = ["Overview", "Operations", "Quality", "Insights", "Admin"] as const;
