/**
 * Generic "current vs previous period" data for the dashboard-style combo chart
 * (gray bars = previous, blue line = current). Counts dated records per day
 * (monthly view) and per month (yearly view). Client-safe — pass a `nowMs`
 * anchor (use DEMO_NOW so it matches the rest of the app).
 */

export interface DayComparePoint {
  label: string; // day-of-month "1".."31"
  current: number;
  previous: number; // same day-of-month, previous month
  weekend: boolean;
}
export interface MonthComparePoint {
  label: string; // "Jan".."Dec"
  current: number;
  previous: number; // preceding month (rolling)
}
export interface CompareData {
  year: number;
  defaultMonth: number; // 0-11
  months: { month: number; label: string; days: DayComparePoint[] }[];
  yearly: MonthComparePoint[];
}

export function buildCompareData(dateISOs: string[], nowMs: number): CompareData {
  const created = dateISOs.map((d) => +new Date(d)).filter((t) => !Number.isNaN(t));
  const countIn = (start: number, end: number) => created.filter((t) => t >= start && t < end).length;

  const year = new Date(nowMs).getUTCFullYear();
  const defaultMonth = new Date(nowMs).getUTCMonth();

  const dayCount = (y: number, m: number, d: number) => countIn(Date.UTC(y, m, d), Date.UTC(y, m, d + 1));
  const monthCount = (y: number, m: number) => countIn(Date.UTC(y, m, 1), Date.UTC(y, m + 1, 1));

  const months = Array.from({ length: 12 }, (_, m) => {
    const daysInMonth = new Date(Date.UTC(year, m + 1, 0)).getUTCDate();
    const prevY = m === 0 ? year - 1 : year;
    const prevM = m === 0 ? 11 : m - 1;
    const prevDays = new Date(Date.UTC(prevY, prevM + 1, 0)).getUTCDate();
    const days: DayComparePoint[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dow = new Date(Date.UTC(year, m, d)).getUTCDay();
      days.push({
        label: String(d),
        current: dayCount(year, m, d),
        previous: d <= prevDays ? dayCount(prevY, prevM, d) : 0,
        weekend: dow === 0 || dow === 6,
      });
    }
    return { month: m, label: new Date(Date.UTC(year, m, 1)).toLocaleDateString("en-US", { month: "long", timeZone: "UTC" }), days };
  });

  const yearly: MonthComparePoint[] = Array.from({ length: 12 }, (_, m) => {
    const prevY = m === 0 ? year - 1 : year;
    const prevM = m === 0 ? 11 : m - 1;
    return {
      label: new Date(Date.UTC(year, m, 1)).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }),
      current: monthCount(year, m),
      previous: monthCount(prevY, prevM),
    };
  });

  return { year, defaultMonth, months, yearly };
}
