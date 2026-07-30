"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Award, BadgeCheck, CheckCircle2, ClipboardList, GraduationCap, Loader2, TrendingUp, TriangleAlert, Users } from "lucide-react";
import { toast } from "sonner";
import { AUDIT_ACTION_LABEL, AUDIT_ENTITY_LABEL, LEARNER_STATUS_META, type ElearningAuditRow, type ElearningDashboard, type EssayReviewItem, type ParticipantRow } from "@/lib/elearning-shared";
import { markEssayPassedAction } from "@/lib/actions/elearning";
import { cn, fromNow } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { StatTile } from "@/components/ui/stat";
import { ManageElearning } from "./manage";
import type { ELearningCourse, ELearningDay } from "@/lib/elearning-shared";

interface CertRow {
  number: string;
  recipientName: string;
  issuedAt: string;
}

export function KelolaShell({
  course,
  days,
  dashboard,
  participants,
  essays,
  certificates,
  audit = [],
}: {
  course: ELearningCourse | null;
  days: ELearningDay[];
  dashboard: ElearningDashboard | null;
  participants: ParticipantRow[];
  essays: EssayReviewItem[];
  certificates: CertRow[];
  audit?: ElearningAuditRow[];
}) {
  const [tab, setTab] = React.useState("materi");
  return (
    <div className="space-y-4">
      <SegmentedTabs
        value={tab}
        onChange={setTab}
        items={[
          { value: "materi", label: "Kelola Materi" },
          { value: "dashboard", label: "Dashboard & Peserta" },
        ]}
      />
      {tab === "materi" ? (
        <ManageElearning course={course} days={days} />
      ) : dashboard ? (
        <DashboardView dashboard={dashboard} participants={participants} essays={essays} certificates={certificates} audit={audit} />
      ) : (
        <p className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">Buat course & materi dulu untuk melihat dashboard.</p>
      )}
    </div>
  );
}

function DashboardView({ dashboard, participants, essays, certificates, audit }: { dashboard: ElearningDashboard; participants: ParticipantRow[]; essays: EssayReviewItem[]; certificates: CertRow[]; audit: ElearningAuditRow[] }) {
  const d = dashboard;
  const topStudied = [...d.lessonStats].sort((a, b) => b.studied - a.studied).slice(0, 5);
  const hardest = [...d.lessonStats].filter((l) => l.failCount > 0).sort((a, b) => b.failCount - a.failCount).slice(0, 5);
  const notFinished = participants.filter((p) => p.pct < 100);

  return (
    <div className="space-y-4">
      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={Users} label="Total Peserta" value={d.totalLearners} sub={`${d.started} sudah mulai`} />
        <StatTile icon={CheckCircle2} label="Selesai" value={d.completed} sub={`${d.passRate}% kelulusan`} />
        <StatTile icon={TrendingUp} label="Rata-rata Nilai" value={d.avgScore} sub="assessment" />
        <StatTile icon={Award} label="Sertifikat Terbit" value={certificates.length} sub="peserta lulus" />
      </div>

      {/* Activity chart */}
      <div className="card-gradient rounded-2xl p-4">
        <p className="mb-3 text-sm font-semibold text-foreground">Aktivitas 30 Hari Terakhir</p>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={d.activity} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="gA" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--color-brand-500)" stopOpacity={0.4} /><stop offset="100%" stopColor="var(--color-brand-500)" stopOpacity={0} /></linearGradient>
                <linearGradient id="gB" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.35} /><stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} /></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="date" tickFormatter={(v: string) => v.slice(8)} tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} interval={4} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid var(--color-border)", background: "var(--color-card)" }} labelFormatter={(v) => `Tanggal ${v}`} />
              <Area type="monotone" dataKey="attempts" name="Percobaan Assessment" stroke="#8b5cf6" fill="url(#gB)" strokeWidth={2} />
              <Area type="monotone" dataKey="completions" name="Materi Selesai" stroke="var(--color-brand-500)" fill="url(#gA)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Lesson insights */}
      <div className="grid gap-3 lg:grid-cols-2">
        <ListCard title="Materi Paling Banyak Dipelajari" icon={GraduationCap} rows={topStudied.map((l) => ({ label: l.title, value: `${l.studied} peserta`, sub: `${l.completed} selesai` }))} empty="Belum ada aktivitas." />
        <ListCard title="Materi Tersulit (sering gagal)" icon={TriangleAlert} rows={hardest.map((l) => ({ label: l.title, value: `${l.failCount}×`, sub: "gagal" }))} empty="Belum ada kegagalan assessment." />
      </div>

      {/* Essay review */}
      {essays.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground"><ClipboardList className="size-4 text-amber-500" /> Essay Perlu Dinilai ({essays.length})</p>
          <div className="space-y-2">
            {essays.map((e) => <EssayCard key={e.resultId} essay={e} />)}
          </div>
        </div>
      )}

      {/* Participants */}
      <div className="card-gradient rounded-2xl p-4">
        <p className="mb-3 text-sm font-semibold text-foreground">Progres Peserta ({participants.length})</p>
        {participants.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">Belum ada peserta (Coordinator Area).</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Nama</th>
                  <th className="px-3 font-medium">Progres</th>
                  <th className="px-3 font-medium">Status</th>
                  <th className="px-3 font-medium">Nilai</th>
                  <th className="px-3 font-medium">Sertifikat</th>
                </tr>
              </thead>
              <tbody>
                {participants.map((p) => {
                  const st = LEARNER_STATUS_META[p.status];
                  return (
                    <tr key={p.userId} className="border-b border-border/60">
                      <td className="py-2 pr-3">
                        <p className="font-medium text-foreground">{p.name}</p>
                        {p.jabatan && <p className="text-[11px] text-muted-foreground">{p.jabatan}</p>}
                      </td>
                      <td className="px-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-brand-500" style={{ width: `${p.pct}%` }} /></div>
                          <span className="tabular-nums text-xs text-muted-foreground">{p.pct}%</span>
                        </div>
                        <span className="text-[11px] text-muted-foreground">{p.completedLessons}/{p.totalLessons} materi</span>
                      </td>
                      <td className="px-3"><Badge tone={st.tone}>{st.label}</Badge></td>
                      <td className="px-3 tabular-nums text-foreground">{p.avgScore ?? "—"}</td>
                      <td className="px-3">{p.certified ? <BadgeCheck className="size-4 text-brand-500" /> : <span className="text-xs text-muted-foreground">—</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {notFinished.length > 0 && (
          <p className="mt-3 text-xs text-muted-foreground"><span className="font-medium text-amber-600 dark:text-amber-400">{notFinished.length} peserta</span> belum menyelesaikan pembelajaran.</p>
        )}
      </div>

      {/* Certificates */}
      {certificates.length > 0 && (
        <div className="card-gradient rounded-2xl p-4">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground"><Award className="size-4 text-violet-500" /> Sertifikat Terbit ({certificates.length})</p>
          <div className="space-y-1.5">
            {certificates.map((c) => (
              <div key={c.number} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-background/40 p-2.5 text-sm">
                <div>
                  <span className="font-medium text-foreground">{c.recipientName}</span>
                  <span className="ml-2 font-mono text-[11px] text-muted-foreground">{c.number}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-muted-foreground">{new Date(c.issuedAt).toLocaleDateString("id-ID")}</span>
                  <Link href={`/elearning/verify/${encodeURIComponent(c.number)}`} className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400">Validasi</Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Audit log — every material change (append-only) */}
      {audit.length > 0 && (
        <div className="card-gradient rounded-2xl p-4">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground"><ClipboardList className="size-4 text-muted-foreground" /> Audit Perubahan Materi</p>
          <div className="max-h-72 space-y-1 overflow-y-auto">
            {audit.map((a) => (
              <div key={a.id} className="flex items-center gap-2 border-b border-border/50 py-1.5 text-xs last:border-0">
                <Badge tone={a.action === "delete" ? "danger" : a.action === "create" ? "success" : "neutral"}>{AUDIT_ACTION_LABEL[a.action]}</Badge>
                <span className="text-muted-foreground">{AUDIT_ENTITY_LABEL[a.entity]}</span>
                <span className="min-w-0 flex-1 truncate text-foreground">{a.title}</span>
                <span className="shrink-0 text-muted-foreground">{a.actorName}</span>
                <span className="shrink-0 text-muted-foreground/70">{fromNow(a.at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function EssayCard({ essay }: { essay: EssayReviewItem }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const pass = () => {
    setBusy(true);
    markEssayPassedAction(essay.resultId)
      .then((r) => {
        if (r?.error) return toast.error(r.error);
        toast.success("Ditandai lulus.");
        router.refresh();
      })
      .finally(() => setBusy(false));
  };
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">{essay.learnerName} · <span className="text-muted-foreground">{essay.lessonTitle}</span></p>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground">Skor objektif {essay.score}</span>
          <Button size="sm" onClick={pass} disabled={busy}>{busy ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} Luluskan</Button>
        </div>
      </div>
      <div className="mt-2 space-y-1.5">
        {essay.answers.map((a, i) => (
          <div key={i} className="rounded-md bg-muted/40 p-2">
            <p className="text-[11px] font-medium text-muted-foreground">{a.prompt}</p>
            <p className="mt-0.5 whitespace-pre-line text-sm text-foreground">{a.answer}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ListCard({ title, icon: Icon, rows, empty }: { title: string; icon: React.ComponentType<{ className?: string }>; rows: { label: string; value: string; sub: string }[]; empty: string }) {
  return (
    <div className="card-gradient rounded-2xl p-4">
      <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground"><Icon className="size-4 text-muted-foreground" /> {title}</p>
      {rows.length === 0 ? (
        <p className="py-4 text-center text-xs text-muted-foreground">{empty}</p>
      ) : (
        <div className="space-y-1.5">
          {rows.map((r, i) => (
            <div key={i} className="flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0 flex-1 truncate text-foreground">{r.label}</span>
              <span className="shrink-0 text-right"><span className="font-semibold tabular-nums text-foreground">{r.value}</span> <span className="text-[11px] text-muted-foreground">{r.sub}</span></span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
