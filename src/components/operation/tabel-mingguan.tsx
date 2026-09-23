"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, TriangleAlert } from "lucide-react";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { cn, formatIDR, formatIDRShort, formatNumber } from "@/lib/utils";
import { rentangMingguan, type AlasanTakTahu, type Terukur } from "@/lib/ops/mingguan";
import type { AlasanTidakLayak, Keyakinan, StatusBukti } from "@/lib/ops/bukti";
import type { DetailMingguan } from "@/lib/data/mingguan-performa";
import type { PilihanArea } from "@/lib/data/daily-outlet";

/**
 * WEEKLY PERFORMANCE — tabelnya.
 *
 * ┌─ TIDAK ADA SATU KOLOM TARGET PUN DI SUMBU MINGGU ────────────────────────┐
 * │                                                                          │
 * │ Tidak ada "Target", tidak ada "Capaian", tidak ada "Kurang", tidak ada   │
 * │ "Kejar". Keempatnya ada di halaman Daily dan Monthly karena di sana      │
 * │ targetnya memang bulanan; di sumbu minggu keempatnya hanya bisa lahir    │
 * │ dari membagi target bulanan, dan itu yang dikunci Gate M.                │
 * │                                                                          │
 * │ Monthly Target tetap tampil — di blok terpisah, berlabel bulan, tanpa    │
 * │ satu pun persentase yang membandingkannya dengan angka minggu.           │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ SIGNAL BULAN BERJALAN ADALAH INDIKASI (AD-17 · Z-03) ───────────────────┐
 * │                                                                          │
 * │ Owner mengunci Signal bulan berjalan sebagai EARLY WARNING, bukan hasil  │
 * │ bulan penuh. Alasannya ada di angkanya sendiri: penyebut rasio biaya     │
 * │ datang harian dari ESB dan bertambah tiap hari, sementara pembilangnya   │
 * │ satu baris per BULAN di `op_expenses`/`op_purchases`/`op_pnl` yang tidak │
 * │ punya satu kolom pun untuk menyatakan berapa hari yang dicakupnya.       │
 * │                                                                          │
 * │ Akibatnya berjalan DUA ARAH, dan itu sebabnya layar ini tidak boleh      │
 * │ menyimpulkan apa pun: rasio yang pembilangnya sudah sebulan terbaca      │
 * │ terlalu tinggi, dan rasio yang pembilangnya baru sebagian terbaca        │
 * │ terlalu rendah — yang kedua membuat Signal HILANG tanpa meninggalkan     │
 * │ jejak apa pun di layar.                                                  │
 * │                                                                          │
 * │ Karena itu: sel kosong tidak pernah berbunyi "tidak ada", dan badge      │
 * │ bulan berjalan selalu bertanda MTD.                                      │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ YANG TIDAK DIKETAHUI DITULIS APA ADANYA ────────────────────────────────┐
 * │                                                                          │
 * │ Bukan "—", bukan "0", bukan sel kosong. Sel yang tidak diketahui memuat  │
 * │ ALASANNYA, dan alasan itu yang memberi tahu apa yang harus dikerjakan:   │
 * │ menunggu cron, memasangkan cabang, atau memeriksa outlet yang struknya   │
 * │ nol. "—" menyuruh yang membacanya menebak, dan tebakan yang paling       │
 * │ sering diambil adalah nol.                                               │
 * └──────────────────────────────────────────────────────────────────────────┘
 */

/* ───────────────────────────── ketidaktahuan ───────────────────────────── */

const LABEL_ALASAN: Record<AlasanTakTahu, string> = {
  data_tidak_tersedia: "belum ada data",
  tanpa_cabang: "belum ada cabang",
  tanpa_minggu_sebelumnya: "tanpa pembanding",
  penyebut_tidak_sah: "pembagi tidak sah",
  tanpa_struk: "tanpa struk",
  tanpa_target: "belum ada target",
  sumber_tidak_sah: "sumber tidak sah",
};

const SEBAB_ALASAN: Record<AlasanTakTahu, string> = {
  data_tidak_tersedia: "Barisnya belum ada di esb_net_mingguan, atau kolomnya kosong. Bukan berarti tidak berjualan.",
  tanpa_cabang: "Outlet ini belum dipasangkan ke cabang ESB, jadi tidak pernah terukur mingguan. Pasangkan di Administrator → Manajemen Outlet.",
  tanpa_minggu_sebelumnya: "Tidak ada minggu sebelumnya yang bisa dijadikan pembanding.",
  penyebut_tidak_sah: "Pembaginya nol atau negatif, jadi hasilnya tidak bisa dihitung.",
  tanpa_struk: "Jumlah struk minggu ini nol. Mungkin outletnya memang tutup, mungkin datanya belum masuk — keduanya menuntut pemeriksaan, bukan angka.",
  tanpa_target: "Outlet ini belum genap tiga bulan berjalan, jadi memang belum punya target bulanan.",
  sumber_tidak_sah: "Angka ESB bulan ini sudah ditandai tidak berlaku bagi outlet ini (esb_mulai / esb_abaikan).",
};

/** Sel yang tidak diketahui — alasannya tampil, sebabnya di tooltip. */
function TakTahu({ alasan }: { alasan: AlasanTakTahu }) {
  return (
    <span
      title={SEBAB_ALASAN[alasan]}
      className="cursor-help text-[11px] font-medium italic text-muted-foreground/70 decoration-dotted underline-offset-2 hover:underline"
    >
      {LABEL_ALASAN[alasan]}
    </span>
  );
}

/** Angka kalau diketahui, alasan kalau tidak. Satu pintu untuk seluruh sel. */
function Nilai({ t, render }: { t: Terukur; render: (n: number) => React.ReactNode }) {
  if (!t.diketahui) return <TakTahu alasan={t.alasan} />;
  return <>{render(t.nilai)}</>;
}

/* ───────────────────────────── mode kolom ───────────────────────────── */

type Mode = "sales" | "tumbuh" | "pax" | "bills" | "rata";

const MODE: { value: Mode; label: string }[] = [
  { value: "sales", label: "Net Sales" },
  { value: "tumbuh", label: "Pertumbuhan" },
  { value: "pax", label: "Pax" },
  { value: "bills", label: "Struk" },
  { value: "rata", label: "Rata Transaksi" },
];

const persen = (n: number) => `${n > 0 ? "+" : ""}${formatNumber(n, { maximumFractionDigits: 1 })}%`;

const warnaTumbuh = (n: number) =>
  n > 0 ? "text-emerald-600 dark:text-emerald-400" : n < 0 ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground";

/* ───────────────────────────── bukti & tindakan ───────────────────────────── */

const WARNA_BUKTI: Record<StatusBukti, string> = {
  SUPPORTED: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  NOT_SUPPORTED: "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-400",
  UNKNOWN: "border-border bg-muted/60 text-muted-foreground",
};

const WARNA_YAKIN: Record<Keyakinan, string> = {
  HIGH: "text-emerald-600 dark:text-emerald-400",
  MEDIUM: "text-amber-600 dark:text-amber-400",
  LOW: "text-muted-foreground",
};

const LABEL_TIDAK_LAYAK: Record<AlasanTidakLayak, string> = {
  low_confidence: "bukti terlalu rapuh",
  cause_rejected: "sebab terbantah",
  evidence_unavailable: "bukti tidak tersedia",
  investigation_required: "perlu diselidiki",
  not_investigated: "belum diperiksa",
};

const SEBAB_TIDAK_LAYAK: Record<AlasanTidakLayak, string> = {
  low_confidence: "Sebabnya terbukti, tapi kelengkapan datanya belum cukup untuk ditindaklanjuti.",
  cause_rejected: "Bukti yang ada justru MEMBANTAH dugaan sebabnya. Ini jawaban, bukan ketiadaan jawaban.",
  evidence_unavailable: "Tidak ada bukti yang bisa menjawab. Bukan berarti tidak ada masalah.",
  investigation_required: "Ada Signal bulanan yang terbuka, tapi sebabnya belum terbukti. Signal memicu penyelidikan, bukan tindakan.",
  not_investigated: "Root Cause belum dijalankan untuk outlet ini.",
};

const WARNA_SEVERITY: Record<string, string> = {
  critical: "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-400",
  high: "border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-400",
  medium: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  low: "border-border bg-muted/60 text-muted-foreground",
};

/* ───────────────────────── Signal bulan berjalan ───────────────────────── */

/**
 * Kalimat kontrak AD-17, satu tempat supaya tidak ditulis ulang berbeda-beda.
 */
const SEBAB_MTD =
  "Bulan ini masih berjalan. Signal-nya INDIKASI untuk diselidiki, bukan hasil bulan penuh dan bukan diagnosis: " +
  "omzet penyebutnya baru terkumpul sampai hari ini, sementara biaya pembilangnya satu angka per bulan yang tidak " +
  "menyatakan berapa hari yang dicakupnya.";

/**
 * Sel Signal yang kosong — dan kenapa ia TIDAK boleh berbunyi "tidak ada".
 *
 * Kosong punya lebih dari satu sebab, dan sebab-sebab itu menuntut tindakan
 * yang berbeda. Menuliskannya "tidak ada" memilihkan salah satunya untuk yang
 * membaca, dan yang paling sering dipilih adalah yang paling melegakan.
 */
const SEBAB_TANPA_INDIKASI = {
  berjalan:
    "Belum ada indikasi untuk bulan berjalan. Ini BUKAN berarti outlet ini aman: biaya yang belum seluruhnya " +
    "masuk membuat rasionya terbaca lebih rendah dari keadaan sebenarnya, dan indikasinya bisa muncul belakangan.",
  selesai:
    "Tidak ada angka yang melanggar ambang bulan ini. Tetap bukan pernyataan bahwa outlet ini tanpa masalah — " +
    "yang diperiksa hanya KPI yang punya aturan berlaku.",
} as const;

/** Penanda bahwa badge di sebelahnya milik bulan yang belum selesai. */
function PenandaMtd() {
  return (
    <span
      title={SEBAB_MTD}
      className="cursor-help rounded-md border border-sky-500/40 bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-400"
    >
      MTD
    </span>
  );
}

const BULAN_PANJANG = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

const namaBulan = (periode: string): string => {
  const [th, bl] = periode.split("-").map(Number);
  return `${BULAN_PANJANG[bl - 1]} ${th}`;
};

const geserBulan = (periode: string, arah: number): string => {
  const [th, bl] = periode.split("-").map(Number);
  const d = new Date(Date.UTC(th, bl - 1 + arah, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

/* ───────────────────────────── kelengkapan ───────────────────────────── */

/**
 * SEBERAPA LENGKAP ANGKA DI LAYAR INI — dan ia di ATAS tabel, bukan di kakinya.
 *
 * Kelengkapan mengubah arti seluruh angka di bawahnya: minggu yang baru
 * berjalan dua hari selalu terlihat anjlok, dan tanpa angka ini yang membaca
 * tidak punya cara membedakannya dari minggu yang benar-benar jeblok. Di kaki
 * tabel ia terbaca setelah keputusannya terlanjur diambil.
 */
function Kelengkapan({ detail }: { detail: DetailMingguan }) {
  const { lubang, lubangDari, tanpaCabang, sumberTidakSah, tanpaTarget } = detail;
  const persenLengkap = lubangDari > 0 ? ((lubangDari - lubang) / lubangDari) * 100 : 100;
  const sebab = [
    lubang > 0 ? `${formatNumber(lubang)} sel outlet×minggu yang mingguanya sudah dimulai tapi angkanya belum ada` : null,
    tanpaCabang.length > 0 ? `${tanpaCabang.length} outlet belum tersambung cabang ESB: ${tanpaCabang.join(", ")}` : null,
    sumberTidakSah.length > 0 ? `${sumberTidakSah.length} outlet angka ESB-nya ditandai tidak sah bulan ini: ${sumberTidakSah.join(", ")}` : null,
    tanpaTarget.length > 0 ? `${tanpaTarget.length} outlet belum punya target bulanan (belum genap tiga bulan)` : null,
  ].filter(Boolean);

  const penuh = lubang === 0 && tanpaCabang.length === 0 && sumberTidakSah.length === 0;

  return (
    <div
      className={cn(
        "mb-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border px-3 py-2 text-[12px]",
        penuh
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
          : "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
      )}
    >
      {!penuh && <TriangleAlert className="size-3.5 shrink-0" />}
      <span
        className="cursor-help font-semibold"
        title="Yang diukur kelengkapan OMZET mingguan dari ESB. Kelengkapan biaya tidak ikut terukur di sini dan memang tidak bisa: op_expenses, op_purchases, dan op_pnl bergrain bulan, tanpa satu kolom pun yang menyatakan berapa hari yang dicakupnya. Angka 100% di sini tidak berarti biayanya sudah lengkap."
      >
        Kelengkapan data {formatNumber(persenLengkap, { maximumFractionDigits: 0 })}%
      </span>
      {sebab.length > 0 && <span className="text-foreground/70">{sebab.join(" · ")}</span>}
      <span className="text-foreground/60">
        Sel yang belum ada angkanya tidak dihitung nol — ia ditulis beserta alasannya.
      </span>
    </div>
  );
}

/* ──────────────────────────────── tabel ──────────────────────────────── */

export function TabelMingguan({
  detail,
  area,
  areaTerpilih,
  bisaPilihArea,
  href,
}: {
  detail: DetailMingguan;
  area: PilihanArea[];
  areaTerpilih: string;
  bisaPilihArea: boolean;
  href: string;
}) {
  const router = useRouter();
  const [mode, setMode] = React.useState<Mode>("sales");

  const pindah = (p: { bulan?: string; area?: string }) => {
    const q = new URLSearchParams();
    q.set("bulan", p.bulan ?? detail.periode);
    const a = p.area ?? areaTerpilih;
    if (a) q.set("area", a);
    router.push(`${href}?${q.toString()}`);
  };

  const labelBulan = namaBulan(detail.periode);

  return (
    <div className="w-full">
      {/* ── penavigasi periode + saringan ── */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center gap-1 rounded-xl border border-border bg-card p-1">
          <button
            type="button"
            aria-label="Bulan sebelumnya"
            onClick={() => pindah({ bulan: geserBulan(detail.periode, -1) })}
            className="grid size-7 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="min-w-[8.5rem] text-center text-[13px] font-semibold">{labelBulan}</span>
          <button
            type="button"
            aria-label="Bulan berikutnya"
            onClick={() => pindah({ bulan: geserBulan(detail.periode, 1) })}
            className="grid size-7 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>

        {bisaPilihArea && (
          <select
            value={areaTerpilih}
            onChange={(e) => pindah({ area: e.target.value })}
            aria-label="Coordinator Area"
            className="h-9 rounded-xl border border-border bg-card px-2.5 text-[13px]"
          >
            <option value="">Seluruh outlet</option>
            {area.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label} ({a.outlet})
              </option>
            ))}
          </select>
        )}

        <SegmentedTabs
          items={MODE.map((m) => ({ value: m.value, label: m.label }))}
          value={mode}
          onChange={(v) => setMode(v as Mode)}
          size="sm"
          className="ml-auto w-full sm:w-auto sm:min-w-[26rem]"
        />
      </div>

      <Kelengkapan detail={detail} />

      {detail.baris.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
          Tidak ada outlet dalam cakupan Anda untuk {labelBulan}.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full border-collapse text-[12px]">
            <thead>
              {/* Pita pemisah: apa yang MINGGUAN dan apa yang BULANAN, dan
                  batas itu dibuat terlihat — bukan disimpulkan dari nama kolom. */}
              <tr className="bg-muted/60">
                <th className="sticky left-0 z-20 bg-muted/60 px-3 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Outlet
                </th>
                <th
                  colSpan={detail.minggu.length}
                  className="border-l border-border px-3 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  Mingguan · {MODE.find((m) => m.value === mode)?.label}
                </th>
                <th
                  colSpan={4}
                  className="border-l-2 border-foreground/25 px-3 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  Konteks bulanan — {labelBulan}
                </th>
              </tr>
              <tr className="border-t border-border bg-muted/30">
                <th className="sticky left-0 z-20 min-w-[13rem] bg-muted/30 px-3 py-2 text-left font-semibold">
                  Nama · Coordinator
                </th>
                {detail.minggu.map((m) => (
                  <th key={m.minggu} className="min-w-[7rem] border-l border-border px-3 py-2 text-right font-semibold">
                    M{m.minggu}
                    <span className="block text-[10px] font-normal text-muted-foreground">{rentangMingguan(m)}</span>
                  </th>
                ))}
                <th className="min-w-[9rem] border-l-2 border-foreground/25 px-3 py-2 text-right font-semibold">
                  Monthly Target
                  <span className="block text-[10px] font-normal text-muted-foreground">konteks, bukan target minggu</span>
                </th>
                <th className="min-w-[9rem] border-l border-border px-3 py-2 text-left font-semibold">
                  Monthly Signals
                  <span className="block text-[10px] font-normal text-muted-foreground">
                    {labelBulan}
                    {detail.berjalan && (
                      <span title={SEBAB_MTD} className="cursor-help"> · indikasi, bulan berjalan</span>
                    )}
                  </span>
                </th>
                <th className="min-w-[8rem] border-l border-border px-3 py-2 text-left font-semibold">
                  Root Cause
                  <span className="block text-[10px] font-normal text-muted-foreground">confidence</span>
                </th>
                <th className="min-w-[9rem] border-l border-border px-3 py-2 text-left font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {detail.baris.map((b) => (
                <tr key={b.outletId} className="border-t border-border hover:bg-muted/30">
                  <th scope="row" className="sticky left-0 z-10 bg-card px-3 py-2 text-left font-medium">
                    <span className="block truncate" title={b.nama}>
                      {b.nama}
                    </span>
                    <span className="block truncate text-[10px] font-normal text-muted-foreground" title={`Area ${b.area}`}>
                      {b.coordinator} · area {b.area}
                    </span>
                  </th>

                  {b.sel.map((s) => (
                    <td key={s.minggu} className="border-l border-border px-3 py-2 text-right tabular-nums">
                      {mode === "sales" && <Nilai t={s.sales} render={(n) => <span title={formatIDR(n)}>{formatIDRShort(n)}</span>} />}
                      {mode === "tumbuh" && (
                        <Nilai
                          t={s.pertumbuhan}
                          render={(n) => (
                            <span className={cn(warnaTumbuh(n), !s.sebanding && "opacity-70")}>
                              {persen(n)}
                              {!s.sebanding && (
                                <span
                                  title={`Minggu ini punya ${s.hariAda} hari terisi, minggu pembandingnya tidak sama banyak. Angkanya benar, tapi kedua minggu itu tidak setara.`}
                                  className="ml-1 cursor-help font-semibold"
                                >
                                  ≠
                                </span>
                              )}
                            </span>
                          )}
                        />
                      )}
                      {mode === "pax" && <Nilai t={s.pax} render={(n) => formatNumber(n)} />}
                      {mode === "bills" && <Nilai t={s.bills} render={(n) => formatNumber(n)} />}
                      {mode === "rata" && <Nilai t={s.rataTransaksi} render={(n) => <span title={formatIDR(n)}>{formatIDRShort(n)}</span>} />}
                      <span className="mt-0.5 block text-[10px] font-normal text-muted-foreground">
                        <Nilai t={s.kelengkapan} render={(n) => `${formatNumber(n, { maximumFractionDigits: 0 })}% · ${s.hariAda}/${s.hariMinggu} hari`} />
                      </span>
                    </td>
                  ))}

                  {/* ── konteks bulanan ── tidak pernah dibagi ke minggu ── */}
                  <td className="border-l-2 border-foreground/25 px-3 py-2 text-right tabular-nums">
                    <Nilai t={b.targetBulananKonteks} render={(n) => <span title={formatIDR(n)}>{formatIDRShort(n)}</span>} />
                  </td>

                  <td className="border-l border-border px-3 py-2">
                    {b.signal.daftar.length === 0 ? (
                      <span
                        title={
                          detail.berjalan
                            ? SEBAB_TANPA_INDIKASI.berjalan
                            : SEBAB_TANPA_INDIKASI.selesai
                        }
                        className="cursor-help text-[11px] font-medium italic text-muted-foreground/70 decoration-dotted underline-offset-2 hover:underline"
                      >
                        belum ada indikasi
                      </span>
                    ) : (
                      <span
                        className="flex flex-wrap items-center gap-1"
                        title={`Monthly Signals — ${labelBulan}. ${b.signal.daftar
                          .map((s) => `${s.kpiDefinitionId} (${s.severity})`)
                          .join(", ")}. Signal ini milik BULAN, bukan minggu mana pun.${
                          detail.berjalan ? ` ${SEBAB_MTD}` : ""
                        }`}
                      >
                        {Object.entries(b.signal.perSeverity).map(([sev, n]) => (
                          <span
                            key={sev}
                            className={cn("rounded-md border px-1.5 py-0.5 text-[10px] font-semibold", WARNA_SEVERITY[sev] ?? WARNA_SEVERITY.low)}
                          >
                            {sev} {n}
                          </span>
                        ))}
                        {detail.berjalan && <PenandaMtd />}
                      </span>
                    )}
                  </td>

                  <td className="border-l border-border px-3 py-2">
                    <span
                      className={cn("inline-block rounded-md border px-1.5 py-0.5 text-[10px] font-semibold", WARNA_BUKTI[b.bukti.rootCause])}
                      title={b.bukti.daftar.map((x) => `${x.domain}: ${x.status}${x.alasan ? ` (${x.alasan})` : ""} — ${x.sumber}`).join("\n")}
                    >
                      {b.bukti.rootCause}
                    </span>
                    <span className={cn("mt-0.5 block text-[10px] font-medium", WARNA_YAKIN[b.bukti.keyakinan])}>
                      {b.bukti.keyakinan}
                    </span>
                  </td>

                  <td className="border-l border-border px-3 py-2">
                    {b.bukti.kelayakan.layak ? (
                      <span className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                        ELIGIBLE
                      </span>
                    ) : (
                      <span
                        className="cursor-help text-[11px] text-muted-foreground"
                        title={b.bukti.kelayakan.alasan ? SEBAB_TIDAK_LAYAK[b.bukti.kelayakan.alasan] : undefined}
                      >
                        <span className="block font-semibold text-foreground/70">NOT ELIGIBLE</span>
                        {b.bukti.kelayakan.alasan ? LABEL_TIDAK_LAYAK[b.bukti.kelayakan.alasan] : ""}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        Weekly Performance adalah tampilan tren, bukan tampilan pencapaian target. Tidak ada target mingguan di GWG —
        Monthly Target di kanan adalah target SEBULAN dan ditampilkan sebagai konteks, tidak dibagi ke minggu mana pun.
        Signal juga berskala bulanan: ia muncul di sini berlabel {labelBulan}, dan tidak pernah dianggap milik satu minggu
        tertentu.
        {detail.berjalan
          ? " Bulan ini masih berjalan, jadi Signal-nya adalah INDIKASI untuk diselidiki — bukan hasil bulan penuh, bukan diagnosis, dan bukan bukti bahwa sebabnya sudah diketahui. Sebaliknya, outlet tanpa Signal belum tentu aman: sebagian biaya bisa saja belum masuk, dan rasionya terbaca lebih rendah dari keadaan sebenarnya."
          : " Bulan ini sudah selesai, jadi angkanya tidak berubah lagi. Signal tetap memicu penyelidikan, bukan menyimpulkannya."}
      </p>
    </div>
  );
}
