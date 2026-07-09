"use client";

import * as React from "react";
import { Lock, X } from "lucide-react";

interface NavLockState {
  /** The division name the user tried to open but may not access, or null. */
  locked: string | null;
  showLocked: (division: string) => void;
  clear: () => void;
}

const Ctx = React.createContext<NavLockState | null>(null);

export function useNavLock(): NavLockState {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error("useNavLock must be used inside <NavLockProvider>");
  return ctx;
}

export function NavLockProvider({ children }: { children: React.ReactNode }) {
  const [locked, setLocked] = React.useState<string | null>(null);
  const showLocked = React.useCallback((division: string) => setLocked(division), []);
  const clear = React.useCallback(() => setLocked(null), []);

  // Escape closes the overlay.
  React.useEffect(() => {
    if (!locked) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLocked(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [locked]);

  return (
    <Ctx.Provider value={{ locked, showLocked, clear }}>
      {children}
      {locked && <LockedOverlay division={locked} onClose={clear} />}
    </Ctx.Provider>
  );
}

/** Full-screen frosted-glass block with a professional "no access" notice. */
function LockedOverlay({ division, onClose }: { division: string; onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-background/40 backdrop-blur-md" />
      <div
        className="surface-solid relative z-10 w-full max-w-sm rounded-2xl border border-border p-6 text-center shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup"
          className="absolute right-3 top-3 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" />
        </button>
        <div className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-amber-500/10 ring-1 ring-amber-500/30">
          <Lock className="size-6 text-amber-500" />
        </div>
        <p className="text-base font-semibold text-foreground">Akses Dibatasi</p>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          Anda tidak dapat membuka divisi <span className="font-medium text-foreground">{division}</span>. Menu ini hanya untuk
          anggota divisi tersebut. Hubungi admin bila Anda memerlukan akses.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-5 inline-flex h-10 w-full items-center justify-center rounded-lg bg-foreground px-4 text-sm font-medium text-background transition-opacity hover:opacity-90"
        >
          Mengerti
        </button>
      </div>
    </div>
  );
}
