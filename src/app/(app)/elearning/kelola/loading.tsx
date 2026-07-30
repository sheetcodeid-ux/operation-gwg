export default function Loading() {
  return (
    <div className="w-full animate-pulse space-y-4">
      <div className="h-8 w-64 rounded bg-muted/40" />
      <div className="h-9 w-72 rounded-lg bg-muted/40" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-xl border border-border bg-muted/30" />
        ))}
      </div>
      <div className="h-56 rounded-xl border border-border bg-muted/30" />
    </div>
  );
}
