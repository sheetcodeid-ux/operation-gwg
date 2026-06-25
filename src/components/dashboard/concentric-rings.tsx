export interface Ring {
  label: string;
  value: number; // 0..100
  color: string;
}

/** Apple-activity-style concentric progress rings with a center headline. */
export function ConcentricRings({
  rings,
  size = 184,
  centerValue,
  centerLabel,
}: {
  rings: Ring[];
  size?: number;
  centerValue: number;
  centerLabel?: string;
}) {
  const stroke = size * 0.075;
  const gap = stroke * 0.55;
  const cx = size / 2;
  const cy = size / 2;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {rings.map((r, i) => {
          const radius = size / 2 - stroke / 2 - i * (stroke + gap);
          if (radius <= 0) return null;
          const c = 2 * Math.PI * radius;
          const v = Math.max(0, Math.min(100, r.value));
          return (
            <g key={r.label}>
              <circle cx={cx} cy={cy} r={radius} fill="none" stroke="color-mix(in oklch, var(--foreground) 8%, transparent)" strokeWidth={stroke} />
              <circle
                cx={cx}
                cy={cy}
                r={radius}
                fill="none"
                stroke={r.color}
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={`${(v / 100) * c} ${c}`}
                style={{ transition: "stroke-dasharray 0.7s ease" }}
              />
            </g>
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-semibold tabular-nums text-foreground">{centerValue.toFixed(0)}%</span>
        {centerLabel && <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{centerLabel}</span>}
      </div>
    </div>
  );
}
