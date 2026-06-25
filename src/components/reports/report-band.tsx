import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { PrintButton } from "./print-button";

/** Landak-style colored report header band. */
export function ReportBand({
  eyebrow,
  title,
  meta,
}: {
  eyebrow: string;
  title: string;
  meta: { label: string; value: string }[];
}) {
  return (
    <>
      <Link
        href="/reports"
        className="no-print mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-3.5" /> Reports
      </Link>
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1c2230] to-[#0f1219] p-6 text-white shadow-lg">
        <div className="pointer-events-none absolute -right-10 -top-10 size-48 rounded-full bg-white/10 blur-3xl" />
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70">{eyebrow}</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h1>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5">
              {meta.map((m) => (
                <div key={m.label}>
                  <p className="text-[10px] uppercase tracking-wide text-white/60">{m.label}</p>
                  <p className="text-sm font-medium text-white">{m.value}</p>
                </div>
              ))}
            </div>
          </div>
          <PrintButton className="no-print border-white/25 bg-white/10 text-white hover:bg-white/20" />
        </div>
      </div>
    </>
  );
}
