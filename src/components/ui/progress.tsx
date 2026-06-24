import { cn } from "@/lib/utils";
import type { Tone } from "@/lib/constants";
import { TONE_HEX } from "./tone";

export function Progress({
  value,
  tone = "brand",
  className,
}: {
  value: number;
  tone?: Tone;
  className?: string;
}) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}>
      <div
        className="h-full rounded-full transition-[width] duration-500"
        style={{
          width: `${v}%`,
          background: `linear-gradient(90deg, ${TONE_HEX[tone]}99, ${TONE_HEX[tone]})`,
        }}
      />
    </div>
  );
}
