export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-2 border-t border-border px-4 py-4 sm:px-6 lg:px-8">
      <div className="flex flex-col items-center justify-between gap-2 text-xs text-muted-foreground sm:flex-row">
        <p className="flex items-center gap-2">
          <span>© {year}</span>
          <span className="text-muted-foreground/40">·</span>
          <span className="font-mono">v1.0.0</span>
        </p>
        <p className="flex items-center gap-1.5">
          <span>by</span>
          <span className="shine-badge inline-flex items-center rounded-md border border-border bg-gradient-to-b from-foreground/15 to-transparent px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-foreground shadow-sm">
            Fikri
          </span>
        </p>
      </div>
    </footer>
  );
}
