/** Date-range helpers shared by the picker (client) and the dashboard (server). */

export const RANGE_NOW = new Date("2026-06-23T00:00:00");
const MS = 86_400_000;

export function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
export function addDays(d: Date, n: number) {
  const x = startOfDay(d);
  x.setDate(x.getDate() + n);
  return x;
}
export function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}
export function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
export function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}
export function fmt(d: Date) {
  return d.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" });
}
export function isoOf(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function parseIso(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
export function diffDays(a: Date, b: Date) {
  return Math.round((+startOfDay(b) - +startOfDay(a)) / MS) + 1;
}

export const PRESETS = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "7d", label: "Last 7 Days" },
  { key: "28d", label: "Last 28 Days" },
  { key: "30d", label: "Last 30 Days" },
  { key: "this_month", label: "This Month" },
  { key: "last_month", label: "Last Month" },
] as const;

export type RangeKey = (typeof PRESETS)[number]["key"] | "custom";

export function presetRange(key: string): { from: Date; to: Date } {
  const now = RANGE_NOW;
  switch (key) {
    case "today":
      return { from: now, to: now };
    case "yesterday": {
      const y = addDays(now, -1);
      return { from: y, to: y };
    }
    case "7d":
      return { from: addDays(now, -6), to: now };
    case "28d":
      return { from: addDays(now, -27), to: now };
    case "30d":
      return { from: addDays(now, -29), to: now };
    case "last_month": {
      const lm = addMonths(now, -1);
      return { from: startOfMonth(lm), to: endOfMonth(lm) };
    }
    case "this_month":
    default:
      return { from: startOfMonth(now), to: endOfMonth(now) };
  }
}

export function presetLabel(key?: string): string {
  return PRESETS.find((p) => p.key === key)?.label ?? "Custom";
}

/** Resolve URL params into a window for reportPeriodCompare + a display label. */
export function resolveRange(params: { range?: string; from?: string; to?: string }) {
  let from: Date;
  let to: Date;
  let label: string;

  if (params.from && params.to) {
    from = parseIso(params.from);
    to = parseIso(params.to);
    label = params.range && params.range !== "custom" ? presetLabel(params.range) : "Custom";
  } else {
    const key = params.range || "this_month";
    ({ from, to } = presetRange(key));
    label = presetLabel(key);
  }

  const days = Math.max(1, diffDays(from, to));
  // window end = end of the "to" day
  const endMs = +startOfDay(to) + MS;
  return { from, to, fromIso: isoOf(from), toIso: isoOf(to), days, endMs, label };
}
