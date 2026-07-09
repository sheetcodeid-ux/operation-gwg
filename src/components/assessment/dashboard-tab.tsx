"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  CalendarClock,
  CheckCircle2,
  Circle,
  ClipboardList,
  PenLine,
  RotateCcw,
  Trash2,
  TriangleAlert,
  UserSearch,
  XCircle,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { departmentOptions, employeesForPosition, formatGolongan, positionsForDepartment } from "@/lib/assessment/org";
import { ASSESSMENTS, LATEST_ASSESSMENTS, computeResult, historyFor, sessionToEnriched, type EnrichedRecord, type RecoKind, type ResultBundle } from "@/lib/assessment/result";
import { deleteSession, listAllSessions } from "@/lib/actions/assessment";
import { HASIL_META, HASIL_OPTIONS, type AssessmentRecord, type HasilStatus } from "@/lib/assessment/records";
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

const RECO: Record<RecoKind, { icon: LucideIcon; cls: string }> = {
  success: { icon: CheckCircle2, cls: "text-brand-500" },
  info: { icon: ClipboardList, cls: "text-sky-500" },
  action: { icon: PenLine, cls: "text-foreground/70" },
  warning: { icon: TriangleAlert, cls: "text-amber-500" },
  danger: { icon: XCircle, cls: "text-red-500" },
  fast: { icon: Zap, cls: "text-violet-500" },
  schedule: { icon: CalendarClock, cls: "text-muted-foreground" },
};

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
  const jabOpts = React.useMemo(() => positionsForDepartment(dDept).map((p) => ({ value: p.title, label: p.title })), [dDept]);
  const namaOpts = React.useMemo(() => {
    const pos = positionsForDepartment(dDept).find((p) => p.title === dJab);
    return employeesForPosition(pos?.id).map((e) => ({ value: e.name, label: e.name }));
  }, [dDept, dJab]);

  // Live server-backed sessions (all evaluators, cross-device) — polled.
  const [dbRecords, setDbRecords] = React.useState<EnrichedRecord[]>([]);
  const reload = React.useCallback(
    () =>
      listAllSessions()
        .then((ss) => setDbRecords(ss.map(sessionToEnriched)))
        .catch(() => {}),
    [],
  );
  React.useEffect(() => {
    let cancelled = false;
    const load = () => {
      if (!cancelled) void reload();
    };
    load();
    const t = setInterval(load, 8000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [reload]);

  // Admin-only delete — removes from the shared DB, so it disappears for all users.
  const liveIds = React.useMemo(() => new Set(dbRecords.map((r) => r.id)), [dbRecords]);
  const handleDelete = React.useCallback(
    async (id: string, name: string) => {
      if (typeof window !== "undefined" && !window.confirm(`Hapus assessment "${name}" untuk semua pengguna? Tindakan ini tidak dapat dibatalkan.`)) return;
      setDbRecords((rs) => rs.filter((r) => r.id !== id)); // optimistic
      const res = await deleteSession(id);
      if (!res.ok && typeof window !== "undefined") window.alert(res.error ?? "Gagal menghapus.");
      void reload();
    },
    [reload],
  );

  // Sample data is demo-only; production (DB live) shows real sessions alone.
  const sampleAll = a.showSample ? ASSESSMENTS : [];
  const sampleLatest = a.showSample ? LATEST_ASSESSMENTS : [];

  const selectedRecord = React.useMemo(
    () => (dNama ? dbRecords.find((r) => r.name === dNama) ?? (a.showSample ? historyFor(dNama)[0] : undefined) ?? null : null),
    [dNama, dbRecords, a.showSample],
  );
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
  };

  return (
    <div className="space-y-4">
      <SectionLabel>Ringkasan Batch (Tracking)</SectionLabel>
      <BatchTracking live={liveRecord} extra={dbRecords} sample={sampleLatest} />

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
            }}
            options={jabOpts}
            placeholder={dDept ? "Pilih jabatan…" : "Pilih departemen dulu"}
            disabled={!dDept}
          />
          <Dropdown
            label="Nama Karyawan"
            searchable
            value={dNama}
            onChange={setDNama}
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
        <IndividualResult bundle={bundle} subject={subject} editable={editable} reportRecord={selectedRecord ?? liveRecord!} />
      ) : (
        <EmptyState
          icon={UserSearch}
          title="Belum ada karyawan dipilih"
          description="Pilih karyawan di atas untuk melihat hasil, atau pilih karyawan yang dinilai di tab Penilaian."
        />
      )}

      <SectionLabel>Seluruh Data Assessment</SectionLabel>
      <AllAssessmentsTable
        live={liveRecord}
        extra={dbRecords}
        sample={sampleAll}
        canDelete={a.canSwitchRole}
        liveIds={liveIds}
        onDelete={handleDelete}
      />
    </div>
  );
}

const BAR_BG: Record<string, string> = { fast: "bg-violet-500", ok: "bg-brand-500", wait: "bg-amber-500", no: "bg-red-500" };
const DIST_ORDER: HasilStatus[] = ["fast_track", "layak", "ditunda", "tidak_layak"];

/** Batch-wide tracking tiles + outcome distribution — automatic, precise counts. */
function BatchTracking({ live, extra = [], sample = [] }: { live: AssessmentRecord | null; extra?: EnrichedRecord[]; sample?: EnrichedRecord[] }) {
  const all = [...(live ? [live] : []), ...extra, ...sample];
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
}: {
  bundle: ResultBundle;
  subject: Subject;
  editable: boolean;
  reportRecord: AssessmentRecord;
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
                {e.done ? <CheckCircle2 className="size-3" /> : <Circle className="size-3" />} {e.name} · {e.filled}/6
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
        <Banner tone={b.gapWajib ? "danger" : "amber"} icon={<Zap className="size-4" />}>
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
                {p.gapFlag && <TriangleAlert className="size-3.5 text-amber-500" />}
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
          {b.recommendations.map((r, i) => {
            const { icon: Icon, cls } = RECO[r.kind];
            return (
              <li key={i} className="flex gap-3 text-sm leading-relaxed">
                <Icon className={cn("mt-0.5 size-4 shrink-0", cls)} />
                <span className="text-muted-foreground">{r.text}</span>
              </li>
            );
          })}
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
                    {r.gap > 0 ? `+${r.gap}` : r.gap}
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

/** Data table of every assessment, with cascading Departemen → Jabatan → Nama + Status filters. */
function AllAssessmentsTable({
  live,
  extra = [],
  sample = [],
  canDelete = false,
  liveIds,
  onDelete,
}: {
  live: AssessmentRecord | null;
  extra?: EnrichedRecord[];
  sample?: EnrichedRecord[];
  canDelete?: boolean;
  liveIds?: Set<string>;
  onDelete?: (id: string, name: string) => void;
}) {
  const [dept, setDept] = React.useState("");
  const [jabatan, setJabatan] = React.useState("");
  const [nama, setNama] = React.useState("");
  const [hasil, setHasil] = React.useState("");

  const jabatanOptions = React.useMemo(() => positionsForDepartment(dept).map((p) => ({ value: p.title, label: p.title })), [dept]);
  const namaOptions = React.useMemo(() => {
    const pos = positionsForDepartment(dept).find((p) => p.title === jabatan);
    return employeesForPosition(pos?.id).map((e) => ({ value: e.name, label: e.name }));
  }, [dept, jabatan]);

  const all = React.useMemo(() => [...(live ? [live] : []), ...extra, ...sample], [live, extra, sample]);
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
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const rec = row.original;
          const deletable = canDelete && liveIds?.has(rec.id);
          return (
            <div className="flex items-center justify-end gap-1">
              <ReportButton record={rec} />
              {deletable && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-600 hover:bg-red-500/10 hover:text-red-600 dark:text-red-400"
                  title="Hapus assessment (untuk semua pengguna)"
                  onClick={() => onDelete?.(rec.id, rec.name)}
                >
                  <Trash2 className="size-4" />
                </Button>
              )}
            </div>
          );
        },
      },
    ],
    [canDelete, liveIds, onDelete],
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
          searchable
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
