"use client";

import { EVALUATORS, FLOW_STEPS, PARAMETERS } from "@/lib/assessment/config";
import { Banner, Card, SectionLabel } from "./parts";

/** Overview / guide tab — how the assessment works end to end. */
export function PanduanTab() {
  return (
    <div className="space-y-4">
      <Banner tone="info" icon="ℹ">
        <strong>Sistem Penilaian Kenaikan Golongan</strong> menilai kelayakan karyawan naik golongan secara transparan
        melalui 3 penilai resmi, self assessment, dan interview akhir. Skor minimum <strong>85</strong> untuk dinyatakan
        layak. Semua nilai dilengkapi bobot dan sumber data agar dapat dipertanggungjawabkan.
      </Banner>

      <SectionLabel>Bobot Penilai Resmi</SectionLabel>
      <div className="grid gap-3 sm:grid-cols-3">
        {EVALUATORS.map((e) => (
          <Card key={e.key}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Penilai {e.no}</span>
              <span className="text-2xl font-semibold tabular-nums text-foreground">{e.weight}%</span>
            </div>
            <p className="mt-1 text-sm font-semibold text-foreground">{e.name}</p>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{e.note}</p>
          </Card>
        ))}
      </div>

      <SectionLabel>Enam Parameter Penilaian</SectionLabel>
      <Card className="p-0">
        <div className="divide-y divide-border">
          {PARAMETERS.map((p) => (
            <div key={p.key} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{p.title}</p>
                <p className="truncate text-xs text-muted-foreground">Skala 1–{p.scale} · {p.source}</p>
              </div>
              <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold tabular-nums text-foreground ring-1 ring-border">
                {p.weight}%
              </span>
            </div>
          ))}
        </div>
      </Card>

      <SectionLabel>Alur 7 Langkah</SectionLabel>
      <div className="space-y-2">
        {FLOW_STEPS.map((s) => (
          <div key={s.no} className="flex items-start gap-3 rounded-xl border border-border bg-muted/20 p-3">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-foreground text-xs font-semibold text-background">
              {s.no}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{s.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{s.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <SectionLabel>Rumus Skor</SectionLabel>
      <Card>
        <p className="text-sm text-muted-foreground">Skor tiap penilai (0–100):</p>
        <pre className="mt-2 overflow-x-auto rounded-lg bg-muted/50 p-3 text-xs leading-relaxed text-foreground">
{`Skor = (KPI÷3 ×100)×30%  +  (Attitude÷3 ×100)×20%
     + (Loyalitas÷4 ×100)×15%  +  (Skill÷5 ×100)×15%
     + (Kontribusi÷4 ×100)×10%  +  (MasaKerja÷5 ×100)×10%`}
        </pre>
        <p className="mt-3 text-sm text-muted-foreground">Skor final:</p>
        <pre className="mt-2 overflow-x-auto rounded-lg bg-muted/50 p-3 text-xs leading-relaxed text-foreground">
{`Final = Skor_Atasan ×40%  +  Skor_HC ×35%  +  Skor_Director ×25%`}
        </pre>
      </Card>
    </div>
  );
}
