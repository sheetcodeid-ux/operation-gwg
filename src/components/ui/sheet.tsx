"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SheetContextValue {
  open: boolean;
  setOpen: (v: boolean) => void;
}
const SheetCtx = React.createContext<SheetContextValue | null>(null);

export function Sheet({
  children,
  open: controlledOpen,
  onOpenChange,
}: {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
}) {
  const [uncontrolled, setUncontrolled] = React.useState(false);
  const open = controlledOpen ?? uncontrolled;
  const setOpen = onOpenChange ?? setUncontrolled;
  return <SheetCtx.Provider value={{ open, setOpen }}>{children}</SheetCtx.Provider>;
}

function useSheet() {
  const ctx = React.useContext(SheetCtx);
  if (!ctx) throw new Error("Sheet components must be used within <Sheet>");
  return ctx;
}

export function SheetTrigger({ children }: { children: React.ReactElement }) {
  const { setOpen } = useSheet();
  return React.cloneElement(children as React.ReactElement<{ onClick?: () => void }>, {
    onClick: () => setOpen(true),
  });
}

export function SheetContent({
  children,
  className,
  title,
  description,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
  description?: string;
}) {
  const { open, setOpen } = useSheet();

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, setOpen]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="animate-overlay-in absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "animate-sheet-in surface-solid absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-border shadow-2xl",
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border p-5">
          <div>
            {title && <h2 className="text-base font-semibold text-foreground">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
          </div>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </div>
    </div>
  );
}

export function useSheetControl() {
  return useSheet();
}
