"use client";

import * as React from "react";
import { FileText, GraduationCap, ImageIcon, Loader2, Palette, Search, UserPlus } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { chatPickableRequestsAction } from "@/lib/actions/chat";
import { cn } from "@/lib/utils";
import { shortTime, type PickableRequest } from "@/lib/chat-shared";
import type { HcRequestKind } from "@/lib/hc-request";

/**
 * Menu lampiran — satu tombol "+" membuka petak ikon, seperti aplikasi chat
 * yang sudah dikenal orang.
 *
 * Lima pilihan: Foto, Dokumen, dan tiga jenis pengajuan. Menekan salah satu
 * jenis pengajuan membuka daftar pengajuan MILIK PENGGUNA untuk dipilih dan
 * diteruskan — bukan mengetik ulang judulnya.
 */

interface Choice {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Warna latar ikon — tiap jenis punya warnanya sendiri agar cepat dikenali. */
  tint: string;
}

const REQUEST_CHOICES: (Choice & { kind: HcRequestKind })[] = [
  { key: "design", kind: "design", label: "Pengajuan Design", icon: Palette, tint: "bg-pink-500/15 text-pink-600 dark:text-pink-400" },
  { key: "pelatihan", kind: "pelatihan", label: "Pengajuan Pelatihan", icon: GraduationCap, tint: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  { key: "rekrutmen", kind: "rekrutmen", label: "Permintaan Karyawan", icon: UserPlus, tint: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400" },
];

export function AttachMenu({
  open,
  onOpenChange,
  onPickFiles,
  onPickRequest,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onPickFiles: (accept: string) => void;
  onPickRequest: (r: PickableRequest) => void;
}) {
  const [picking, setPicking] = React.useState<HcRequestKind | null>(null);

  return (
    <>
      {/* Petak pilihan naik dari bawah layar — bentuk yang sudah dikenal orang
          dari aplikasi sehari-hari, dan tumpuan ikonnya di jangkauan ibu jari. */}
      <BottomSheet open={open} onOpenChange={onOpenChange} title="Lampirkan">
        <div className="grid grid-cols-3 gap-1 px-4 pb-6 pt-1 sm:grid-cols-4">
          <Tile
            icon={ImageIcon}
            label="Foto"
            tint="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
            onClick={() => {
              onOpenChange(false);
              onPickFiles("image/*");
            }}
          />
          <Tile
            icon={FileText}
            label="Dokumen"
            tint="bg-brand-500/15 text-brand-600 dark:text-brand-400"
            onClick={() => {
              onOpenChange(false);
              onPickFiles("");
            }}
          />
          {REQUEST_CHOICES.map((c) => (
            <Tile
              key={c.key}
              icon={c.icon}
              label={c.label}
              tint={c.tint}
              onClick={() => {
                onOpenChange(false);
                setPicking(c.kind);
              }}
            />
          ))}
        </div>
      </BottomSheet>

      <RequestPicker
        kind={picking}
        onClose={() => setPicking(null)}
        onPick={(r) => {
          setPicking(null);
          onPickRequest(r);
        }}
      />
    </>
  );
}

function Tile({
  icon: Icon,
  label,
  tint,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  tint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 rounded-xl px-1 py-2.5 text-center transition-colors hover:bg-muted/60"
    >
      <span className={cn("grid size-11 place-items-center rounded-2xl", tint)}>
        <Icon className="size-5" />
      </span>
      <span className="text-[10px] font-medium leading-tight text-foreground">{label}</span>
    </button>
  );
}

/** Daftar pengajuan satu jenis, untuk dipilih dan diteruskan. */
function RequestPicker({
  kind,
  onClose,
  onPick,
}: {
  kind: HcRequestKind | null;
  onClose: () => void;
  onPick: (r: PickableRequest) => void;
}) {
  const [rows, setRows] = React.useState<PickableRequest[] | null>(null);
  const [q, setQ] = React.useState("");

  React.useEffect(() => {
    if (!kind) return;
    setRows(null);
    setQ("");
    let alive = true;
    void chatPickableRequestsAction(kind).then((list) => {
      if (alive) setRows(list);
    });
    return () => {
      alive = false;
    };
  }, [kind]);

  const shown = React.useMemo(() => {
    const list = rows ?? [];
    const term = q.trim().toLowerCase();
    if (!term) return list;
    return list.filter((r) => `${r.title} ${r.requesterName} ${r.statusLabel}`.toLowerCase().includes(term));
  }, [rows, q]);

  const title = REQUEST_CHOICES.find((c) => c.kind === kind)?.label ?? "Pengajuan";

  return (
    <BottomSheet
      open={kind !== null}
      onOpenChange={(v) => !v && onClose()}
      title={title}
      description="Pilih yang ingin diteruskan ke obrolan."
    >
      <div className="flex max-h-[70dvh] flex-col px-5 pb-5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari judul atau pemohon…"
              className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-brand-500"
            />
          </div>

          <div className="-mx-1 mt-3 min-h-0 flex-1 overflow-y-auto px-1">
            {rows === null ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground">
                <Loader2 className="size-5 animate-spin" />
              </div>
            ) : shown.length === 0 ? (
              <p className="py-10 text-center text-xs text-muted-foreground">
                {rows.length === 0 ? "Belum ada pengajuan jenis ini." : "Tidak ada yang cocok."}
              </p>
            ) : (
              <div className="space-y-1">
                {shown.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => onPick(r)}
                    className="w-full rounded-xl border border-border p-3 text-left transition-colors hover:border-brand-500/40 hover:bg-brand-500/5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="line-clamp-2 text-sm font-medium text-foreground">{r.title}</p>
                      <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                        {shortTime(r.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {r.requesterName} · <span className="font-medium text-foreground">{r.statusLabel}</span>
                    </p>
                  </button>
                ))}
              </div>
            )}
        </div>
      </div>
    </BottomSheet>
  );
}

