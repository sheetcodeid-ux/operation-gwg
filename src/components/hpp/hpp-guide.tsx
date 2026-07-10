"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, BookOpen, Calculator, CheckCircle2, ChevronDown, ClipboardCheck, Package, Send, Table2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type GuideStats = {
  ingredients: number;
  ingredientAlerts: number;
  menus: number;
  draft: number;
  submitted: number;
  verified: number;
  rejected: number;
  overCost: number;
};

const STORAGE_KEY = "hpp_guide_collapsed";

/** Data-driven onboarding: workflow steps + live status & contextual next-steps
 *  that recompute from the team's real HPP data on every load. */
export function HppGuide({ stats, canVerify }: { stats: GuideStats; canVerify: boolean }) {
  const [open, setOpen] = React.useState(true);

  React.useEffect(() => {
    if (typeof window !== "undefined" && window.localStorage.getItem(STORAGE_KEY) === "1") setOpen(false);
  }, []);

  const toggle = () => {
    setOpen((v) => {
      const next = !v;
      if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, next ? "0" : "1");
      return next;
    });
  };

  // Contextual "what to do next" — derived live from the data.
  const todos: { tone: "info" | "warn" | "bad" | "good"; text: React.ReactNode }[] = [];
  if (stats.ingredients === 0)
    todos.push({ tone: "info", text: <>Mulai dengan mengisi <Link href="/rnd/hpp/bahan" className="font-medium underline underline-offset-2">Master Bahan Baku</Link>.</> });
  if (stats.ingredientAlerts > 0)
    todos.push({ tone: "warn", text: <><b>{stats.ingredientAlerts} bahan</b> naik &gt;5% — cek <Link href="/rnd/hpp/bahan" className="font-medium underline underline-offset-2">Master Bahan Baku</Link> lalu hitung ulang menu terkait.</> });
  if (stats.overCost > 0)
    todos.push({ tone: "bad", text: <><b>{stats.overCost} menu</b> over cost (&gt;70%) — evaluasi harga / biaya bahan di <Link href="/rnd/hpp/rekap" className="font-medium underline underline-offset-2">Database HPP</Link>.</> });
  if (stats.rejected > 0)
    todos.push({ tone: "warn", text: <><b>{stats.rejected} menu</b> ditolak F&B — perbaiki lalu ajukan ulang.</> });
  if (canVerify && stats.submitted > 0)
    todos.push({ tone: "info", text: <><b>{stats.submitted} menu</b> menunggu verifikasi kamu — buka <Link href="/rnd/hpp/rekap" className="font-medium underline underline-offset-2">Database HPP</Link>.</> });
  if (!canVerify && stats.submitted > 0)
    todos.push({ tone: "info", text: <><b>{stats.submitted} menu</b> sedang menunggu verifikasi tim F&B.</> });
  if (todos.length === 0)
    todos.push({ tone: "good", text: <>Semua terkendali — tidak ada yang perlu ditindaklanjuti saat ini.</> });

  const steps = [
    { icon: Package, title: "1. Master Bahan Baku", desc: "Isi harga tertinggi bahan per wilayah. Jadi sumber harga untuk semua menu.", href: "/rnd/hpp/bahan" },
    { icon: Calculator, title: "2. Hitung di Kalkulator", desc: "Pilih bahan dari master, isi takaran, waste & biaya tetap. HPP + saran harga muncul otomatis.", href: "/rnd/hpp" },
    { icon: Send, title: "3. Ajukan ke F&B", desc: "Simpan menu, lalu klik Ajukan di Database HPP (status Draft → Diajukan).", href: "/rnd/hpp/rekap" },
    { icon: ClipboardCheck, title: "4. Verifikasi F&B", desc: "Tim F&B memverifikasi atau menolak. Kamu dapat notifikasi hasilnya di lonceng.", href: "/rnd/hpp/rekap" },
  ];

  return (
    <div className="glass rounded-2xl border border-border p-5">
      <button type="button" onClick={toggle} className="flex w-full items-center gap-2 text-left">
        <BookOpen className="size-4 text-primary" />
        <span className="text-sm font-semibold text-foreground">Panduan Sistem HPP</span>
        <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">menyesuaikan otomatis</span>
        <ChevronDown className={cn("ml-auto size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="mt-4 space-y-4">
          {/* Workflow steps */}
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((s) => (
              <Link key={s.title} href={s.href} className="group rounded-xl border border-border bg-muted/20 p-3 transition-colors hover:border-primary/40">
                <s.icon className="size-4 text-muted-foreground group-hover:text-primary" />
                <p className="mt-1.5 text-[13px] font-semibold text-foreground">{s.title}</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{s.desc}</p>
              </Link>
            ))}
          </div>

          {/* Live team status */}
          <div>
            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Status tim saat ini</p>
            <div className="flex flex-wrap gap-1.5">
              <Chip label="Bahan baku" value={stats.ingredients} />
              <Chip label="Total menu" value={stats.menus} />
              <Chip label="Draft" value={stats.draft} />
              <Chip label="Diajukan" value={stats.submitted} tone={stats.submitted ? "info" : undefined} />
              <Chip label="Diverifikasi" value={stats.verified} tone={stats.verified ? "good" : undefined} />
              <Chip label="Ditolak" value={stats.rejected} tone={stats.rejected ? "warn" : undefined} />
              <Chip label="Over cost" value={stats.overCost} tone={stats.overCost ? "bad" : undefined} />
              <Chip label="Bahan naik >5%" value={stats.ingredientAlerts} tone={stats.ingredientAlerts ? "warn" : undefined} />
            </div>
          </div>

          {/* Contextual next steps */}
          <div>
            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Langkah berikutnya</p>
            <ul className="space-y-1.5">
              {todos.map((t, i) => (
                <li key={i} className="flex items-start gap-2 text-[13px] text-foreground">
                  {t.tone === "good" ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                  ) : t.tone === "bad" ? (
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-500" />
                  ) : t.tone === "warn" ? (
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
                  ) : (
                    <Table2 className="mt-0.5 size-4 shrink-0 text-blue-500" />
                  )}
                  <span>{t.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function Chip({ label, value, tone }: { label: string; value: number; tone?: "info" | "warn" | "bad" | "good" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        !tone && "border-border bg-muted/40 text-muted-foreground",
        tone === "info" && "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400",
        tone === "good" && "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
        tone === "warn" && "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
        tone === "bad" && "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400",
      )}
    >
      {label} <b className="tabular-nums">{value}</b>
    </span>
  );
}
