"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { UserSearch } from "lucide-react";
import { departmentOptions, employeesForPosition, formatGolongan, positionsForDepartment } from "@/lib/assessment/org";
import { ASSESSMENTS, FOLLOW_UP_RECORDS, LATEST_ASSESSMENTS, computeResult, historyFor, type EnrichedRecord, type ResultBundle } from "@/lib/assessment/result";
import { HASIL_META, HASIL_OPTIONS, type AssessmentRecord, type HasilStatus } from "@/lib/assessment/records";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/page-header";
import { useAssessment } from "./context";
import { DashboardReportButton, ReportButton } from "./report";
import { CompetencyRadar } from "./radar";
import { Banner, Card, Dropdown, ExpandRow, MeterBar, MiniStat, ScoreRing, ScrollRow, SectionLabel, TierPill } from "./parts";

const PARAM_SHORT: Record<string, string> = {
  kpi: "KPI",
  att: "Attitude",
  loy: "Loyalitas",
  skl: "Skill",
  kon: "Kontrib.",
  msk: "Masa",
};

const TONE_TO_HASIL: Record<string, HasilStatus> = { no: "tidak_layak", wait: "ditunda", ok: "layak", fast: "fast_track" };

interface Subject {
  name: string;
  jabatan: string;
  departemen: string;
  golongan: string;
  golonganTujuan: string;
  batch: string;
  tanggal: string;
  source: "live" | "record";
}

/** Tab ⑤: batch tracking + per-employee result + full data table. */
export function DashboardTab() {
  const a = useAssessment();
  const golNow = formatGolongan(a.candidate.golongan, a.candidate.golonganLevel);
  const golNext = formatGolongan(a.candidate.golonganTujuan, a.candidate.golonganTujuanLevel);

  const liveBundle = computeResult({
    scores: a.scores,
    self: a.self,
    interview: a.interview,
    ivRecValue: a.ivRecommendation,
    evaluators: a.activeEvaluators,
    financialImpact: a.financialImpact,
  });

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
        golongan: golNow || "—",
        golonganTujuan: golNext || "—",
        penilai: liveBundle.single ? "Director" : "Atasan, HC, Director",
        status: liveBundle.allFilled ? "Menunggu Interview" : "Proses Penilaian",
        hasil: TONE_TO_HASIL[liveBundle.decisionTone],
        finalScore: liveBundle.final,
        interviewResult: liveBundle.ivRek?.label ?? "—",
        decision: liveBundle.decisionLabel,
        evaluators: liveBundle.evalScores.map((e) => ({ name: e.name, weight: e.weight, score: e.score })),
      }
    : null;

  // ── per-employee selector (local; does not touch the shared candidate) ──
  const [dDept, setDDept] = React.useState("");
  const [dJab, setDJab] = React.useState("");
  const [dNama, setDNama] = React.useState("");
  const [viewId, setViewId] = React.useState<string | null>(null); // which period is shown
  const jabOpts = React.useMemo(() => positionsForDepartment(dDept).map((p) => ({ value: p.title, label: p.title })), [dDept]);
  const namaOpts = React.useMemo(() => {
    const pos = positionsForDepartment(dDept).find((p) => p.title === dJab);
    return employeesForPosition(pos?.id).map((e) => ({ value: e.name, label: e.name }));
  }, [dDept, dJab]);

  const nameHistory = React.useMemo(() => (dNama ? historyFor(dNama) : []), [dNama]);
  const selectedRecord: EnrichedRecord | null = nameHistory.length ? nameHistory.find((r) => r.id === viewId) ?? nameHistory[0] : null;
  const liveIsSelected = !!dNama && liveRecord?.name === dNama;
  const emptyEmployee = !!dNama && !selectedRecord && !liveIsSelected;

  let bundle: ResultBundle | null = null;
  let subject: Subject | null = null;
  let editable = false;
  if (selectedRecord) {
    bundle = selectedRecord.bundle;
    subject = {
      name: selectedRecord.name,
      jabatan: selectedRecord.jabatan,
      departemen: selectedRecord.departmentName,
      golongan: selectedRecord.golongan,
      golonganTujuan: selectedRecord.golonganTujuan,
      batch: selectedRecord.batch,
      tanggal: selectedRecord.tanggal,
      source: "record",
    };
  } else if (!emptyEmployee && a.resolved.nama) {
    bundle = liveBundle;
    editable = true;
    subject = {
      name: a.resolved.nama,
      jabatan: a.resolved.jabatan,
      departemen: a.resolved.departemen,
      golongan: golNow || "—",
      golonganTujuan: golNext || "—",
      batch: a.candidate.batch || "—",
      tanggal: new Date().toISOString().slice(0, 10),
      source: "live",
    };
  }

  const resetView = () => {
    setDDept("");
    setDJab("");
    setDNama("");
    setViewId(null);
  };

  const individualRef = React.useRef<HTMLDivElement>(null);
  const selectEmployee = (r: AssessmentRecord) => {
    setDDept(r.departmentId);
    setDJab(r.jabatan);
    setDNama(r.name);
    setViewId(null);
    setTimeout(() => individualRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  };

  return (
    <div className="space-y-4">
      <SectionLabel>Ringkasan Batch (Tracking)</SectionLabel>
      <BatchTracking live={liveRecord} />

      <FollowUpPanel onSelect={selectEmployee} />

      <div ref={individualRef} className="scroll-mt-24 space-y-4">
      <SectionLabel>Lihat Hasil per Karyawan</SectionLabel>
      <Card>
        <ScrollRow cols={3}>
          <Dropdown
            label="Departemen"
            value={dDept}
            onChange={(v) => {
              setDDept(v);
              setDJab("");
              setDNama("");
              setViewId(null);
            }}
            options={[{ value: "", label: "— Assessment Berjalan —" }, ...departmentOptions()]}
            placeholder="Assessment Berjalan"
          />
          <Dropdown
            label="Jabatan"
            value={dJab}
            onChange={(v) => {
              setDJab(v);
              setDNama("");
              setViewId(null);
            }}
            options={jabOpts}
            placeholder={dDept ? "Pilih jabatan…" : "Pilih departemen dulu"}
            disabled={!dDept}
          />
          <Dropdown
            label="Nama Karyawan"
            value={dNama}
            onChange={(v) => {
              setDNama(v);
              setViewId(null);
            }}
            options={namaOpts}
            placeholder={dJab ? "Pilih nama…" : "Pilih jabatan dulu"}
            disabled={!dJab}
          />
        </ScrollRow>
        {dNama && (
          <button type="button" onClick={resetView} className="mt-3 text-xs font-medium text-brand-600 hover:underline dark:text-brand-400">
            ← Kembali ke assessment berjalan
          </button>
        )}
      </Card>

      {emptyEmployee ? (
        <EmptyState
          icon={UserSearch}
          title={`${dNama} belum memiliki assessment`}
          description="Karyawan ini belum masuk periode penilaian atau prosesnya belum dimulai. Mulai dari tab Syarat & SA lalu Penilaian."
        />
      ) : bundle && subject ? (
        <IndividualResult
          bundle={bundle}
          subject={subject}
          editable={editable}
          reportRecord={selectedRecord ?? liveRecord!}
          history={subject.source === "record" ? nameHistory : []}
          currentId={selectedRecord?.id ?? null}
          onSelectPeriod={(id) => setViewId(id)}
        />
      ) : (
        <EmptyState
          icon={UserSearch}
          title="Belum ada karyawan dipilih"
          description="Pilih karyawan di atas untuk melihat hasil, atau pilih karyawan yang dinilai di tab Penilaian."
        />
      )}
      </div>

      <SectionLabel>Seluruh Data Assessment</SectionLabel>
      <AllAssessmentsTable live={liveRecord} />
    </div>
  );
}

const BAR_BG: Record<string, string> = { fast: "bg-violet-500", ok: "bg-brand-500", wait: "bg-amber-500", no: "bg-red-500" };
const DIST_ORDER: HasilStatus[] = ["fast_track", "layak", "ditunda", "tidak_layak"];

/** Batch-wide tracking tiles + outcome distribution — automatic, precise counts. */
function BatchTracking({ live }: { live: AssessmentRecord | null }) {
  const all = live ? [live, ...LATEST_ASSESSMENTS] : LATEST_ASSESSMENTS;
  const total = all.length;
  const selesai = all.filter((r) => r.status === "Selesai" || r.status === "Menunggu Interview").length;
  const berjalan = total - selesai;
  const count = (h: HasilStatus) => all.filter((r) => r.status !== "Proses Penilaian" && r.status !== "Draft" && r.hasil === h).length;
  const avg = total ? Math.round((all.reduce((s, r) => s + r.finalScore, 0) / total) * 10) / 10 : 0;

  // Distribution over decided assessments (a result is only meaningful once assessed).
  const decided = all.filter((r) => r.status !== "Proses Penilaian" && r.status !== "Draft");
  const dTotal = decided.length || 1;
  const dist = DIST_ORDER.map((h) => ({ h, n: decided.filter((r) => r.hasil === h).length }));
  const dMax = Math.max(...dist.map((d) => d.n), 1);

  return (
    <div className="space-y-3">
      <ScrollRow cols={4}>
        <MiniStat label="Total Assessment" value={total} hint={`Rata-rata skor ${avg}`} />
        <MiniStat label="Selesai / Berjalan" value={`${selesai} / ${berjalan}`} tone="ok" hint="status proses" />
        <MiniStat label="Layak + Fast Track" value={count("layak") + count("fast_track")} tone="ok" hint={`Fast track ${count("fast_track")}`} />
        <MiniStat label="Ditunda / Tidak Layak" value={`${count("ditunda")} / ${count("tidak_layak")}`} tone="wait" hint="perlu tindak lanjut" />
      </ScrollRow>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">Distribusi Hasil</p>
          <span className="text-[11px] text-muted-foreground">{decided.length} assessment sudah diputuskan</span>
        </div>
        <div className="space-y-2.5">
          {dist.map(({ h, n }) => {
            const meta = HASIL_META[h];
            const pct = Math.round((n / dTotal) * 100);
            return (
              <div key={h} className="flex items-center gap-3">
                <span className="flex w-32 shrink-0 items-center gap-1.5">
                  <span className={cn("size-2.5 shrink-0 rounded-full", BAR_BG[meta.tone])} />
                  <span className="truncate text-xs text-foreground">{meta.label}</span>
                </span>
                <MeterBar
                  className="flex-1"
                  pct={(n / dMax) * 100}
                  colorClass={BAR_BG[meta.tone]}
                  tooltip={
                    <span>
                      {meta.label}: <span className="tabular-nums">{n}</span> karyawan · {pct}% dari total
                    </span>
                  }
                />
                <span className="w-16 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                  <span className="font-semibold text-foreground">{n}</span> · {pct}%
                </span>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

/** Full per-employee result — mirrors the HTML dashboard layout, all measured. */
function IndividualResult({
  bundle,
  subject,
  editable,
  reportRecord,
  history,
  currentId,
  onSelectPeriod,
}: {
  bundle: ResultBundle;
  subject: Subject;
  editable: boolean;
  reportRecord: AssessmentRecord;
  history: EnrichedRecord[];
  currentId: string | null;
  onSelectPeriod: (id: string) => void;
}) {
  const a = useAssessment();
  const b = bundle;
  const radarData = b.params.map((p) => ({ label: p.title, short: PARAM_SHORT[p.key] ?? p.title, value: p.avgPct }));

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-500/10 px-2.5 py-1 text-[11px] font-semibold text-brand-700 ring-1 ring-brand-500/25 dark:text-brand-400">
                {subject.source === "live" ? "Assessment Berjalan" : "Riwayat Assessment"}
              </span>
              <span className="text-[11px] text-muted-foreground">{subject.batch} · {subject.tanggal}</span>
            </div>
            <p className="mt-1.5 text-lg font-semibold text-foreground">{subject.name || "Belum dipilih"}</p>
            <p className="text-xs text-muted-foreground">
              {subject.jabatan || "—"} · {subject.departemen || "—"} · Golongan {subject.golongan || "—"} → {subject.golonganTujuan || "—"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ReportButton record={reportRecord} />
            <DashboardReportButton record={reportRecord} bundle={b} />
          </div>
        </div>
      </Card>

      {/* Tracking / completion for the running assessment */}
      {!b.allFilled && (
        <Card>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">Progres Penilaian</p>
            <span className="text-sm font-semibold tabular-nums text-foreground">{b.completionPct}%</span>
          </div>
          <MeterBar pct={b.completionPct} colorClass="bg-brand-500" tooltip={`${b.filledEvaluators}/${b.totalEvaluators} penilai lengkap`} />

          <div className="mt-3 flex flex-wrap gap-2">
            {b.evalScores.map((e) => (
              <span
                key={e.key}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1",
                  e.done ? "bg-brand-500/10 text-brand-700 ring-brand-500/25 dark:text-brand-400" : "bg-muted text-muted-foreground ring-border",
                )}
              >
                {e.done ? "✓" : "○"} {e.name} · {e.filled}/6
              </span>
            ))}
          </div>
        </Card>
      )}

      {/* Final result hero */}
      <div className="grid gap-3 lg:grid-cols-[auto_1fr]">
        <Card className="flex flex-col items-center justify-center gap-3 text-center">
          <ScoreRing value={b.final} sub="Skor Final" />
          <TierPill tone={b.decisionTone}>{b.decisionLabel}</TierPill>
        </Card>
        <Card className="flex flex-col justify-center">
          <p className="text-sm font-semibold text-foreground">{b.tier.label}</p>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
            {b.overridden
              ? "Meskipun skor memenuhi syarat, interview mengungkap concern serius sehingga kenaikan golongan tidak direkomendasikan periode ini."
              : b.tier.action}
          </p>
          {b.ivRek && <p className="mt-2 text-xs text-muted-foreground">Rekomendasi interview: <span className="font-medium text-foreground">{b.ivRek.label}</span></p>}
        </Card>
      </div>

      {/* Assessment history timeline (multiple periods) */}
      {history.length > 1 && (
        <>
          <SectionLabel>Riwayat Assessment ({history.length} periode)</SectionLabel>
          <Card>
            <HistoryTimeline history={history} currentId={currentId} onSelect={onSelectPeriod} />
          </Card>
        </>
      )}

      {/* Per-evaluator cards */}
      <SectionLabel>Skor per Penilai (Resmi)</SectionLabel>
      <ScrollRow cols={b.single ? 1 : 3}>
        {b.evalScores.map((e) => (
          <Card key={e.key} className={cn(!e.done && "opacity-70")}>
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{e.name} · {e.weight}%</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{e.done ? e.score.toFixed(1) : "—"}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {e.done ? <>Kontribusi ke final: <span className="tabular-nums">{e.contribution.toFixed(1)}</span></> : "Belum diisi"}
            </p>
          </Card>
        ))}
      </ScrollRow>

      {/* SA & interview summary */}
      <SectionLabel>Self Assessment & Interview (Referensi)</SectionLabel>
      <ScrollRow cols={2}>
        <Card className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-400">Self Assessment</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums text-foreground">{b.selfScore != null ? b.selfScore.toFixed(1) : "—"}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Tidak dihitung ke skor final</p>
        </Card>
        <Card className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">Interview Akhir</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums text-foreground">{b.ivScore > 0 ? b.ivScore.toFixed(1) : "—"}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{b.ivRek?.label ?? "Belum dilaksanakan"}</p>
        </Card>
      </ScrollRow>

      {/* Gap warning */}
      {b.gapDetail && (
        <Banner tone={b.gapWajib ? "danger" : "amber"} icon="⚡">
          <strong>Gap {b.gapWajib ? "kritis" : "signifikan"} antar penilai.</strong> {b.gapDetail}
        </Banner>
      )}

      {/* Competency radar (single brand hue) */}
      {b.anyFilled && (
        <>
          <SectionLabel>Profil Kompetensi</SectionLabel>
          <Card>
            <CompetencyRadar data={radarData} />
            <p className="mt-2 text-center text-[11px] text-muted-foreground">Rata-rata tertimbang normalisasi tiap parameter (0–100).</p>
          </Card>
        </>
      )}

      {/* Parameter comparison — professional expandable dropdowns */}
      <SectionLabel>Perbandingan Nilai per Parameter</SectionLabel>
      <div className="space-y-2">
        {b.params.map((p) => (
          <ExpandRow
            key={p.key}
            flagged={p.gapFlag}
            title={
              <span className="flex items-center gap-2">
                {p.title}
                <span className="text-[11px] text-muted-foreground">· bobot {p.weight}%</span>
                {p.gapFlag && <span className="text-amber-500">⚠</span>}
              </span>
            }
            right={<span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">{p.avgPct}%</span>}
          >
            <div className="space-y-2.5">
              {b.evaluators.map((ev) => {
                const pct = p.perEvalPct[ev.key];
                const raw = p.perEvalRaw[ev.key];
                return (
                  <div key={ev.key} className="flex items-center gap-3">
                    <span className="w-40 shrink-0 truncate text-xs text-muted-foreground">{ev.name} <span className="text-muted-foreground/60">({ev.weight}%)</span></span>
                    <MeterBar
                      className="flex-1"
                      pct={pct ?? 0}
                      colorClass={pct == null ? "bg-transparent" : pct >= 85 ? "bg-brand-500" : pct >= 60 ? "bg-amber-500" : "bg-red-500"}
                    />
                    <span className="w-20 shrink-0 text-right text-xs tabular-nums text-foreground">
                      {pct == null ? "—" : <>{raw}/{p.scale} · {pct}%</>}
                    </span>
                  </div>
                );
              })}
              {p.selfPct != null && (
                <div className="flex items-center gap-3 border-t border-border pt-2.5">
                  <span className="w-40 shrink-0 text-xs text-violet-600 dark:text-violet-400">Self Assessment (ref)</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-violet-500" style={{ width: `${p.selfPct}%` }} />
                  </div>
                  <span className="w-20 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{p.selfPct}%</span>
                </div>
              )}
            </div>
          </ExpandRow>
        ))}
      </div>

      {/* Perception analysis: self-assessment vs evaluators */}
      <PerceptionInsight bundle={b} />

      {/* Recommendations */}
      <SectionLabel>Rekomendasi Tindak Lanjut</SectionLabel>
      <Card>
        <ul className="space-y-2.5">
          {b.recommendations.map((r, i) => (
            <li key={i} className="flex gap-3 text-sm leading-relaxed text-foreground">
              <span className="shrink-0 text-base leading-none">{r.icon}</span>
              <span className="text-muted-foreground">{r.text}</span>
            </li>
          ))}
        </ul>
      </Card>

      {/* Fast track */}
      {b.final > 95 && (
        <Card className="ring-1 ring-violet-500/30">
          <p className="text-sm font-semibold text-foreground">Syarat Fast Track Promotion</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Skor &gt; 95 terpenuhi. Fast track berlaku bila dampak finansial terukur + Attitude nilai 3 dari penilai.
          </p>
          <label className="mt-2.5 flex items-start gap-2 text-xs text-foreground">
            <input
              type="checkbox"
              checked={editable ? a.financialImpact : subject.source === "record"}
              onChange={(e) => editable && a.setFinancialImpact(e.target.checked)}
              disabled={!editable}
              className="mt-0.5 size-4 accent-violet-500"
            />
            <span>Terdapat bukti dampak finansial terukur (efisiensi / revenue / penghematan).</span>
          </label>
        </Card>
      )}

      {/* Evaluator & interview notes (running assessment only) */}
      {subject.source === "live" && (() => {
        const notes = b.evaluators
          .map((e) => ({ name: e.name, note: (a.evaluatorNotes[e.key] ?? "").trim() }))
          .filter((n) => n.note);
        const hasIv = a.ivNote.trim().length > 0;
        if (!notes.length && !hasIv) return null;
        return (
          <>
            <SectionLabel>Catatan Penilai & Interview</SectionLabel>
            <div className="space-y-2">
              {notes.map((n) => (
                <Card key={n.name}>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{n.name}</p>
                  <p className="mt-1 text-sm leading-relaxed text-foreground">“{n.note}”</p>
                </Card>
              ))}
              {hasIv && (
                <Card>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">Catatan Interview</p>
                  <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-foreground">{a.ivNote}</p>
                </Card>
              )}
            </div>
          </>
        );
      })()}

      {/* Reset — running assessment only */}
      {subject.source === "live" && (
        <div className="flex justify-end pt-2">
          <Button
            variant="outline"
            onClick={() => {
              if (typeof window !== "undefined" && window.confirm("Reset seluruh data assessment yang sedang berjalan?")) a.resetAssessment();
            }}
          >
            <RotateCcw className="size-4" /> Reset &amp; Mulai Ulang
          </Button>
        </div>
      )}
    </div>
  );
}

/** Auto insight: where the employee's self-assessment diverges from the evaluators. */
function PerceptionInsight({ bundle }: { bundle: ResultBundle }) {
  if (bundle.selfScore == null || !bundle.anyFilled) return null;
  const rows = bundle.params
    .filter((p) => p.selfPct != null && Object.keys(p.perEvalPct).length > 0)
    .map((p) => ({ title: p.title, self: p.selfPct as number, ev: p.avgPct, gap: (p.selfPct as number) - p.avgPct }));
  if (!rows.length) return null;

  const flagged = rows.filter((r) => Math.abs(r.gap) >= 20).sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));
  const overall = Math.round(bundle.selfScore - bundle.final);
  const label = overall >= 8 ? "Cenderung menilai diri lebih tinggi" : overall <= -8 ? "Cenderung menilai diri lebih rendah" : "Persepsi selaras dengan penilai";
  const tone = Math.abs(overall) >= 8 ? "wait" : "ok";

  return (
    <>
      <SectionLabel>Analisis Persepsi — Self Assessment vs Penilai</SectionLabel>
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Self Assessment</p>
              <p className="text-xl font-semibold tabular-nums text-foreground">{bundle.selfScore.toFixed(1)}</p>
            </div>
            <span className="text-muted-foreground">vs</span>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Penilai (final)</p>
              <p className="text-xl font-semibold tabular-nums text-foreground">{bundle.final.toFixed(1)}</p>
            </div>
          </div>
          <TierPill tone={tone}>{label}</TierPill>
        </div>
        {flagged.length ? (
          <div className="mt-3 space-y-1.5 border-t border-border pt-3">
            <p className="text-xs text-muted-foreground">Perbedaan persepsi signifikan (≥ 20 poin):</p>
            {flagged.map((r) => (
              <div key={r.title} className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 truncate text-foreground">{r.title}</span>
                <span className="flex shrink-0 items-center gap-2 text-xs tabular-nums text-muted-foreground">
                  SA {r.self}% · Penilai {r.ev}%
                  <span className={cn("rounded-full px-2 py-0.5 font-medium", r.gap > 0 ? "bg-amber-500/15 text-amber-600 dark:text-amber-400" : "bg-sky-500/15 text-sky-600 dark:text-sky-400")}>
                    {r.gap > 0 ? `▲ +${r.gap}` : `▼ ${r.gap}`}
                  </span>
                </span>
              </div>
            ))}
            <p className="pt-1 text-[11px] text-muted-foreground">Parameter di atas sebaiknya dibahas saat kalibrasi / interview.</p>
          </div>
        ) : (
          <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
            Persepsi karyawan selaras dengan penilai di semua parameter (tidak ada gap ≥ 20 poin).
          </p>
        )}
      </Card>
    </>
  );
}

/** Vertical timeline of an employee's assessments across periods, with trend. */
function HistoryTimeline({ history, currentId, onSelect }: { history: EnrichedRecord[]; currentId: string | null; onSelect: (id: string) => void }) {
  return (
    <ol className="relative space-y-1">
      {history.map((r, i) => {
        const prev = history[i + 1]; // older entry (history is newest-first)
        const delta = prev ? Math.round((r.finalScore - prev.finalScore) * 10) / 10 : null;
        const active = r.id === currentId;
        const meta = HASIL_META[r.hasil];
        return (
          <li key={r.id} className="relative flex gap-3 pl-1">
            {/* rail */}
            <div className="flex flex-col items-center">
              <span className={cn("mt-1.5 size-2.5 shrink-0 rounded-full ring-2 ring-background", BAR_BG[meta.tone])} />
              {i < history.length - 1 && <span className="w-px flex-1 bg-border" />}
            </div>
            <button
              type="button"
              onClick={() => onSelect(r.id)}
              className={cn(
                "mb-1 flex w-full flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left transition-colors",
                active ? "border-brand-500/40 bg-brand-500/5" : "border-transparent hover:bg-muted/40",
              )}
            >
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                  {r.tanggal}
                  {active && <span className="rounded-full bg-brand-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700 dark:text-brand-400">Dilihat</span>}
                </p>
                <p className="text-xs text-muted-foreground">{r.batch} · Golongan {r.golongan}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {delta != null && (
                  <span className={cn("text-xs font-medium tabular-nums", delta > 0 ? "text-brand-600 dark:text-brand-400" : delta < 0 ? "text-red-500" : "text-muted-foreground")}>
                    {delta > 0 ? `▲ +${delta}` : delta < 0 ? `▼ ${delta}` : "±0"}
                  </span>
                )}
                <span className="text-sm font-semibold tabular-nums text-foreground">{r.finalScore.toFixed(1)}</span>
                <TierPill tone={meta.tone}>{meta.label}</TierPill>
              </div>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/** Notification panel: decided assessments that need a follow-up action. */
function FollowUpPanel({ onSelect }: { onSelect: (r: AssessmentRecord) => void }) {
  if (!FOLLOW_UP_RECORDS.length) {
    return (
      <Banner tone="success" icon="✓">
        <strong>Tidak ada assessment yang memerlukan tindak lanjut.</strong> Semua hasil yang sudah diputuskan dalam kondisi baik.
      </Banner>
    );
  }
  return (
    <Card className="p-0">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <AlertTriangle className="size-4 text-amber-500" /> Perlu Tindak Lanjut
        </p>
        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-bold text-amber-600 ring-1 ring-amber-500/30 dark:text-amber-400">
          {FOLLOW_UP_RECORDS.length}
        </span>
      </div>
      <div className="divide-y divide-border">
        {FOLLOW_UP_RECORDS.map((r) => (
          <div key={r.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{r.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {r.jabatan} · {r.departmentName} · skor {r.finalScore.toFixed(1)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <TierPill tone={HASIL_META[r.hasil].tone}>{HASIL_META[r.hasil].label}</TierPill>
              <Button size="sm" variant="outline" onClick={() => onSelect(r)}>
                Lihat
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

/** Data table of every assessment, with cascading Departemen → Jabatan → Nama + Status filters. */
function AllAssessmentsTable({ live }: { live: AssessmentRecord | null }) {
  const [dept, setDept] = React.useState("");
  const [jabatan, setJabatan] = React.useState("");
  const [nama, setNama] = React.useState("");
  const [hasil, setHasil] = React.useState("");

  const jabatanOptions = React.useMemo(() => positionsForDepartment(dept).map((p) => ({ value: p.title, label: p.title })), [dept]);
  const namaOptions = React.useMemo(() => {
    const pos = positionsForDepartment(dept).find((p) => p.title === jabatan);
    return employeesForPosition(pos?.id).map((e) => ({ value: e.name, label: e.name }));
  }, [dept, jabatan]);

  const all = React.useMemo(() => (live ? [live, ...ASSESSMENTS] : ASSESSMENTS), [live]);
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
