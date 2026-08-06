import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface HubCategory {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
  /** Jumlah pengajuan yang masih berjalan pada kategori ini. */
  openCount?: number;
}

/** Daftar kategori pengajuan — satu baris penuh per kategori, satu ketuk menuju
 *  formulirnya. */
export function HubCategories({ items }: { items: HubCategory[] }) {
  return (
    <div className="glass overflow-hidden rounded-2xl border border-border">
      {items.map((c, i) => (
        <Link
          key={c.href}
          href={c.href}
          prefetch
          className={`group flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-muted/50 ${i > 0 ? "border-t border-border" : ""}`}
        >
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted ring-1 ring-border">
            <c.icon className="size-[18px] text-foreground/70" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium text-foreground">{c.title}</p>
              {!!c.openCount && <Badge tone="warning">{c.openCount} berjalan</Badge>}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">{c.description}</p>
          </div>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
        </Link>
      ))}
    </div>
  );
}

/** Judul kecil pemisah antar blok pada halaman Pengajuan. */
export function HubSectionTitle({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-3 mt-6 flex items-baseline justify-between gap-3">
      <h2 className="text-sm font-semibold text-foreground">{children}</h2>
      {hint && <span className="shrink-0 text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}
