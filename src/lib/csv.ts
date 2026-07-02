/** Build an Excel-friendly CSV string (UTF-8; caller prepends BOM when saving).
 *  Quotes every field, escapes embedded quotes, CRLF line endings. */
export function toCsv(headers: string[], rows: (string | number | boolean | null | undefined)[][]): string {
  const cell = (v: string | number | boolean | null | undefined) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const line = (vals: (string | number | boolean | null | undefined)[]) => vals.map(cell).join(",");
  return [line(headers), ...rows.map(line)].join("\r\n");
}

/** Trigger a client-side download of a CSV file (adds the UTF-8 BOM so Excel
 *  renders accents/emoji correctly). */
export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
