"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCheck, EyeOff, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn, formatNumber } from "@/lib/utils";
import { abaikanSignalAction, akuiSignalAction } from "@/lib/actions/signals";
import type { PapanCommandCenter, SignalTriase } from "@/lib/data/command-center";

/**
 * COMMAND CENTER — layar triase, bukan dasbor.
 *
 * Yang ditanyakan halaman ini satu: APA YANG MASIH PERLU DITANGANI. Tidak ada
 * grafik, tidak ada angka ringkasan yang tidak bisa ditindaklanjuti, dan tidak
 * ada baris yang cuma enak dilihat.
 *
 * ┌─ SIGNAL BUKAN VONIS, DAN LAYAR INI TIDAK BOLEH MEMBUATNYA TERDENGAR BEGITU ┐
 * │                                                                            │
 * │ Bulan berjalan bertanda MTD · INDIKASI (AD-17). Bulan yang sudah habis    │
 * │ bertanda BULAN PENUH. Keduanya WAJIB terbaca berbeda, karena angka yang   │
 * │ dibagi omzet separuh bulan terbaca dua kali lipat tanpa ada yang berubah  │
 * │ di lapangan.                                                              │
 * │                                                                            │
 * │ Signal juga bukan sebab dan bukan diagnosis — ia memicu penyelidikan,     │
 * │ bukan menyimpulkannya. Tidak ada satu label pun di sini yang menyatakan   │
 * │ outletnya bermasalah.                                                     │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ DUA TINDAKAN, DUA PINTU ─────────────────────────────────────────────────┐
 * │                                                                           │
 * │   Sudah dilihat   siapa pun yang boleh membuka layar ini                  │
 * │   Abaikan         hanya pemegang `manage_signals`, TIDAK BISA DIBATALKAN  │
 * │                                                                           │
 * │ Tombol yang disembunyikan BUKAN otorisasi: keduanya diperiksa ulang di    │
 * │ server (`src/lib/actions/signals.ts`). Yang di sini cuma supaya orang     │
 * │ tidak menekan tombol yang pasti ditolak.                                  │
 * └───────────────────────────────────────────────────────────────────────────┘
 */

const WARNA_SEVERITY: Record<string, string> = {
  critical: "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-400",
  high: "border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-400",
  medium: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  low: "border-border bg-muted/60 text-muted-foreground",
};

const BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

const labelBulan = (p: string): string => {
  const [th, bl] = p.split("-").map(Number);
  return `${BULAN[bl - 1] ?? p} ${th}`;
};

const OPERATOR: Record<string, string> = {
  gt: "lebih dari",
  gte: "minimal",
  lt: "kurang dari",
  lte: "maksimal",
  between: "di luar rentang",
};

const SEBAB_MTD =
  "Bulan ini masih berjalan. Signal-nya INDIKASI untuk diselidiki, bukan hasil bulan penuh dan bukan diagnosis: " +
  "omzet penyebutnya baru terkumpul sampai hari ini, sementara biaya pembilangnya satu angka per bulan yang tidak " +
  "menyatakan berapa hari yang dicakupnya.";

const jam = (iso: string): string => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("id-ID", { timeZone: "Asia/Jakarta", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
};

/** Penanda kematangan periode. Dua bentuk, dan keduanya wajib berbeda. */
function PenandaPeriode({ berjalan }: { berjalan: boolean }) {
  return berjalan ? (
    <span
      title={SEBAB_MTD}
      className="cursor-help rounded-md border border-sky-500/40 bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-400"
    >
      MTD · indikasi
    </span>
  ) : (
    <span className="rounded-md border border-border bg-muted/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
      bulan penuh
    </span>
  );
}

/* ───────────────────────────── satu Signal ───────────────────────────── */

function BarisSignal({
  s,
  berjalan,
  bolehAbaikan,
  sibuk,
  onAkui,
  onAbaikan,
}: {
  s: SignalTriase;
  berjalan: boolean;
  bolehAbaikan: boolean;
  sibuk: boolean;
  onAkui: (id: number) => void;
  onAbaikan: (s: SignalTriase) => void;
}) {
  const membaik = s.nilaiTerakhir !== null && s.nilaiTerakhir !== s.nilaiActual;
  return (
    <div className="flex flex-wrap items-start gap-x-3 gap-y-1.5 border-t border-border px-3 py-2 first:border-t-0">
      <span
        className={cn(
          "min-w-[4.5rem] rounded-md border px-1.5 py-0.5 text-center text-[10px] font-semibold uppercase",
          WARNA_SEVERITY[s.severity] ?? WARNA_SEVERITY.low,
        )}
      >
        {s.severity}
      </span>

      <span className="min-w-[11rem] flex-1 text-[12px]">
        <span className="block font-medium">{s.kpiDefinitionId}</span>
        <span className="block text-[11px] text-muted-foreground">
          {formatNumber(s.nilaiActual, { maximumFractionDigits: 2 })} · ambang {OPERATOR[s.operator] ?? s.operator}{" "}
          {formatNumber(s.nilaiAmbang, { maximumFractionDigits: 2 })}
          {s.nilaiAmbang2 !== null ? `–${formatNumber(s.nilaiAmbang2, { maximumFractionDigits: 2 })}` : ""}
        </span>
      </span>

      <span className="min-w-[10rem] text-[11px] text-muted-foreground">
        <span className="block">
          Terdeteksi {jam(s.terdeteksiPada)} · <PenandaPeriodeRingkas berjalan={berjalan} />
        </span>
        <span className="block">
          Pengamatan terakhir {jam(s.diamatiPada)}
          {membaik && s.nilaiTerakhir !== null
            ? ` · kini ${formatNumber(s.nilaiTerakhir, { maximumFractionDigits: 2 })}`
            : ""}
        </span>
      </span>

      <span className="flex min-w-[12rem] flex-wrap items-center gap-1.5">
        {s.diakuiOleh ? (
          <span
            title={`Dilihat ${s.diakuiNama ?? s.diakuiOleh} pada ${jam(s.diakuiPada ?? "")}`}
            className="cursor-help rounded-md border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400"
          >
            <CheckCheck className="mr-0.5 inline size-3" /> dilihat {s.diakuiNama ?? s.diakuiOleh}
          </span>
        ) : (
          <Button size="sm" variant="outline" disabled={sibuk} onClick={() => onAkui(s.id)} className="h-6 px-2 text-[11px]">
            <CheckCheck className="size-3" /> Sudah dilihat
          </Button>
        )}
        {bolehAbaikan && (
          <Button
            size="sm"
            variant="ghost"
            disabled={sibuk}
            onClick={() => onAbaikan(s)}
            className="h-6 px-2 text-[11px] text-muted-foreground"
          >
            <EyeOff className="size-3" /> Abaikan
          </Button>
        )}
      </span>
    </div>
  );
}

const PenandaPeriodeRingkas = ({ berjalan }: { berjalan: boolean }) => (
  <span className={cn("font-medium", berjalan ? "text-sky-700 dark:text-sky-400" : "text-muted-foreground")}>
    {berjalan ? "MTD · indikasi" : "bulan penuh"}
  </span>
);

/* ───────────────────────────── papan ───────────────────────────── */

export function PapanCommandCenterUI({
  papan,
  bolehAbaikan,
}: {
  papan: PapanCommandCenter;
  bolehAbaikan: boolean;
}) {
  const router = useRouter();
  const [sibuk, setSibuk] = React.useState(false);
  const [pesan, setPesan] = React.useState<string | null>(null);
  const [target, setTarget] = React.useState<SignalTriase | null>(null);
  const [alasan, setAlasan] = React.useState("");

  const pilihan = React.useMemo(
    () => [
      { value: "", label: "Semua periode terbuka" },
      ...papan.periodeTersedia.map((p) => ({
        value: p,
        label: `${labelBulan(p)}${p === papan.bulanBerjalan ? " · berjalan" : ""}`,
      })),
    ],
    [papan.periodeTersedia, papan.bulanBerjalan],
  );

  function gantiPeriode(v: string) {
    router.push(v ? `/operational/command-center?bulan=${v}` : "/operational/command-center");
  }

  async function akui(id: number) {
    setSibuk(true);
    setPesan(null);
    const r = await akuiSignalAction(id);
    setSibuk(false);
    if (!r.ok) setPesan(r.pesan);
    else router.refresh();
  }

  async function abaikan() {
    if (!target) return;
    setSibuk(true);
    setPesan(null);
    const r = await abaikanSignalAction(target.id, alasan);
    setSibuk(false);
    if (!r.ok) {
      setPesan(r.pesan);
      return;
    }
    setTarget(null);
    setAlasan("");
    router.refresh();
  }

  const r = papan.ringkas;

  return (
    <div className="w-full">
      {/* ── penyaring periode + ringkasan ── */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Combobox
          options={pilihan}
          value={papan.periode ?? ""}
          onChange={gantiPeriode}
          className="w-full sm:w-[16rem]"
          matchTriggerWidth
        />
        {papan.periode !== null && <PenandaPeriode berjalan={papan.periode === papan.bulanBerjalan} />}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-border px-3 py-2 text-[12px]">
        <span className="font-semibold">{formatNumber(r.total)} Signal terbuka</span>
        <span className="text-muted-foreground">·</span>
        <span className="text-rose-700 dark:text-rose-400">{formatNumber(r.critical)} critical</span>
        <span className="text-orange-700 dark:text-orange-400">{formatNumber(r.high)} high</span>
        <span className="text-amber-700 dark:text-amber-400">{formatNumber(r.medium)} medium</span>
        {r.low > 0 && <span className="text-muted-foreground">{formatNumber(r.low)} low</span>}
        <span className="text-muted-foreground">·</span>
        <span className="text-muted-foreground">{formatNumber(r.outletTerdampak)} outlet terdampak</span>
        <span className="text-muted-foreground">·</span>
        <span className="text-emerald-700 dark:text-emerald-400">{formatNumber(r.diakui)} sudah dilihat</span>
      </div>

      {pesan && (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-700 dark:text-rose-400">
          <TriangleAlert className="size-3.5 shrink-0" /> {pesan}
        </div>
      )}

      {/* ── SIGNAL KORPORAT — bagiannya sendiri, bukan outlet palsu ── */}
      <section className="mb-4">
        <h2 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Corporate Signals</h2>
        {!papan.korporatDibaca ? (
          <p className="rounded-xl border border-dashed border-border p-4 text-[12px] text-muted-foreground">
            Signal korporat tidak ikut dibaca untuk Anda.
          </p>
        ) : papan.korporat.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-4 text-[12px] italic text-muted-foreground">
            Belum ada indikasi korporat pada periode ini. Ini bukan pernyataan bahwa semuanya aman — yang diperiksa
            hanya KPI yang punya aturan berlaku, dan biaya yang belum seluruhnya masuk membuat rasionya terbaca lebih
            rendah dari keadaan sebenarnya.
          </p>
        ) : (
          <div className="rounded-xl border border-border">
            {papan.korporat.map((s) => (
              <div key={s.id}>
                <div className="flex items-center gap-2 border-t border-border bg-muted/30 px-3 py-1 text-[11px] font-medium first:border-t-0">
                  {labelBulan(s.periode)} <PenandaPeriode berjalan={s.periode === papan.bulanBerjalan} />
                </div>
                <BarisSignal
                  s={s}
                  berjalan={s.periode === papan.bulanBerjalan}
                  bolehAbaikan={bolehAbaikan}
                  sibuk={sibuk}
                  onAkui={akui}
                  onAbaikan={setTarget}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── SIGNAL OUTLET — PERIODE → OUTLET → Signal ── */}
      <section>
        <h2 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Outlet Signals</h2>
        {papan.kelompok.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-4 text-[12px] italic text-muted-foreground">
            Belum ada indikasi untuk outlet dalam cakupan Anda pada periode ini. Ini bukan pernyataan bahwa semuanya
            aman.
          </p>
        ) : (
          papan.kelompok.map((kp) => (
            <div key={kp.periode} className="mb-4">
              <div className="mb-1.5 flex items-center gap-2 text-[12px] font-semibold">
                {labelBulan(kp.periode)} <PenandaPeriode berjalan={kp.berjalan} />
                <span className="text-[11px] font-normal text-muted-foreground">
                  {formatNumber(kp.outlet.length)} outlet
                </span>
              </div>
              <div className="space-y-2">
                {kp.outlet.map((o) => (
                  <div key={o.outletId} className="rounded-xl border border-border">
                    <div className="flex flex-wrap items-baseline gap-x-2 border-b border-border bg-muted/30 px-3 py-1.5">
                      <span className="text-[12px] font-medium">{o.outletNama}</span>
                      <span className="text-[10px] text-muted-foreground">area {o.areaNama}</span>
                      <span className="ml-auto text-[10px] text-muted-foreground">
                        {formatNumber(o.signal.length)} Signal
                      </span>
                    </div>
                    {o.signal.map((s) => (
                      <BarisSignal
                        key={s.id}
                        s={s}
                        berjalan={kp.berjalan}
                        bolehAbaikan={bolehAbaikan}
                        sibuk={sibuk}
                        onAkui={akui}
                        onAbaikan={setTarget}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </section>

      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        Signal menyatakan sebuah angka melanggar ambang yang berlaku untuknya — ia memicu penyelidikan, bukan
        menyimpulkannya. Signal bukan sebab, bukan diagnosis, dan bukan tindakan. Periode yang bertanda MTD masih
        berjalan: angkanya indikasi, bukan hasil bulan penuh. Outlet tanpa Signal belum tentu aman.
      </p>

      {/* ── dialog abaikan ── */}
      <Dialog open={target !== null} onOpenChange={(v) => !v && setTarget(null)}>
        <DialogContent
          title="Abaikan Signal"
          description="Tindakan ini TIDAK DAPAT DIBATALKAN. Signal yang sudah diabaikan tidak bisa dibuka kembali oleh siapa pun."
          align="center"
        >
          <div className="space-y-3">
            {target && (
              <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-[12px]">
                <span className="block font-medium">{target.kpiDefinitionId}</span>
                <span className="block text-[11px] text-muted-foreground">
                  {target.cakupan === "korporat" ? "Korporat" : target.outletNama} · {labelBulan(target.periode)} ·{" "}
                  {target.severity}
                </span>
              </div>
            )}
            <label className="block text-[12px] font-medium">
              Alasan <span className="text-rose-600">wajib</span>
              <textarea
                value={alasan}
                onChange={(e) => setAlasan(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-[12px] font-normal outline-none focus:ring-2 focus:ring-ring"
                placeholder="Kenapa Signal ini tidak perlu ditindaklanjuti?"
              />
            </label>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setTarget(null)} disabled={sibuk}>
                Batal
              </Button>
              <Button size="sm" onClick={abaikan} disabled={sibuk || alasan.trim().length === 0}>
                Abaikan permanen
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
