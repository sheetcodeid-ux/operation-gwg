import { scoreTone, TONE_HEX } from "@/components/ui/tone";

export interface HeatmapRow {
  label: string;
  values: number[]; // 0..100 aligned to columns
}

/** Performance heatmap — rows (areas/outlets) × metric columns, 0-100 colored. */
export function Heatmap({ columns, rows }: { columns: string[]; rows: HeatmapRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-1">
        <thead>
          <tr>
            <th className="w-36" />
            {columns.map((c) => (
              <th key={c} className="px-2 pb-1 text-center text-[11px] font-medium text-muted-foreground">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <td className="truncate pr-2 text-right text-xs text-foreground/80" title={row.label}>
                {row.label}
              </td>
              {row.values.map((v, i) => {
                const color = TONE_HEX[scoreTone(v)];
                return (
                  <td key={i} className="p-0">
                    <div
                      className="grid h-9 place-items-center rounded-md text-[11px] font-medium tabular-nums text-white/90 transition-transform hover:scale-[1.04]"
                      style={{ background: `${color}${alpha(v)}` }}
                      title={`${row.label} · ${columns[i]}: ${v.toFixed(0)}`}
                    >
                      {v.toFixed(0)}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Map a 0-100 value to a hex alpha suffix (more intense = higher). */
function alpha(v: number) {
  const a = Math.round(40 + (v / 100) * 200);
  return a.toString(16).padStart(2, "0");
}
