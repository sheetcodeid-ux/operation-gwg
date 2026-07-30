export default function Loading() {
  return (
    <div className="w-full animate-pulse space-y-5">
      <div className="h-40 rounded-2xl border border-border bg-muted/40" />
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4">
            <div className="h-4 w-1/3 rounded bg-muted/50" />
            <div className="mt-3 space-y-2">
              <div className="h-12 rounded-lg bg-muted/30" />
              <div className="h-12 rounded-lg bg-muted/30" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
