"use client";

import * as React from "react";
import { Camera, Loader2, Save, SlidersHorizontal, TriangleAlert, Users } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Field, Input } from "@/components/ui/input";
import { MultiCombobox } from "@/components/ui/multi-combobox";
import { ScoreRing } from "@/components/ui/score-ring";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  creativeTeamOptionsAction,
  getCreativeKpiBoardAction,
  saveCreativeSettingsAction,
  saveSosmedMetricsAction,
} from "@/lib/actions/creative-kpi";
import type { CreativeKpiBoard } from "@/lib/data/creative-kpi";
import {
  CREATIVE_KPI_INDICATORS,
  CREATIVE_MONTHS,
  DEFAULT_CREATIVE_WEIGHTS,
  creativeKpiCategory,
  creativePeriod,
  creativePeriodLabel,
  fmtNum,
  type CreativeKpiKey,
  type SosmedMetrics,
} from "@/lib/creative-kpi";

const TONE_CLASS: Record<string, string> = {
  success: "text-emerald-600 dark:text-emerald-400",
  brand: "text-blue-600 dark:text-blue-400",
  warning: "text-amber-600 dark:text-amber-400",
  danger: "text-red-600 dark:text-red-400",
};

const pct = (n: number) => `${(Math.round(n * 100) / 100).toLocaleString("id-ID")}%`;

/** Nilai satu indikator: persen untuk Kecepatan, angka biasa untuk sisanya. */
const showVal = (unit: string, n: number) => (unit === "%" ? pct(n) : fmtNum(n));

function Panel({
  title,
  subtitle,
  action,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col rounded-2xl border border-border bg-card/40 p-4 sm:p-5", className)}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
          {subtitle && <p className="text-[11px] leading-relaxed text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

export function CreativeKpiBoardView({ canEdit }: { canEdit: boolean }) {
  const now = React.useMemo(() => new Date(), []);
  const [year, setYear] = React.useState(now.getFullYear());
  const [month, setMonth] = React.useState(now.getMonth());
  const [board, setBoard] = React.useState<CreativeKpiBoard | null>(null);
  const [loading, setLoading] = React.useState(true);
  const period = creativePeriod(year, month);

  const load = React.useCallback(async () => {
    setLoading(true);
    const res = await getCreativeKpiBoardAction(period);
    setLoading(false);
    if ("error" in res) return toast.error(res.error);
    setBoard(res);
  }, [period]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const cat = creativeKpiCategory(board?.score ?? 0);
  const years = React.useMemo(
    () => Array.from({ length: 4 }, (_, i) => now.getFullYear() - i).map((y) => ({ value: String(y), label: String(y) })),
    [now],
  );

  return (
    <div className="space-y-4">
      {/* Pemilih periode + aksi admin.
          Di HP keduanya berbagi satu baris penuh dan tombolnya turun ke baris
          sendiri — dijejalkan satu baris, tombolnya terpotong di layar 360px. */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex gap-2">
          <Combobox
            options={CREATIVE_MONTHS.map((m, i) => ({ value: String(i), label: m }))}
            value={String(month)}
            onChange={(v) => setMonth(Number(v))}
            className="flex-1 sm:w-40 sm:flex-none"
          />
          <Combobox
            options={years}
            value={String(year)}
            onChange={(v) => setYear(Number(v))}
            className="w-24 shrink-0 sm:w-28"
          />
        </div>
        {canEdit && board && (
          <div className="flex gap-2 sm:ml-auto">
            <MetricsSheet period={period} current={board.metrics} onSaved={load} />
            <SettingsSheet board={board} onSaved={load} />
          </div>
        )}
      </div>

      {loading && !board ? (
        <div className="flex items-center justify-center rounded-2xl border border-border py-24 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : !board ? (
        <p className="rounded-2xl border border-border py-24 text-center text-sm text-muted-foreground">
          KPI belum bisa dimuat.
        </p>
      ) : (
        <>
          {!board.hasBaseline && (
            <Notice tone="amber">
              Belum ada angka Instagram untuk <strong>{creativePeriodLabel(previousOf(period))}</strong>, jadi empat
              indikator Instagram belum punya target dan <strong>tidak ikut dinilai</strong> bulan ini. Skor dihitung
              dari indikator yang bisa dinilai saja. Isi angka bulan lalu untuk mengaktifkannya.
            </Notice>
          )}
          {board.withoutDeadline > 0 && (
            <Notice tone="red">
              <strong>{board.withoutDeadline} konten</strong> selesai tanpa deadline, jadi tidak bisa dinilai tepat
              waktu dan dikeluarkan dari perhitungan Kecepatan & Ketepatan. Isi deadline saat membuat pengajuan design —
              kalau tidak, indikator ini bisa dilewati begitu saja.
            </Notice>
          )}

          {/* Ringkasan skor */}
          <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
            <Panel title="Nilai Bulan Ini" subtitle={creativePeriodLabel(period)}>
              <div className="flex flex-1 flex-col items-center justify-center gap-3 py-2">
                {/* ScoreRing sudah menuliskan angkanya sendiri — labelnya diisi
                    satuan, bukan angka yang sama, supaya tidak terbaca "0 0%". */}
                <ScoreRing value={board.score} size={140} stroke={14} label="dari 100" />
                <Badge className={cn("text-xs font-bold", TONE_CLASS[cat.tone])}>{cat.label}</Badge>
                <p className="px-2 text-center text-[11px] leading-relaxed text-muted-foreground">{cat.action}</p>
              </div>
            </Panel>

            <Panel
              title="Rincian Indikator"
              subtitle="Capaian = realisasi ÷ target, dibatasi 100%. Nilai = capaian × bobot."
            >
              {/* HP: satu kartu per indikator. Tabel enam kolom di layar 360px
                  hanya menyisakan nama + bobot; Target/Aktual/Capaian — justru
                  angka yang dicari — hilang di balik gulir mendatar. */}
              <ul className="space-y-2 md:hidden">
                {board.rows.map((r) => (
                  <IndicatorCard key={r.indicator.key} r={r} />
                ))}
              </ul>

              {/* Layar lebar: tabel penuh, tanpa gulir. */}
              <table className="hidden w-full text-sm md:table">
                <thead>
                  <tr className="border-b border-border text-[10px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-2 py-2 text-left font-semibold">Indikator</th>
                    <th className="px-2 py-2 text-right font-semibold">Bobot</th>
                    <th className="px-2 py-2 text-right font-semibold">Target</th>
                    <th className="px-2 py-2 text-right font-semibold">Aktual</th>
                    <th className="px-2 py-2 text-right font-semibold">Capaian</th>
                    <th className="px-2 py-2 text-right font-semibold">Nilai</th>
                  </tr>
                </thead>
                <tbody>
                  {board.rows.map((r) => (
                    <tr
                      key={r.indicator.key}
                      className={cn("border-b border-border/60 last:border-0", !r.scored && "opacity-50")}
                      title={r.indicator.measure}
                    >
                      <td className="px-2 py-2">
                        <p className="font-medium text-foreground">{r.indicator.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {sourceLabel(r.indicator.source)}
                          {!r.scored && " · belum dinilai"}
                        </p>
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{r.weight}%</td>
                      <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">
                        {r.scored ? showVal(r.indicator.unit, r.target) : "—"}
                      </td>
                      <td className="px-2 py-2 text-right font-medium tabular-nums text-foreground">
                        {showVal(r.indicator.unit, r.realisasi)}
                      </td>
                      <td
                        className={cn(
                          "px-2 py-2 text-right font-semibold tabular-nums",
                          r.scored && TONE_CLASS[creativeKpiCategory(r.capaian).tone],
                        )}
                      >
                        {r.scored ? pct(r.capaian) : "—"}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums text-foreground">
                        {r.scored ? nilai(r.aktual) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Penutup dipisah dari tabel supaya bacaannya sama di HP maupun
                  desktop — di HP tidak ada <tfoot> yang bisa disandarkan. */}
              <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground">Total Skor</p>
                  <p className="text-[10px] leading-relaxed text-muted-foreground">
                    Dari {board.rows.filter((r) => r.scored).reduce((s, r) => s + r.weight, 0)}% bobot yang dinilai,
                    dinormalkan ke 100.
                  </p>
                </div>
                <span className={cn("shrink-0 text-lg font-bold tabular-nums", TONE_CLASS[cat.tone])}>
                  {pct(board.score)}
                </span>
              </div>
            </Panel>
          </div>

          {/* Sumbangan tiap orang */}
          <Panel
            title="Kontribusi Tim"
            subtitle="Dari pengajuan design yang PIC-nya orang ini dan selesai pada bulan berjalan."
          >
            {board.members.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">
                Belum ada pengajuan design Instagram yang selesai pada bulan ini.
              </p>
            ) : (
              <>
                {/* HP: kartu per orang. */}
                <ul className="space-y-2 md:hidden">
                  {board.members.map((m) => (
                    <MemberCard key={m.userId} m={m} />
                  ))}
                </ul>

                <table className="hidden w-full text-sm md:table">
                  <thead>
                    <tr className="border-b border-border text-[10px] uppercase tracking-wide text-muted-foreground">
                      <th className="px-2 py-2 text-left font-semibold">Nama</th>
                      <th className="px-2 py-2 text-right font-semibold">Post</th>
                      <th className="px-2 py-2 text-right font-semibold">Reels</th>
                      <th className="px-2 py-2 text-right font-semibold">Story</th>
                      <th className="px-2 py-2 text-right font-semibold">Total</th>
                      <th className="px-2 py-2 text-right font-semibold">Tepat Waktu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {board.members.map((m) => (
                      <tr key={m.userId} className="border-b border-border/60 last:border-0">
                        <td className="px-2 py-2 font-medium text-foreground">{m.name}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{m.post}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{m.reels}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{m.story}</td>
                        <td className="px-2 py-2 text-right font-semibold tabular-nums text-foreground">{m.total}</td>
                        <td className="px-2 py-2 text-right">
                          <span
                            className={cn("font-semibold tabular-nums", TONE_CLASS[creativeKpiCategory(m.onTimePct).tone])}
                          >
                            {m.onTime + m.late > 0 ? pct(m.onTimePct) : "—"}
                          </span>
                          <span className="ml-1 text-[10px] text-muted-foreground">
                            ({m.onTime}/{m.onTime + m.late})
                            {m.noDeadline > 0 && ` · ${m.noDeadline} tanpa deadline`}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}

function previousOf(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

const sourceLabel = (s: string) => (s === "instagram" ? "Instagram" : "Pengajuan Design");
const nilai = (n: number) => (Math.round(n * 100) / 100).toLocaleString("id-ID");

/**
 * Satu indikator sebagai kartu — tampilan HP.
 *
 * Angka yang dicari orang (target, aktual, capaian) berdiri sendiri dalam tiga
 * kolom, bukan disembunyikan di balik gulir mendatar seperti pada tabel.
 */
function IndicatorCard({ r }: { r: CreativeKpiBoard["rows"][number] }) {
  const tone = TONE_CLASS[creativeKpiCategory(r.capaian).tone];
  return (
    <li className={cn("rounded-xl border border-border p-3", !r.scored && "opacity-60")}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[13px] font-medium leading-snug text-foreground">{r.indicator.name}</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">{sourceLabel(r.indicator.source)}</p>
        </div>
        <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
          {r.weight}%
        </span>
      </div>

      {r.scored ? (
        <>
          <dl className="mt-2.5 grid grid-cols-3 gap-2 text-center">
            <CardStat label="Target" value={showVal(r.indicator.unit, r.target)} />
            <CardStat label="Aktual" value={showVal(r.indicator.unit, r.realisasi)} strong />
            <CardStat label="Capaian" value={pct(r.capaian)} className={tone} />
          </dl>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full",
                r.capaian >= 95
                  ? "bg-emerald-500"
                  : r.capaian >= 80
                    ? "bg-blue-500"
                    : r.capaian >= 65
                      ? "bg-amber-500"
                      : "bg-red-500",
              )}
              style={{ width: `${Math.max(Math.min(r.capaian, 100), 2)}%` }}
            />
          </div>
          <p className="mt-1.5 text-right text-[10px] text-muted-foreground">
            Nilai <span className="font-semibold text-foreground">{nilai(r.aktual)}</span> dari {r.weight}
          </p>
        </>
      ) : (
        <p className="mt-2 rounded-lg bg-muted/50 px-2 py-1.5 text-[10px] leading-relaxed text-muted-foreground">
          Belum dinilai — belum ada target untuk bulan ini.
        </p>
      )}
    </li>
  );
}

function CardStat({
  label,
  value,
  strong,
  className,
}: {
  label: string;
  value: string;
  strong?: boolean;
  className?: string;
}) {
  return (
    <div>
      <dt className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "mt-0.5 truncate text-sm tabular-nums",
          strong ? "font-semibold text-foreground" : "text-foreground/80",
          className,
        )}
      >
        {value}
      </dd>
    </div>
  );
}

/** Sumbangan satu orang sebagai kartu — tampilan HP. */
function MemberCard({ m }: { m: CreativeKpiBoard["members"][number] }) {
  const judged = m.onTime + m.late;
  return (
    <li className="rounded-xl border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-[13px] font-medium text-foreground">{m.name}</p>
        <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
          {m.total} konten
        </span>
      </div>
      <dl className="mt-2.5 grid grid-cols-3 gap-2 text-center">
        <CardStat label="Post" value={String(m.post)} strong />
        <CardStat label="Reels" value={String(m.reels)} strong />
        <CardStat label="Story" value={String(m.story)} strong />
      </dl>
      <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-border/60 pt-2">
        <span className="text-[10px] text-muted-foreground">
          Tepat waktu
          {judged > 0 && ` (${m.onTime}/${judged})`}
          {m.noDeadline > 0 && ` · ${m.noDeadline} tanpa deadline`}
        </span>
        <span
          className={cn("shrink-0 text-sm font-semibold tabular-nums", TONE_CLASS[creativeKpiCategory(m.onTimePct).tone])}
        >
          {judged > 0 ? pct(m.onTimePct) : "—"}
        </span>
      </div>
    </li>
  );
}

function Notice({ tone, children }: { tone: "amber" | "red"; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-xl border p-3 text-[11px] leading-relaxed",
        tone === "amber"
          ? "border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-300"
          : "border-red-500/40 bg-red-500/5 text-red-700 dark:text-red-300",
      )}
    >
      <TriangleAlert className="mt-px size-4 shrink-0" />
      <p>{children}</p>
    </div>
  );
}

/* ─────────────────────────── input angka Instagram ─────────────────────────── */

const METRIC_FIELDS: { key: keyof SosmedMetrics; label: string; hint: string }[] = [
  { key: "likes", label: "Like", hint: "Total like seluruh konten bulan ini" },
  { key: "comments", label: "Komentar", hint: "Total komentar" },
  { key: "shares", label: "Share", hint: "Total dibagikan" },
  { key: "saves", label: "Save", hint: "Total disimpan" },
  { key: "followerGrowth", label: "Follower Growth", hint: "PERTAMBAHAN bersih, bukan total follower" },
  { key: "views", label: "Views", hint: "Menggantikan Impressions sejak April 2025" },
  { key: "profileVisits", label: "Profile Visit", hint: "Kunjungan profil" },
];

function MetricsSheet({
  period,
  current,
  onSaved,
}: {
  period: string;
  current: SosmedMetrics;
  onSaved: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState<SosmedMetrics>(current);
  const [busy, setBusy] = React.useState(false);

  // Angka bisa berubah dari luar (ganti bulan) — samakan lagi saat dibuka.
  React.useEffect(() => {
    if (open) setForm(current);
  }, [open, current]);

  async function save() {
    setBusy(true);
    const res = await saveSosmedMetricsAction(period, form);
    setBusy(false);
    if (res.error) return toast.error(res.error);
    toast.success("Angka Instagram tersimpan");
    setOpen(false);
    onSaved();
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger>
        <Button variant="outline" size="sm">
          <Camera className="size-4" /> Angka Instagram
        </Button>
      </SheetTrigger>
      <SheetContent title={`Angka Instagram — ${creativePeriodLabel(period)}`}>
        <div className="space-y-3 px-5 pb-6">
          <p className="rounded-lg border border-border bg-muted/40 p-2.5 text-[11px] leading-relaxed text-muted-foreground">
            Diambil dari Instagram Insights, diisi sekali di akhir bulan. Meta hanya menyimpan data ini{" "}
            <strong>90 hari</strong> — begitu tersimpan di sini, angkanya jadi arsip tetap dan otomatis menjadi target
            bulan berikutnya (+10%).
          </p>
          {METRIC_FIELDS.map((f) => (
            <Field key={f.key} label={f.label} hint={f.hint}>
              <Input
                type="number"
                min={0}
                inputMode="numeric"
                value={String(form[f.key] ?? 0)}
                onChange={(e) => setForm((s) => ({ ...s, [f.key]: Math.max(0, Number(e.target.value) || 0) }))}
              />
            </Field>
          ))}
          <Button onClick={save} disabled={busy} className="w-full">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Simpan
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ─────────────────────────── pengaturan ─────────────────────────── */

function SettingsSheet({ board, onSaved }: { board: CreativeKpiBoard; onSaved: () => void }) {
  const [open, setOpen] = React.useState(false);
  const [teamIds, setTeamIds] = React.useState<string[]>(board.settings.teamIds);
  const [weights, setWeights] = React.useState<Record<CreativeKpiKey, number>>(board.settings.weights);
  const [people, setPeople] = React.useState<{ id: string; name: string; jabatan: string }[]>([]);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setTeamIds(board.settings.teamIds);
    setWeights(board.settings.weights);
    void creativeTeamOptionsAction().then(setPeople);
  }, [open, board.settings]);

  const total = Object.values(weights).reduce((a, b) => a + b, 0);

  async function save() {
    setBusy(true);
    const res = await saveCreativeSettingsAction({ teamIds, weights });
    setBusy(false);
    if (res.error) return toast.error(res.error);
    toast.success("Pengaturan tersimpan");
    setOpen(false);
    onSaved();
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger>
        <Button variant="outline" size="sm">
          <SlidersHorizontal className="size-4" /> Pengaturan
        </Button>
      </SheetTrigger>
      <SheetContent title="Pengaturan KPI Social Media">
        <div className="space-y-4 px-5 pb-6">
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <Users className="size-4" /> Tim Social Media
            </p>
            <p className="mb-2 text-[11px] leading-relaxed text-muted-foreground">
              Menentukan pengajuan design siapa saja yang dihitung. Bisa lintas departemen — Social Media & Digital
              Marketing ada di Marketing Communication, Graphic Designer & Videography di Creative.{" "}
              <strong>Kosong berarti semua PIC dihitung.</strong>
            </p>
            <MultiCombobox
              options={people.map((p) => ({ value: p.id, label: p.jabatan ? `${p.name} — ${p.jabatan}` : p.name }))}
              value={teamIds}
              onChange={setTeamIds}
              placeholder="Pilih anggota tim…"
              searchPlaceholder="Cari nama…"
              allLabel="Semua PIC"
            />
          </div>

          <div>
            <p className="mb-1.5 text-sm font-semibold text-foreground">Bobot Indikator</p>
            <p className="mb-2 text-[11px] leading-relaxed text-muted-foreground">
              Skor akhir selalu dinormalkan ke total bobot, jadi nilai 100 tetap bisa dicapai berapa pun totalnya.
            </p>
            <div className="space-y-1.5">
              {CREATIVE_KPI_INDICATORS.map((i) => (
                <div key={i.key} className="flex items-center gap-2">
                  <span className="flex-1 truncate text-xs text-foreground">{i.name}</span>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    inputMode="numeric"
                    className="w-20 text-right"
                    value={String(weights[i.key] ?? 0)}
                    onChange={(e) =>
                      setWeights((s) => ({
                        ...s,
                        [i.key]: Math.min(100, Math.max(0, Number(e.target.value) || 0)),
                      }))
                    }
                  />
                  <span className="w-4 text-xs text-muted-foreground">%</span>
                </div>
              ))}
            </div>
            <div className="mt-2 flex items-center justify-between rounded-lg border border-border bg-muted/40 px-2.5 py-2 text-xs">
              <span className="text-muted-foreground">Total bobot</span>
              <span className={cn("font-bold tabular-nums", total === 100 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400")}>
                {total}%
              </span>
            </div>
            {total !== 100 && (
              <p className="mt-1.5 text-[11px] leading-relaxed text-amber-600 dark:text-amber-400">
                Total belum 100% — skor tetap dihitung adil lewat normalisasi, tapi sisanya bisa dialokasikan ke
                indikator baru kapan saja.
              </p>
            )}
            <button
              type="button"
              onClick={() => setWeights({ ...DEFAULT_CREATIVE_WEIGHTS })}
              className="mt-2 text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              Kembalikan ke bobot awal
            </button>
          </div>

          <Button onClick={save} disabled={busy} className="w-full">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Simpan
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
