export default function Loading() {
  return (
    <div className="w-full animate-pulse">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <div className="size-10 rounded-xl shimmer" />
        <div className="space-y-2">
          <div className="h-5 w-48 rounded-md shimmer" />
          <div className="h-3 w-64 rounded-md shimmer" />
        </div>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="glass flex items-center gap-3 rounded-xl p-3.5">
            <div className="size-10 rounded-xl shimmer" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-16 rounded shimmer" />
              <div className="h-3 w-20 rounded shimmer" />
            </div>
          </div>
        ))}
      </div>

      {/* Content cards */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="glass h-72 rounded-2xl lg:col-span-2" />
        <div className="glass h-72 rounded-2xl" />
      </div>
      <div className="glass mt-4 h-64 rounded-2xl" />
    </div>
  );
}
