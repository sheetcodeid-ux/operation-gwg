"use client";

import { GRADE_TIERS, PARAMETERS } from "@/lib/assessment/config";
import { Card, SectionLabel, TierPill } from "./parts";

/** Reference tab — grade matrix + full rubric per parameter. */
export function ReferensiTab() {
  return (
    <div className="space-y-4">
      <SectionLabel>Matrix Kelayakan Kenaikan Golongan</SectionLabel>
      <Card className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-medium">Skor Final</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Tindak Lanjut Wajib</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {GRADE_TIERS.map((t) => (
                <tr key={t.tone}>
                  <td className="whitespace-nowrap px-4 py-3 font-semibold tabular-nums text-foreground">
                    {t.tone === "no" && "< 70"}
                    {t.tone === "wait" && "70 – 84"}
                    {t.tone === "ok" && "85 – 95"}
                    {t.tone === "fast" && "> 95"}
                  </td>
                  <td className="px-4 py-3">
                    <TierPill tone={t.tone}>{t.label}</TierPill>
                  </td>
                  <td className="px-4 py-3 text-xs leading-relaxed text-muted-foreground">{t.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <SectionLabel>Rubrik Lengkap per Parameter</SectionLabel>
      <div className="space-y-3">
        {PARAMETERS.map((p) => (
          <Card key={p.key} className="p-0">
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{p.title}</p>
                <p className="truncate text-xs text-muted-foreground">{p.source}</p>
              </div>
              <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-foreground ring-1 ring-border">
                Bobot {p.weight}%
              </span>
            </div>
            <div className="divide-y divide-border">
              {p.options.map((o) => (
                <div key={o.value} className="flex gap-3 px-4 py-2.5">
                  <span className="grid size-6 shrink-0 place-items-center rounded-md bg-muted text-xs font-semibold tabular-nums text-foreground ring-1 ring-border">
                    {o.value}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{o.head.replace(/^Nilai \d+ — /, "")}</p>
                    {o.body && <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{o.body}</p>}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
