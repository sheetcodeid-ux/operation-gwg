import { TONE_HEX, scoreTone } from "@/components/ui/tone";
import { cn } from "@/lib/utils";

/** 270° radial gauge with target marker — hero performance index. */
export function Gauge({
  value,
  target,
  size = 180,
  label,
  className,
}: {
  value: number;
  target?: number;
  size?: number;
  label?: string;
  className?: string;
}) {
  const v = Math.max(0, Math.min(100, value));
  const stroke = size * 0.09;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const startAngle = 135; // sweep 270°
  const sweep = 270;
  const circumference = 2 * Math.PI * r;
  const arcLen = (sweep / 360) * circumference;
  const color = TONE_HEX[scoreTone(v)];

  const polar = (angleDeg: number) => {
    const a = (angleDeg * Math.PI) / 180;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  };
  const targetAngle = target != null ? startAngle + (Math.max(0, Math.min(100, target)) / 100) * sweep : null;
  const tMark = targetAngle != null ? polar(targetAngle) : null;

  return (
    <div className={cn("relative inline-flex flex-col items-center", className)} style={{ width: size }}>
      <svg width={size} height={size} className="overflow-visible">
        <g transform={`rotate(${startAngle} ${cx} ${cy})`}>
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="color-mix(in oklch, var(--foreground) 10%, transparent)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${arcLen} ${circumference}`}
          />
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${(v / 100) * arcLen} ${circumference}`}
            style={{ transition: "stroke-dasharray 0.7s ease" }}
          />
        </g>
        {tMark && (
          <circle cx={tMark.x} cy={tMark.y} r={stroke * 0.42} fill="var(--background)" stroke={color} strokeWidth={2} />
        )}
      </svg>
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center">
        <p className="text-3xl font-semibold tabular-nums text-foreground">{v.toFixed(1)}</p>
        {label && <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>}
        {target != null && <p className="mt-0.5 text-[11px] text-muted-foreground">Target {target}</p>}
      </div>
    </div>
  );
}
