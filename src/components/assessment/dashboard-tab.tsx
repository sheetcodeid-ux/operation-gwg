"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  IV_RECOMMENDATIONS,
  PARAMETERS,
  evaluatorFilled,
  evaluatorScore,
  fastTrackEligible,
  finalScore,
  gradeTier,
  interviewScore,
} from "@/lib/assessment/config";
import {
  departmentOptions,
  employeesForPosition,
  formatGolongan,
  positionsForDepartment,
} from "@/lib/assessment/org";
import {
  HASIL_META,
  HASIL_OPTIONS,
  MOCK_ASSESSMENTS,
  type AssessmentRecord,
  type HasilStatus,
} from "@/lib/assessment/records";
import { cn } from "@/lib/utils";
import { DataTable } from "@/components/ui/data-table";
import { useAssessment } from "./context";
import { ReportButton } from "./report";
import { Banner, Card, Dropdown, ScoreRing, ScrollRow, SectionLabel, TierPill } from "./parts";

const TONE_TO_HASIL: Record<string, HasilStatus> = { no: "tidak_layak", wait: "ditunda", ok: "layak", fast: "fast_track" };

/** Tab ⑤: live result of the current assessment + table of all assessments. */
export function DashboardTab() {
  const a = useAssessment();
  const evaluators = a.activeEvaluators;
  const single = evaluators.length === 1;
  const final = finalScore(a.scores, evaluators);
  const tier = gradeTier(final);
  const ivScore = interviewScore(a.interview);
  const ivRek = IV_RECOMMENDATIONS.find((r) => r.value === a.ivRecommendation) ?? null;
  const fastTrack = fastTrackEligible(a.scores, a.financialImpact, evaluators);
  const allFilled = evaluators.every((e) => evaluatorFilled(a.scores[e.key]) === PARAMETERS.length);

  const overridden = a.ivRecommendation === "tidak_layak" && final >= 85;
  const decisionLabel = overridden ? "Tidak Direkomendasikan (Override Interview)" : tier.label;
  const decisionTone = overridden ? "no" : tier.tone;

  const evalScores = evaluators.map((e) => evaluatorScore(a.scores[e.key]));
  const gap = allFilled && !single ? Math.max(...evalScores) - Math.min(...evalScores) : 0;

  const golonganNow = formatGolongan(a.candidate.golongan, a.candidate.golonganLevel);
  const golonganNext = formatGolongan(a.candidate.golonganTujuan, a.candidate.golonganTujuanLevel);

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
        golongan: golonganNow || "—",
        golonganTujuan: golonganNext || "—",
        penilai: single ? "Director" : "Atasan, HC, Director",
        status: allFilled ? "Menunggu Interview" : "Proses Penilaian",
        hasil: TONE_TO_HASIL[decisionTone],
        finalScore: final,
        interviewResult: ivRek?.label ?? "—",
        decision: decisionLabel,
        evaluators: evaluators.map((e, i) => ({ name: e.name, weight: e.weight, score: evalScores[i] })),
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

        <div className="grid gap-3">
          <ScrollRow cols={single ? 2 : 3}>
            {evaluators.map((e, i) => (
              <Card key={e.key}>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{e.name} · {e.weight}%</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{evalScores[i].toFixed(1)}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Kontribusi ke final: <span className="tabular-nums">{(evalScores[i] * (e.weight / 100)).toFixed(1)}</span>
                </p>
              </Card>
            ))}
          </ScrollRow>
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">{a.resolved.nama || "Belum dipilih"}</p>
                <p className="text-xs text-muted-foreground">
                  {a.resolved.jabatan || "—"} · Golongan {golonganNow || "—"} → {golonganNext || "—"}
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
            for (const e of evaluators) {
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

      {!single && (
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
            <FastTrackControl />
          </Card>
        </div>
      )}
      {single && (
        <Card className={cn(fastTrack && "ring-1 ring-violet-500/30")}>
          <FastTrackControl />
        </Card>
      )}

      <SectionLabel>Seluruh Data Assessment</SectionLabel>
      <AllAssessmentsTable live={liveRecord} />
    </div>
  );
}

function FastTrackControl() {
  const a = useAssessment();
  const fastTrack = fastTrackEligible(a.scores, a.financialImpact, a.activeEvaluators);
  return (
    <>
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
          "Butuh skor > 95, dampak finansial terukur, dan Attitude nilai 3 dari penilai."
        )}
      </p>
    </>
  );
}

/** Data table of every assessment, with cascading Departemen → Jabatan → Nama + Status filters (spec revisi §6). */
function AllAssessmentsTable({ live }: { live: AssessmentRecord | null }) {
  const [dept, setDept] = React.useState("");
  const [jabatan, setJabatan] = React.useState("");
  const [nama, setNama] = React.useState("");
  const [hasil, setHasil] = React.useState("");

  // Cascading option lists (by title/name, matching the record fields).
  const jabatanOptions = React.useMemo(
    () => positionsForDepartment(dept).map((p) => ({ value: p.title, label: p.title })),
    [dept],
  );
  const namaOptions = React.useMemo(() => {
    const pos = positionsForDepartment(dept).find((p) => p.title === jabatan);
    return employeesForPosition(pos?.id).map((e) => ({ value: e.name, label: e.name }));
  }, [dept, jabatan]);

  const all = React.useMemo(() => (live ? [live, ...MOCK_ASSESSMENTS] : MOCK_ASSESSMENTS), [live]);
  const rows = React.useMemo(
    () =>
      all.filter(
        (r) =>
          (!dept || r.departmentId === dept) &&
          (!jabatan || r.jabatan === jabatan) &&
          (!nama || r.name === nama) &&
          (!hasil || r.hasil === hasil),
      ),
    [all, dept, jabatan, nama, hasil],
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
      { id: "actions", header: "", cell: ({ row }) => <ReportButton record={row.original} /> },
    ],
    [],
  );

  return (
    <div className="space-y-3">
      <ScrollRow cols={4}>
        <Dropdown
          label="Departemen"
          value={dept}
          onChange={(v) => {
            setDept(v);
            setJabatan("");
            setNama("");
          }}
          options={[{ value: "", label: "Semua Departemen" }, ...departmentOptions()]}
          placeholder="Semua Departemen"
        />
        <Dropdown
          label="Jabatan"
          value={jabatan}
          onChange={(v) => {
            setJabatan(v);
            setNama("");
          }}
          options={[{ value: "", label: "Semua Jabatan" }, ...jabatanOptions]}
          placeholder="Semua Jabatan"
          disabled={!dept}
        />
        <Dropdown
          label="Nama"
          value={nama}
          onChange={setNama}
          options={[{ value: "", label: "Semua Nama" }, ...namaOptions]}
          placeholder="Semua Nama"
          disabled={!jabatan}
        />
        <Dropdown
          label="Status Hasil"
          value={hasil}
          onChange={setHasil}
          options={[{ value: "", label: "Semua Status Hasil" }, ...HASIL_OPTIONS]}
          placeholder="Semua Status Hasil"
        />
      </ScrollRow>

      <DataTable columns={columns} data={rows} tableId="assessment-records" searchPlaceholder="Cari nama / NIK…" pageSize={8} />
    </div>
  );
}
