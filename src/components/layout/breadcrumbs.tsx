"use client";

import { Fragment } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";

const LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  outlets: "Outlets",
  reports: "Reports",
  hospitality: "Hospitality",
  hygiene: "Hygiene",
  complaints: "Complaints",
  events: "Events",
  "work-tracker": "Work Tracker",
  kanban: "Kanban",
  calendar: "Calendar",
  profile: "Profile",
  admin: "Admin",
  users: "Users",
  departments: "Departemen & Divisi",
  audit: "Audit Logs",
  ca: "Coordinator",
  area: "Region",
  outlet: "Outlet",
};

function label(seg: string) {
  if (LABELS[seg]) return LABELS[seg];
  // ids like out_001 / usr_004 / area_001 → keep short
  if (/_\d+$/.test(seg) || seg.length > 14) return seg.replace(/_/g, " ");
  return seg.charAt(0).toUpperCase() + seg.slice(1);
}

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  const crumbs = segments.map((seg, i) => ({
    label: label(seg),
    href: "/" + segments.slice(0, i + 1).join("/"),
    last: i === segments.length - 1,
  }));

  return (
    <nav className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground" aria-label="Breadcrumb">
      <Link href="/dashboard" className="grid size-5 place-items-center rounded text-muted-foreground hover:text-foreground">
        <Home className="size-4" />
      </Link>
      {crumbs.map((c) => (
        <Fragment key={c.href}>
          <ChevronRight className="size-3.5 opacity-50" />
          {c.last ? (
            <span className="font-medium text-foreground">{c.label}</span>
          ) : (
            <Link href={c.href} className="hover:text-foreground">
              {c.label}
            </Link>
          )}
        </Fragment>
      ))}
    </nav>
  );
}
