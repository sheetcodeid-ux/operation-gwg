"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  EVALUATORS,
  IV_RECOMMENDATIONS,
  PARAMETERS,
  evaluatorFilled,
  evaluatorScore,
  fastTrackEligible,
  finalScore,
  gradeTier,
  interviewScore,
} from "@/lib/assessment/config";
import { departmentOptions } from "@/lib/assessment/org";
import {
  HASIL_META,
  HASIL_OPTIONS,
  MOCK_ASSESSMENTS,
  type AssessmentRecord,
  type HasilStatus,
} from "@/lib/assessment/records";
import { cn } from "@/lib/utils";
import { DataTable } from "@/components/ui/data-table";
import { Select } from "@/components/ui/input";
import { useAssessment } from "./context";
import { ReportButton } from "./report";
import { Banner, Card, ScoreRing, SectionLabel, TierPill } from "./parts";

/** Map a computed grade-tier tone to the dashboard's Hasil status. */
const TONE_TO_HASIL: Record<string, HasilStatus> = { no: "tidak_layak", wait: "ditunda", ok: "layak", fast: "fast_track" };

/** Tab ⑤: live result of the current assessment + table of all assessments. */
export function DashboardTab() {
  const a = useAssessment();
  const final = finalScore(a.scores);
  const tier = gradeTier(final);
  const ivScore = interviewScore(a.interview);
  const ivRek = IV_RECOMMENDATIONS.find((r) => r.value === a.ivRecommendation) ?? null;
  const fastTrack = fastTrackEligible(a.scores, a.financialImpact);
  const allFilled = EVALUATORS.every((e) => evaluatorFilled(a.scores[e.key]) === PARAMETERS.length);

  const overridden = a.ivRecommendation === "tidak_layak" && final >= 85;
  const decisionLabel = overridden ? "Tidak Direkomendasikan (Override Interview)" : tier.label;
  const decisionTone = overridden ? "no" : tier.tone;

  const evalScores = EVALUATORS.map((e) => evaluatorScore(a.scores[e.key]));
  const gap = allFilled ? Math.max(...evalScores) - Math.min(...evalScores) : 0;

  // The live assessment as a table row (prepended when a candidate is chosen).
  const liveRecord: AssessmentRecord | null = a.resolved.nama
    ? {
        id: "live",
        tanggal: new Date().toISOString().slice(0, 10),
        batch: a.candidate.batch || "—",
        nik: a.candidate.nik || "—",
        name: a.resolved.nama,
        departmentId: a.candidate.departmentId,
        departmentName: a.resolved.departemen,
        jabatan: a.resolved.jabatan,
        golongan: a.candidate.golongan || "—",
        golonganTujuan: a.candidate.golonganTujuan || "—",
        penilai: a.resolved.isHead ? "Director, HR" : "Atasan, HC, Director",
        status: allFilled ? "Menunggu Interview" : "Proses Penilaian",
        hasil: TONE_TO_HASIL[decisionTone],
        finalScore: final,
        interviewResult: ivRek?.label ?? "—",
        decision: decisionLabel,
      }
    : null;

  return (
    <div className="space-y-4">
      {!allFilled && (
        <Banner tone="amber" icon="⚠">
          Belum semua penilai mengisi lengkap. Ringkasan di bawah dihitung dari data yang sudah masuk dan akan berubah saat
          penilaian dilengkapi.
        </Banner>
      )}

      <SectionLabel>Hasil Assessment Berjalan</SectionLabel>
      <div className="grid gap-3 lg:grid-cols-[auto_1fr]">
        <Card className="flex flex-col items-center justify-center gap-3 text-center">
          <ScoreRing value={final} sub="Skor Final" />
          <TierPill tone={decisionTone}>{decisionLabel}</TierPill>
        </Card>

        <div className="grid gap-3 sm:grid-cols-3">
          {EVALUATORS.map((e, i) => (
            <Card key={e.key}>
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{e.name} · {e.weight}%</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{evalScores[i].toFixed(1)}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Kontribusi ke final: <span className="tabular-nums">{(evalScores[i] * (e.weight / 100)).toFixed(1)}</span>
              </p>
            </Card>
          ))}
          <Card className="sm:col-span-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">{a.resolved.nama || "Belum dipilih"}</p>
                <p className="text-xs text-muted-foreground">
                  {a.resolved.jabatan || "—"} · Golongan {a.candidate.golongan || "—"} → {a.candidate.golonganTujuan || "—"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Skor Interview</p>
                <p className="text-lg font-semibold tabular-nums text-foreground">{ivScore.toFixed(1)}</p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <SectionLabel>Rincian per Parameter (rata-rata tertimbang penilai)</SectionLabel>
      <Card className="p-0">
        <div className="divide-y divide-border">
          {PARAMETERS.map((p) => {
            let sum = 0;
            let wsum = 0;
            for (const e of EVALUATORS) {
              const v = a.scores[e.key][p.key];
              if (v) {
                sum += (v / p.scale) * 100 * (e.weight / 100);
                wsum += e.weight / 100;
              }
            }
            const pct = wsum ? sum / wsum : 0;
            return (
              <div key={p.key} className="flex items-center gap-3 px-4 py-3">
                <span className="w-40 shrink-0 truncate text-sm text-foreground">{p.title}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn("h-full rounded-full", pct >= 85 ? "bg-brand-500" : pct >= 70 ? "bg-amber-500" : "bg-red-500")}
                    style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
                  />
                </div>
                <span className="w-12 shrink-0 text-right text-sm font-semibold tabular-nums text-foreground">{pct.toFixed(0)}</span>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <p className="text-sm font-semibold text-foreground">Analisis Gap Antar Penilai</p>
          {allFilled ? (
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              Selisih skor tertinggi–terendah: <span className="font-semibold tabular-nums text-foreground">{gap.toFixed(1)} poin</span>.{" "}
              {gap > 15
                ? "Gap cukup besar — disarankan sesi kalibrasi untuk menyamakan persepsi antar penilai."
                : "Gap dalam batas wajar — persepsi penilai relatif selaras."}
            </p>
          ) : (
            <p className="mt-1.5 text-xs text-muted-foreground">Menunggu seluruh penilai mengisi lengkap.</p>
          )}
        </Card>

        <Card className={cn(fastTrack && "ring-1 ring-violet-500/30")}>
          <p className="text-sm font-semibold text-foreground">Fast Track (Opsional)</p>
          <label className="mt-2 flex cursor-pointer items-start gap-2 text-xs text-foreground">
            <input
              type="checkbox"
              checked={a.financialImpact}
              onChange={(e) => a.setFinancialImpact(e.target.checked)}
              className="mt-0.5 size-4 accent-violet-500"
            />
            <span>Terdapat bukti dampak finansial terukur (efisiensi / revenue / penghematan).</span>
          </label>
          <p className="mt-2 text-xs text-muted-foreground">
            {fastTrack ? (
              <span className="font-semibold text-violet-600 dark:text-violet-400">✓ Memenuhi syarat fast track — diskusikan promosi jabatan dengan manajemen senior.</span>
            ) : (
              "Butuh skor > 95, dampak finansial terukur, dan Attitude nilai 3 dari ≥ 2 penilai."
            )}
          </p>
        </Card>
      </div>

      <SectionLabel>Seluruh Data Assessment</SectionLabel>
      <AllAssessmentsTable live={liveRecord} />
    </div>
  );
}

/** Data table of every assessment, with combinable Departemen + Status Hasil filters (spec §6). */
function AllAssessmentsTable({ live }: { live: AssessmentRecord | null }) {
  const [dept, setDept] = React.useState("");
  const [hasil, setHasil] = React.useState("");

  const all = React.useMemo(() => (live ? [live, ...MOCK_ASSESSMENTS] : MOCK_ASSESSMENTS), [live]);
  const rows = React.useMemo(
    () => all.filter((r) => (!dept || r.departmentId === dept) && (!hasil || r.hasil === hasil)),
    [all, dept, hasil],
  );

  const columns = React.useMemo<ColumnDef<AssessmentRecord>[]>(
    () => [
      { accessorKey: "tanggal", header: "Tanggal", cell: ({ getValue }) => <span className="whitespace-nowrap tabular-nums">{getValue<string>()}</span> },
      { accessorKey: "batch", header: "Batch" },
      { accessorKey: "nik", header: "NIK", cell: ({ getValue }) => <span className="whitespace-nowrap font-mono text-xs">{getValue<string>()}</span> },
      { accessorKey: "name", header: "Nama", cell: ({ getValue }) => <span className="whitespace-nowrap font-medium text-foreground">{getValue<string>()}</span> },
      { accessorKey: "departmentName", header: "Departemen", cell: ({ getValue }) => <span className="whitespace-nowrap">{getValue<string>()}</span> },
      { accessorKey: "jabatan", header: "Jabatan", cell: ({ getValue }) => <span className="whitespace-nowrap">{getValue<string>()}</span> },
      { accessorKey: "golongan", header: "Gol. Saat Ini", cell: ({ getValue }) => <span className="whitespace-nowrap">{getValue<string>()}</span> },
      { accessorKey: "golonganTujuan", header: "Gol. Tujuan", cell: ({ getValue }) => <span className="whitespace-nowrap">{getValue<string>()}</span> },
      { accessorKey: "penilai", header: "Penilai", cell: ({ getValue }) => <span className="whitespace-nowrap text-muted-foreground">{getValue<string>()}</span> },
      { accessorKey: "status", header: "Status", cell: ({ getValue }) => <span className="whitespace-nowrap text-muted-foreground">{getValue<string>()}</span> },
      {
        accessorKey: "hasil",
        header: "Hasil",
        cell: ({ getValue }) => {
          const h = getValue<HasilStatus>();
          return <TierPill tone={HASIL_META[h].tone}>{HASIL_META[h].label}</TierPill>;
        },
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => <ReportButton record={row.original} />,
      },
    ],
    [],
  );

  return (
    <DataTable
      columns={columns}
      data={rows}
      tableId="assessment-records"
      searchPlaceholder="Cari nama / NIK…"
      pageSize={8}
      toolbar={
        <div className="flex flex-wrap items-center gap-2">
          <Select value={dept} onChange={(e) => setDept(e.target.value)} className="h-9 w-auto min-w-40">
            <option value="">Semua Departemen</option>
            {departmentOptions().map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          <Select value={hasil} onChange={(e) => setHasil(e.target.value)} className="h-9 w-auto min-w-36">
            <option value="">Semua Status Hasil</option>
            {HASIL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
      }
    />
  );
}
