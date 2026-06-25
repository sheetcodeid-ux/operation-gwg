"use client";

import * as React from "react";
import { Cloud, CloudSun, Sparkles, Sun } from "lucide-react";

function greeting(h: number) {
  if (h < 11) return "Good morning";
  if (h < 15) return "Good afternoon";
  if (h < 19) return "Good evening";
  return "Wrapping up the day";
}

/** Deterministic pseudo-weather (no external API) — stable per day. */
function weatherFor(date: Date) {
  const day = date.getDate();
  const sets = [
    { temp: 31, label: "Partly cloudy", Icon: CloudSun, tint: "text-amber-400" },
    { temp: 29, label: "Cloudy", Icon: Cloud, tint: "text-slate-300" },
    { temp: 33, label: "Sunny", Icon: Sun, tint: "text-amber-400" },
    { temp: 30, label: "Light clouds", Icon: CloudSun, tint: "text-amber-400" },
  ];
  return sets[day % sets.length];
}

export function HeroCard({ name }: { name: string }) {
  const [now, setNow] = React.useState<Date | null>(null);
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const h = now?.getHours() ?? 9;
  const time = now ? now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }) : "—";
  const [hm, ampm] = time.split(" ");
  const date = now ? now.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "";
  const w = weatherFor(now ?? new Date());
  const WeatherIcon = w.Icon;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-card via-card to-blue-950/40 p-6">
      {/* blue glow behind the weather (Aniq-ui style) */}
      <div className="pointer-events-none absolute -right-10 -top-16 size-72 rounded-full bg-blue-500/30 blur-[90px]" />
      <div className="pointer-events-none absolute right-24 top-0 size-40 rounded-full bg-sky-400/20 blur-[80px]" />
      <div className="relative flex flex-col justify-between gap-6 sm:flex-row sm:items-start sm:justify-between">
        {/* Greeting + clock */}
        <div className="flex flex-col">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            {greeting(h)}, {name.split(" ")[0]}
          </h2>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Sparkles className="size-3.5 text-primary" /> Ready to make today productive! 🚀
          </p>
          <div className="mt-6 flex items-baseline gap-1">
            {/* key on hm so it re-animates each minute */}
            <span key={hm} className="text-4xl font-semibold tabular-nums text-foreground" style={{ animation: "clock-pop 0.45s ease" }}>
              {hm}
            </span>
            <span className="text-base font-medium text-muted-foreground">{ampm}</span>
          </div>
        </div>

        {/* Weather */}
        <div className="text-left sm:text-right">
          <div className="flex items-center gap-2 sm:justify-end">
            <WeatherIcon className={`size-9 ${w.tint}`} />
            <span className="text-3xl font-semibold tabular-nums text-foreground">{w.temp}°C</span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{w.label}</p>
          <p className="text-sm font-medium text-foreground/80">Pontianak</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{date}</p>
        </div>
      </div>
    </div>
  );
}
