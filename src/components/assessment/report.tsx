"use client";

import * as React from "react";
import { FileText, Moon, Printer, Sun } from "lucide-react";
import { HASIL_META, type AssessmentRecord, type EvaluatorBreakdown } from "@/lib/assessment/records";
import { DIRECTOR_ONLY_POSITIONS } from "@/lib/assessment/config";
import { DIRECTOR_NAME, HR_NAME } from "@/lib/assessment/access";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type ReportMode = "terang" | "gelap";

const THEME: Record<ReportMode, { bg: string; card: string; text: string; sub: string; border: string; band: string; bandText: string; accent: string }> = {
  terang: {
    bg: "#f5f6f8",
    card: "#ffffff",
    text: "#1a1d21",
    sub: "#6b7280",
    border: "#e5e7eb",
    band: "#111827",
    bandText: "#ffffff",
    accent: "#16a34a",
  },
  gelap: {
    bg: "#0f1115",
    card: "#181b20",
    text: "#f3f4f6",
    sub: "#9ca3af",
    border: "#2a2e35",
    band: "#0b0d10",
    bandText: "#f3f4f6",
    accent: "#22c55e",
  },
};

const HASIL_COLOR: Record<string, string> = {
  no: "#ef4444",
  wait: "#f59e0b",
  ok: "#16a34a",
  fast: "#8b5cf6",
};

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(+d)) return iso;
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

/** Evaluator cards for the report — Director-only positions carry a single card. */
function reportEvaluators(r: AssessmentRecord): EvaluatorBreakdown[] {
  if (r.evaluators?.length) return r.evaluators;
  const directorOnly = /^head/i.test(r.jabatan) || DIRECTOR_ONLY_POSITIONS.includes(r.jabatan);
  if (directorOnly) return [{ name: "Director", weight: 100, score: r.finalScore }];
  return [
    { name: "Atasan Langsung", weight: 40, score: r.finalScore },
    { name: "HC / Human Capital", weight: 35, score: r.finalScore },
    { name: "Director", weight: 25, score: r.finalScore },
  ];
}

/** Build a fully self-contained, print-ready HTML document for a report. */
function buildReportHtml(r: AssessmentRecord, mode: ReportMode): string {
  const t = THEME[mode];
  const hasil = HASIL_META[r.hasil];
  const hasilColor = HASIL_COLOR[hasil.tone];
  const today = fmtDate(new Date().toISOString());

  const row = (label: string, value: string) => `
    <div style="display:flex;justify-content:space-between;gap:16px;padding:9px 0;border-bottom:1px solid ${t.border}">
      <span style="color:${t.sub};font-size:12.5px">${label}</span>
      <span style="color:${t.text};font-size:12.5px;font-weight:600;text-align:right">${value || "—"}</span>
    </div>`;

  const evals = reportEvaluators(r);
  const evalCards = evals
    .map(
      (e) => `
    <div style="flex:1;min-width:130px;background:${mode === "gelap" ? "#12151a" : "#f9fafb"};border:1px solid ${t.border};border-radius:10px;padding:12px 14px">
      <div style="color:${t.sub};font-size:11px">${e.name} · ${e.weight}%</div>
      <div style="color:${t.text};font-size:22px;font-weight:800;margin-top:4px">${e.score.toFixed(1)}</div>
      <div style="color:${t.sub};font-size:10.5px;margin-top:2px">Kontribusi: ${((e.score * e.weight) / 100).toFixed(1)} poin</div>
    </div>`,
    )
    .join("");

  const sign = (title: string, name: string) => `
    <div style="text-align:center;flex:1">
      <div style="color:${t.sub};font-size:11px;margin-bottom:44px">${title}</div>
      <div style="border-top:1px solid ${t.text};margin:0 8px;padding-top:6px;color:${t.text};font-size:12px;font-weight:600">${name}</div>
    </div>`;

  return `<!doctype html><html lang="id"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Laporan Assessment — ${r.name}</title>
<style>
  * { box-sizing:border-box; margin:0; padding:0; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  body { font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; background:${t.bg}; color:${t.text}; padding:24px; }
  .sheet { max-width:800px; margin:0 auto; background:${t.card}; border:1px solid ${t.border}; border-radius:16px; overflow:hidden; }
  .band { background:${t.band}; color:${t.bandText}; padding:22px 28px; display:flex; justify-content:space-between; align-items:center; }
  .band h1 { font-size:18px; font-weight:700; letter-spacing:-0.01em; }
  .band p { font-size:12px; opacity:0.7; margin-top:3px; }
  .body { padding:24px 28px; }
  .sec-title { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; color:${t.sub}; margin:22px 0 8px; }
  .sec-title:first-child { margin-top:0; }
  .grid2 { display:grid; grid-template-columns:1fr 1fr; gap:0 32px; }
  .scorebox { display:flex; align-items:center; justify-content:space-between; gap:16px; background:${mode === "gelap" ? "#12151a" : "#f9fafb"}; border:1px solid ${t.border}; border-radius:12px; padding:18px 20px; }
  .score { font-size:40px; font-weight:800; color:${t.text}; line-height:1; }
  .badge { display:inline-block; padding:6px 14px; border-radius:999px; font-size:12.5px; font-weight:700; color:#fff; background:${hasilColor}; }
  .signs { display:flex; gap:12px; margin-top:36px; }
  .foot { margin-top:22px; padding-top:14px; border-top:1px solid ${t.border}; color:${t.sub}; font-size:11px; display:flex; justify-content:space-between; }
  @media print { body { background:#fff; padding:0; } .sheet { border:none; border-radius:0; max-width:none; } .noprint { display:none !important; } }
</style></head><body>
  <div class="sheet">
    <div class="band">
      <div><h1>Laporan Hasil Assessment Kenaikan Golongan</h1><p>Operation GWG · Human Resources Development</p></div>
      <div style="text-align:right"><p style="opacity:0.85;font-size:12px">${r.batch}</p><p>${fmtDate(r.tanggal)}</p></div>
    </div>
    <div class="body">
      <div class="sec-title">Identitas Karyawan</div>
      <div class="grid2">
        <div>${row("Nama Lengkap", r.name)}${row("NIK / ID Karyawan", r.nik)}${row("Departemen", r.departmentName)}</div>
        <div>${row("Jabatan", r.jabatan)}${row("Golongan Saat Ini", r.golongan)}${row("Golongan Tujuan", r.golonganTujuan)}</div>
      </div>

      <div class="sec-title">Nilai Assessment</div>
      <div class="scorebox">
        <div>
          <div style="color:${t.sub};font-size:12px;margin-bottom:4px">Skor Final</div>
          <div class="score">${r.finalScore.toFixed(1)}<span style="font-size:16px;color:${t.sub}">/100</span></div>
        </div>
        <span class="badge">${hasil.label}</span>
      </div>

      <div class="sec-title">Rincian Penilai (Bobot)</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">${evalCards}</div>

      <div class="sec-title">Hasil Interview</div>
      <div style="color:${t.text};font-size:13px;padding:4px 0">${r.interviewResult}</div>

      <div class="sec-title">Keputusan Akhir</div>
      <div style="color:${t.text};font-size:13px;line-height:1.6;padding:4px 0">${r.decision}</div>

      <div class="signs">
        ${sign("Penilai", r.penilai.split(",")[0].trim())}
        ${sign("Human Resource", HR_NAME)}
        ${sign("Director", DIRECTOR_NAME)}
      </div>

      <div class="foot"><span>Dokumen ini dihasilkan otomatis oleh Sistem Assessment GWG.</span><span>Dicetak: ${today}</span></div>
    </div>
  </div>
</body></html>`;
}

/** Report dialog: pick a theme, preview, then print / save as PDF. */
export function ReportModal({
  record,
  open,
  onOpenChange,
}: {
  record: AssessmentRecord | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [mode, setMode] = React.useState<ReportMode | null>(null);

  React.useEffect(() => {
    if (!open) setMode(null);
  }, [open]);

  const html = record && mode ? buildReportHtml(record, mode) : "";

  function print() {
    if (!html) return;
    const w = window.open("", "_blank", "width=900,height=1200");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    // Give the new document a tick to lay out before invoking print.
    setTimeout(() => w.print(), 250);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Report Assessment"
        description={record ? `${record.name} · ${record.jabatan}` : undefined}
        className="max-w-3xl"
      >
        {!mode ? (
          <div className="p-6">
            <p className="mb-4 text-sm text-muted-foreground">Pilih mode tampilan report:</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setMode("terang")}
                className="flex flex-col items-center gap-2 rounded-xl border border-border bg-white p-6 text-gray-900 transition-colors hover:border-foreground/40"
              >
                <Sun className="size-7" />
                <span className="text-sm font-semibold">Mode Terang</span>
              </button>
              <button
                type="button"
                onClick={() => setMode("gelap")}
                className="flex flex-col items-center gap-2 rounded-xl border border-border bg-[#0f1115] p-6 text-gray-100 transition-colors hover:border-foreground/40"
              >
                <Moon className="size-7" />
                <span className="text-sm font-semibold">Mode Gelap</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex h-[70vh] flex-col">
            <div className="flex items-center justify-between gap-2 border-b border-border p-3">
              <div className="inline-flex gap-1 rounded-lg border border-border bg-muted/50 p-1">
                <ModeChip active={mode === "terang"} onClick={() => setMode("terang")} icon={<Sun className="size-3.5" />} label="Terang" />
                <ModeChip active={mode === "gelap"} onClick={() => setMode("gelap")} icon={<Moon className="size-3.5" />} label="Gelap" />
              </div>
              <Button onClick={print}>
                <Printer className="size-4" /> Cetak / Simpan PDF
              </Button>
            </div>
            <iframe title="Preview Report" srcDoc={html} className="min-h-0 flex-1 rounded-b-xl bg-white" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ModeChip({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
        active ? "bg-background text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

/** Small button that opens the report modal for a given record. */
export function ReportButton({ record }: { record: AssessmentRecord }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <FileText className="size-3.5" /> Report
      </Button>
      <ReportModal record={record} open={open} onOpenChange={setOpen} />
    </>
  );
}
