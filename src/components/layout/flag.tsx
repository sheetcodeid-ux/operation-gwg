import { cn } from "@/lib/utils";

/** Tiny inline SVG flags (emoji flags don't render on Windows). */
export function Flag({ code, className }: { code: "en" | "id"; className?: string }) {
  if (code === "id") {
    return (
      <svg viewBox="0 0 20 14" className={cn("h-3.5 w-5 rounded-[2px] ring-1 ring-black/10", className)} aria-hidden>
        <rect width="20" height="7" fill="#e70011" />
        <rect y="7" width="20" height="7" fill="#fff" />
      </svg>
    );
  }
  // United States (simplified, recognizable)
  const stars = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 5; c++) {
      stars.push(<circle key={`${r}-${c}`} cx={1.1 + c * 1.7} cy={1 + r * 1.7} r={0.4} fill="#fff" />);
    }
  }
  return (
    <svg viewBox="0 0 20 14" className={cn("h-3.5 w-5 rounded-[2px] ring-1 ring-black/10", className)} aria-hidden>
      <rect width="20" height="14" fill="#fff" />
      {[0, 2, 4, 6, 8, 10, 12].map((y) => (
        <rect key={y} y={y * 1.077} width="20" height="1.077" fill="#b22234" />
      ))}
      <rect width="9" height="7.54" fill="#3c3b6e" />
      {stars}
    </svg>
  );
}
