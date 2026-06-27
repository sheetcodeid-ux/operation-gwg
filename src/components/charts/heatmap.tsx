export interface HeatmapRow {
  label: string;
  values: number[];
}

// GitHub-style contribution scale (empty → strong).
const LEVELS = ["#1f2937", "#0e4429", "#006d32", "#26a641", "#39d353"];

function level(v: number) {
  if (v <= 0) return 0;
  if (v >= 88) return 4;
  if (v >= 78) return 3;
  if (v >= 68) return 2;
  return 1;
}

/** GitHub-style heatmap: rows (areas) × time columns, intensity squares that fill the width. */
export function Heatmap({ rows, colLabels }: { rows: HeatmapRow[]; colLabels: string[] }) {
  const cols = rows[0]?.values.length ?? 0;
  return (
    <div>
      <div className="space-y-1.5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center gap-3">
            <span className="w-24 shrink-0 truncate text-right text-xs text-foreground/80" title={row.label}>
              {row.label}
            </span>
            <div className="grid flex-1 gap-1" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
              {row.values.map((v, i) => (
                <div
                  key={i}
                  className="aspect-square rounded-[3px] ring-1 ring-inset ring-white/5 transition-transform hover:scale-125"
                  style={{ background: LEVELS[level(v)] }}
                  title={`${row.label} · ${colLabels[i] ?? ""}: ${v.toFixed(0)}`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-end gap-1.5 text-[11px] text-muted-foreground">
        <span>Less</span>
        {LEVELS.map((c) => (
          <span key={c} className="size-3 rounded-[3px] ring-1 ring-inset ring-white/5" style={{ background: c }} />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}
