"use client";

import * as React from "react";
import { Gauge, Loader2, TriangleAlert } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { chatReplyStatsAction } from "@/lib/actions/chat";
import { hygienePendingFollowupsAction } from "@/lib/actions/hygiene-followup";
import { cn } from "@/lib/utils";
import type { HygieneFollowup } from "@/lib/chat-shared";

interface Stat {
  userId: string;
  name: string;
  avgMinutes: number;
  slowestMinutes: number;
  replies: number;
  fastPct: number;
}

/**
 * Ringkasan kecepatan balas + temuan hygiene yang masih menggantung.
 *
 * Dua hal yang sama-sama menjawab "apa yang tersendat": siapa yang lambat
 * membalas, dan perbaikan mana yang belum ditutup. Keduanya disatukan di sini
 * supaya tidak perlu dua tempat untuk pertanyaan yang sama.
 */
export function ReplyStatsSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [stats, setStats] = React.useState<Stat[] | null>(null);
  const [pending, setPending] = React.useState<HygieneFollowup[] | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setStats(null);
    setPending(null);
    let alive = true;
    void Promise.all([chatReplyStatsAction(), hygienePendingFollowupsAction()]).then(([s, p]) => {
      if (!alive) return;
      setStats(s);
      setPending(p);
    });
    return () => {
      alive = false;
    };
  }, [open]);

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Ringkasan Respons"
      description="30 hari terakhir, dari percakapan yang Anda ikuti."
      className="sm:max-w-lg"
    >
      <div className="px-5 pb-6">
        {stats === null ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : (
          <>
            {pending && pending.length > 0 && (
              <div className="mb-5 rounded-xl border border-red-500/40 bg-red-500/5 p-3">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-red-700 dark:text-red-300">
                  <TriangleAlert className="size-4" />
                  {pending.length} temuan hygiene belum ditindaklanjuti
                </p>
                <ul className="mt-2 space-y-1">
                  {pending.slice(0, 5).map((f) => (
                    <li key={f.id} className="truncate text-[11px] text-muted-foreground">
                      {f.area || "Area"} · {f.outletName} — dari {f.raisedByName}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {stats.length === 0 ? (
              <p className="py-10 text-center text-xs leading-relaxed text-muted-foreground">
                Belum ada cukup percakapan untuk dihitung. Statistik muncul setelah ada balasan bolak-balik.
              </p>
            ) : (
              <>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Kecepatan Balas
                </p>
                <ul className="space-y-1.5">
                  {stats.map((s) => (
                    <li key={s.userId} className="flex items-center gap-3 rounded-xl border border-border p-2.5">
                      <Avatar name={s.name} size={36} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{s.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {s.replies} balasan · terlama {humanMinutes(s.slowestMinutes)}
                        </p>
                        {/* Batang: berapa persen balasannya di bawah satu jam. */}
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn("h-full rounded-full", barTone(s.fastPct))}
                            style={{ width: `${Math.max(s.fastPct, 3)}%` }}
                          />
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className={cn("text-sm font-bold tabular-nums", textTone(s.fastPct))}>{s.fastPct}%</p>
                        <p className="text-[10px] text-muted-foreground">rata² {humanMinutes(s.avgMinutes)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                  Persentase = balasan yang datang di bawah satu jam. Hanya pesan pertama setelah giliran orang lain
                  yang dihitung, dan jeda lebih dari 12 jam dibuang — kalau tidak, angkanya menceritakan jam kerja,
                  bukan kecepatan orangnya.
                </p>
              </>
            )}
          </>
        )}
      </div>
    </BottomSheet>
  );
}

/** Tombol pembuka di kepala daftar percakapan. */
export function ReplyStatsButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Ringkasan respons"
      aria-label="Ringkasan respons"
      className="grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted"
    >
      <Gauge className="size-[18px]" />
    </button>
  );
}

function humanMinutes(m: number): string {
  if (m < 1) return "<1 mnt";
  if (m < 60) return `${m} mnt`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} j ${rest} mnt` : `${h} jam`;
}

const barTone = (pct: number) =>
  pct >= 70 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-500" : "bg-red-500";
const textTone = (pct: number) =>
  pct >= 70
    ? "text-emerald-600 dark:text-emerald-400"
    : pct >= 40
      ? "text-amber-600 dark:text-amber-400"
      : "text-red-600 dark:text-red-400";
