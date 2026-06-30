import { EVENT_MILESTONES } from "@/lib/constants";
import type { OpsEvent } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Planning → Preparation → Execution → Evaluation stepper. Client-safe (no data deps). */
export function MilestoneStepper({ current }: { current: OpsEvent["milestone"] }) {
  const idx = EVENT_MILESTONES.findIndex((m) => m.value === current);
  return (
    <div className="flex items-center">
      {EVENT_MILESTONES.map((m, i) => {
        const done = i < idx;
        const active = i === idx;
        return (
          <div key={m.value} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "grid size-6 place-items-center rounded-full text-[10px] font-semibold ring-1 transition-colors",
                  done && "bg-primary text-primary-foreground ring-border",
                  active && "bg-blue-500/20 text-blue-600 ring-blue-400/50 dark:text-blue-300",
                  !done && !active && "bg-muted/50 text-muted-foreground ring-border",
                )}
              >
                {i + 1}
              </div>
              <span className={cn("text-[10px]", active ? "text-blue-600 dark:text-blue-300" : done ? "text-foreground/80" : "text-muted-foreground")}>
                {m.label}
              </span>
            </div>
            {i < EVENT_MILESTONES.length - 1 && (
              <div className={cn("mx-1 h-0.5 flex-1 rounded-full", i < idx ? "bg-primary/50" : "bg-muted")} />
            )}
          </div>
        );
      })}
    </div>
  );
}
