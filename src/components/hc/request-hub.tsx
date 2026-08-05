import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

/** Warna aksen kartu kategori — satu tone per kategori, senada dengan Badge. */
export type HubTone = "brand" | "cyan" | "amber" | "violet" | "emerald";

const TILE: Record<HubTone, string> = {
  brand: "bg-brand-500/12 text-brand-600 ring-brand-500/20 dark:text-brand-400",
  cyan: "bg-cyan-500/12 text-cyan-600 ring-cyan-500/20 dark:text-cyan-400",
  amber: "bg-amber-500/12 text-amber-600 ring-amber-500/20 dark:text-amber-400",
  violet: "bg-violet-500/12 text-violet-600 ring-violet-500/20 dark:text-violet-400",
  emerald: "bg-emerald-500/12 text-emerald-600 ring-emerald-500/20 dark:text-emerald-400",
};

export interface HubCategory {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
  tone: HubTone;
  /** Jumlah pengajuan yang masih berjalan pada kategori ini. */
  openCount?: number;
}

/** Banner pengantar halaman Pengajuan. */
export function HubBanner({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
  return (
    <div className="card-gradient relative overflow-hidden rounded-2xl p-5">
      {/* Sapuan warna lembut di sudut kanan — sekadar aksen, tidak menutupi teks. */}
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-brand-500/10 blur-3xl" />
      <div className="relative flex items-start gap-4">
        <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand-500/15 text-brand-600 ring-1 ring-brand-500/20 dark:text-brand-400">
          <Icon className="size-6" />
        </div>
        <div className="min-w-0">
          <p className="text-base font-semibold text-foreground">{title}</p>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
    </div>
  );
}

/** Daftar kategori pengajuan — satu ketuk menuju formulirnya. */
export function HubCategories({ items }: { items: HubCategory[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((c) => (
        <Link
          key={c.href}
          href={c.href}
          className="card-gradient group flex items-center gap-4 rounded-xl p-4 transition-colors hover:border-brand-500/40 hover:bg-muted/40"
        >
          <div className={cn("grid size-11 shrink-0 place-items-center rounded-xl ring-1", TILE[c.tone])}>
            <c.icon className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-semibold text-foreground">{c.title}</p>
              {!!c.openCount && <Badge tone="warning">{c.openCount} berjalan</Badge>}
            </div>
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{c.description}</p>
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
