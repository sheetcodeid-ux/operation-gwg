"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { InputRupiah } from "./form-tabel";
import { BULAN, labelPeriode, periodeDari, tahunPilihan } from "./periode";
import { simpanManajemenAction } from "@/lib/actions/kpi-manajemen";
import { BOBOT, TARGET_MARGIN, UMUR_SAME_STORE, type DivisiKpi } from "@/lib/kpi/manajemen";
import type { DetailManajemen } from "@/lib/data/kpi-manajemen";
import { formatIDR, formatNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";

/**
 * Kalkulator KPI Manajemen.
 *
 * Susunannya dari atas: gauge skor akhir, empat kartu komponen berurut A–D,
 * lalu tabel ringkasan yang menjumlahkan keempatnya. Urutan itu bukan selera —
 * yang membuka halaman ini datang untuk SATU angka, dan rinciannya baru
 * dibutuhkan setelah angka itu terlihat.
 *
 * TIGA DARI EMPAT KOMPONENNYA TIDAK DIKETIK. Omzet korporat dan penjualan tiap
 * outlet datang dari ESB, laba bersih dari isian bulanan Coordinator Area.
 * Yang tersisa untuk diketik hanya nilai KPI divisi yang belum punya modulnya
 * sendiri, dan angka EBITDA bila laporan keuangan berbeda dari yang tercatat.
 */

const WARNA = { a: "#e8a33d", b: "#5b8cef", c: "#3fbfa0", d: "#e8615d" } as const;

const NADA: Record<string, string> = {
  success: "#3fbfa0",
  amber: "#e8a33d",
  warning: "#f97316",
  danger: "#e8615d",
};

const dua = (n: number) => formatNumber(n, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const persen = (n: number) => `${dua(n)}%`;

const num = (v: string): number | null => {
  const t = String(v).replace(/[^\d.-]/g, "");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

/* ─────────────────────────────── gauge ─────────────────────────────── */

const R = 84;
const TEBAL = 18;
const KEL = 2 * Math.PI * R;

function Gauge({ skor, label, tone }: { skor: number; label: string; tone: string }) {
  const warna = NADA[tone] ?? NADA.danger;
  const isi = (Math.max(0, Math.min(100, skor)) / 100) * KEL;
  return (
    <div className="relative size-52 shrink-0">
      <svg viewBox="0 0 200 200" className="size-full -rotate-90">
        <circle cx={100} cy={100} r={R} fill="none" strokeWidth={TEBAL} className="stroke-muted" />
        <circle
          cx={100}
          cy={100}
          r={R}
          fill="none"
          stroke={warna}
          strokeWidth={TEBAL}
          strokeLinecap="round"
          strokeDasharray={`${isi} ${KEL - isi}`}
        />
      </svg>
      <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="text-[2.5rem] font-extrabold leading-none tracking-tight" style={{ color: warna }}>
            {dua(skor)}
          </p>
          <p className="mt-1 text-[11px] font-medium text-muted-foreground">dari 100</p>
          <p className="mt-1.5 text-[12px] font-semibold" style={{ color: warna }}>
            {label}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────── potongan ─────────────────────────────── */

function Kartu({
  huruf,
  judul,
  bobot,
  rumus,
  warna,
  children,
}: {
  huruf: string;
  judul: string;
  bobot: number;
  rumus: string;
  warna: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col rounded-2xl border border-border bg-card/40 p-5">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <span className="grid size-6 shrink-0 place-items-center rounded-md text-[11px] font-bold text-white" style={{ background: warna }}>
          {huruf}
        </span>
        <h3 className="text-sm font-semibold tracking-tight text-foreground">{judul}</h3>
        <span className="ml-auto rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: `${warna}22`, color: warna }}>
          Bobot {bobot}%
        </span>
      </div>
      <p className="mb-3 text-[11px] leading-relaxed text-muted-foreground">{rumus}</p>
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}

/** Batang capaian — penuh berarti bobotnya tercapai, tidak lebih. */
function Batang({ capaian, warna }: { capaian: number; warna: string }) {
  const v = Math.max(0, Math.min(100, capaian * 100));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${v}%`, background: warna }} />
    </div>
  );
}

function Hasil({ skor, bobot, capaian, warna, ket }: { skor: number; bobot: number; capaian: number; warna: string; ket: string }) {
  return (
    <div className="mt-auto border-t border-border/60 pt-3">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-[11.5px] text-muted-foreground">{ket}</span>
        <span className="text-base font-bold tabular-nums text-foreground">
          {dua(skor)}
          <span className="ml-0.5 text-[11px] font-medium text-muted-foreground">/ {bobot}</span>
        </span>
      </div>
      <Batang capaian={capaian} warna={warna} />
    </div>
  );
}

function Baris({ label, nilai, tebal }: { label: string; nilai: string; tebal?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/40 py-1.5 last:border-0">
      <span className="text-[12px] text-muted-foreground">{label}</span>
      <span className={cn("tabular-nums", tebal ? "text-[13px] font-semibold text-foreground" : "text-[12.5px] text-foreground/85")}>
        {nilai}
      </span>
    </div>
  );
}

/* ─────────────────────────────── papan ─────────────────────────────── */

export function PapanManajemen({ detail }: { detail: DetailManajemen }) {
  const router = useRouter();
  const { skor } = detail;

  const [divisi, setDivisi] = React.useState<DivisiKpi[]>(skor.d.divisi);
  const [laba, setLaba] = React.useState(String(detail.labaBersih));
  const [salesManual, setSalesManual] = React.useState(detail.salesManual === null ? "" : String(detail.salesManual));
  const [catatan, setCatatan] = React.useState(detail.catatan);
  const [sibuk, setSibuk] = React.useState(false);
  const [periodeIsi, setPeriodeIsi] = React.useState(detail.periode);

  // Menyesuaikan isian saat bulannya berganti — pola resmi React untuk itu.
  if (detail.periode !== periodeIsi) {
    setPeriodeIsi(detail.periode);
    setDivisi(skor.d.divisi);
    setLaba(String(detail.labaBersih));
    setSalesManual(detail.salesManual === null ? "" : String(detail.salesManual));
    setCatatan(detail.catatan);
  }

  const [tahun, bulan] = detail.periode.split("-");
  const pindah = (p: string) => router.push(`/kpi/manajemen?periode=${p}`);
  const otomatis = new Set(detail.divisiOtomatis);

  async function simpan() {
    setSibuk(true);
    const res = await simpanManajemenAction({
      periode: detail.periode,
      divisi,
      labaBersih: num(laba),
      salesManual: num(salesManual),
      catatan,
    });
    setSibuk(false);
    if (res.error) return toast.error(res.error);
    toast.success("Tersimpan");
    router.refresh();
  }

  const ringkas = [
    { huruf: "A", nama: "Gross Sales Corporate", bobot: BOBOT.a, skor: skor.a.skor, capaian: skor.a.capaian, warna: WARNA.a },
    { huruf: "B", nama: "Same Store Sales", bobot: BOBOT.b, skor: skor.b.skor, capaian: skor.b.capaian, warna: WARNA.b },
    { huruf: "C", nama: "EBITDA Same Store", bobot: BOBOT.c, skor: skor.c.skor, capaian: skor.c.capaian, warna: WARNA.c },
    { huruf: "D", nama: "KPI All Division", bobot: BOBOT.d, skor: skor.d.skor, capaian: skor.d.rata / 100, warna: WARNA.d },
  ];

  return (
    <div>
      <div className="scroll-fade-x -mx-1 mb-4 flex items-center gap-2 px-1 py-0.5">
        <Combobox portal searchable={false} className="w-28 shrink-0" value={tahun} onChange={(v) => pindah(periodeDari(v, bulan))} options={tahunPilihan()} />
        <Combobox portal searchable={false} className="w-40 shrink-0" value={bulan} onChange={(v) => pindah(periodeDari(tahun, v))} options={BULAN} />
        <div className="ml-auto shrink-0">
          <Button onClick={simpan} disabled={sibuk} className="gap-1.5">
            {sibuk ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Simpan
          </Button>
        </div>
      </div>

      {/* Skor akhir lebih dulu — yang membuka halaman ini datang untuk satu angka. */}
      <div className="mb-4 flex flex-wrap items-center gap-6 rounded-2xl border border-border bg-card/40 p-6">
        <Gauge skor={skor.akhir} label={skor.peringkat.label} tone={skor.peringkat.tone} />
        <div className="min-w-[16rem] flex-1">
          <p className="text-sm font-semibold text-foreground">Skor KPI Manajemen · {labelPeriode(detail.periode)}</p>
          <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
            Empat komponen berbobot, dijumlah jadi satu angka 0–100. Pencapaian di atas 100% tidak menambah skor
            melebihi bobotnya.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {ringkas.map((k) => (
              <div key={k.huruf} className="flex items-center gap-2 rounded-xl border border-border bg-background/40 px-3 py-2">
                <span className="grid size-5 shrink-0 place-items-center rounded text-[10px] font-bold text-white" style={{ background: k.warna }}>
                  {k.huruf}
                </span>
                <span className="min-w-0 flex-1 truncate text-[11.5px] text-foreground/85">{k.nama}</span>
                <span className="shrink-0 text-[12px] font-semibold tabular-nums text-foreground">
                  {dua(k.skor)}
                  <span className="text-[10.5px] font-medium text-muted-foreground">/{k.bobot}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        {/* A — Gross Sales Corporate */}
        <Kartu
          huruf="A"
          judul="Gross Sales Corporate"
          bobot={BOBOT.a}
          rumus="Target = rata-rata omzet tiga bulan sebelumnya. Skor = min(actual ÷ target, 100%) × 40. Seluruh outlet ikut, termasuk yang baru buka."
          warna={WARNA.a}
        >
          <div className="rounded-xl border border-border bg-background/40 px-3 py-1">
            {detail.bulanA.map((b, i) => (
              <Baris key={b} label={labelPeriode(b)} nilai={formatIDR(detail.omzetLalu[i])} />
            ))}
            <Baris label="Target (rata-rata)" nilai={formatIDR(skor.a.target)} tebal />
            <Baris label={`Actual ${labelPeriode(detail.periode)}`} nilai={formatIDR(skor.a.actual)} tebal />
          </div>
          <Hasil skor={skor.a.skor} bobot={BOBOT.a} capaian={skor.a.capaian} warna={WARNA.a} ket={`Capaian ${persen(skor.a.capaian * 100)}`} />
        </Kartu>

        {/* B — Same Store Sales */}
        <Kartu
          huruf="B"
          judul="Same Store Sales"
          bobot={BOBOT.b}
          rumus={`Hanya outlet berumur di atas ${UMUR_SAME_STORE} bulan. Target tiap outlet = rata-rata tiga bulan sebelumnya. Skor = min(total actual ÷ total target, 100%) × 30.`}
          warna={WARNA.b}
        >
          <div className="rounded-xl border border-border bg-background/40 px-3 py-1">
            <Baris label="Outlet dihitung" nilai={`${skor.b.jumlahIkut} outlet`} />
            <Baris label="Outlet baru (dikecualikan)" nilai={`${skor.b.jumlahBaru} outlet`} />
            <Baris label="Total target" nilai={formatIDR(skor.b.target)} tebal />
            <Baris label="Total actual" nilai={formatIDR(skor.b.actual)} tebal />
          </div>
          {detail.tanpaUmur.length > 0 && (
            <p className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/[0.07] px-3 py-2 text-[11.5px] leading-relaxed text-amber-800 dark:text-amber-200">
              {detail.tanpaUmur.length} outlet belum punya tanggal buka, jadi umurnya tidak bisa dihitung dan mereka
              dikeluarkan dari Same Store Sales: {detail.tanpaUmur.slice(0, 4).join(", ")}
              {detail.tanpaUmur.length > 4 ? `, dan ${detail.tanpaUmur.length - 4} lainnya` : ""}.
            </p>
          )}
          <Hasil skor={skor.b.skor} bobot={BOBOT.b} capaian={skor.b.capaian} warna={WARNA.b} ket={`Capaian ${persen(skor.b.capaian * 100)}`} />
        </Kartu>

        {/* C — EBITDA */}
        <Kartu
          huruf="C"
          judul="EBITDA / Laba Bersih Same Store"
          bobot={BOBOT.c}
          rumus={`Margin = laba bersih ÷ sales same store. Skor = min(margin ÷ ${TARGET_MARGIN}%, 100%) × 20 — berjenjang, bukan lulus-atau-tidak.`}
          warna={WARNA.c}
        >
          <div className="space-y-2">
            <label className="block">
              <span className="mb-1 block text-[11.5px] text-muted-foreground">Laba bersih same store</span>
              <InputRupiah nilai={laba} onUbah={setLaba} className="h-9" izinkanMinus />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11.5px] text-muted-foreground">
                Sales same store — kosongkan untuk memakai total actual komponen B
              </span>
              <InputRupiah
                nilai={salesManual}
                onUbah={setSalesManual}
                className="h-9"
                placeholder={formatNumber(skor.b.actual)}
              />
            </label>
          </div>
          <div className="mt-2 rounded-xl border border-border bg-background/40 px-3 py-1">
            <Baris label="Dasar sales" nilai={formatIDR(skor.c.sales)} />
            <Baris label="Margin" nilai={persen(skor.c.margin)} tebal />
          </div>
          <Hasil skor={skor.c.skor} bobot={BOBOT.c} capaian={skor.c.capaian} warna={WARNA.c} ket={`Target margin ${TARGET_MARGIN}%`} />
        </Kartu>

        {/* D — KPI All Division */}
        <Kartu
          huruf="D"
          judul="KPI All Division"
          bobot={BOBOT.d}
          rumus="Rata-rata nilai KPI seluruh divisi (0–100), semuanya berbobot sama. Skor = (rata-rata ÷ 100) × 10."
          warna={WARNA.d}
        >
          <div className="space-y-1.5">
            {divisi.map((d, i) => (
              <div key={`${d.nama}-${i}`} className="flex items-center gap-2">
                <Input
                  className="h-9 min-w-0 flex-1"
                  value={d.nama}
                  placeholder="Nama divisi"
                  onChange={(e) => setDivisi((s) => s.map((x, n) => (n === i ? { ...x, nama: e.target.value } : x)))}
                />
                <Input
                  inputMode="numeric"
                  className="h-9 w-20 shrink-0 text-right"
                  value={String(d.nilai)}
                  onChange={(e) => setDivisi((s) => s.map((x, n) => (n === i ? { ...x, nilai: num(e.target.value) ?? 0 } : x)))}
                />
                {/* Divisi yang nilainya datang dari modul KPI-nya sendiri
                    ditandai — kalau diketik ulang, angka ketikan yang menang,
                    dan orang perlu tahu ia sedang menimpa hitungan sistem. */}
                {otomatis.has(d.nama) ? (
                  <Badge tone="brand">otomatis</Badge>
                ) : (
                  <button
                    type="button"
                    aria-label={`Hapus ${d.nama || "divisi"}`}
                    onClick={() => setDivisi((s) => s.filter((_, n) => n !== i))}
                    className="grid size-9 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-red-600 dark:hover:text-red-400"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => setDivisi((s) => [...s, { nama: "", nilai: 0 }])}
              className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Plus className="size-3.5" /> Tambah divisi
            </button>
          </div>
          <div className="mt-2 rounded-xl border border-border bg-background/40 px-3 py-1">
            <Baris label={`Rata-rata ${divisi.length} divisi`} nilai={dua(skor.d.rata)} tebal />
          </div>
          <Hasil skor={skor.d.skor} bobot={BOBOT.d} capaian={skor.d.rata / 100} warna={WARNA.d} ket="Skala 0–100" />
        </Kartu>
      </div>

      {/* Ringkasan — menjumlahkan keempat kartu di atasnya, apa adanya. */}
      <div className="rounded-2xl border border-border bg-card/40 p-5">
        <h3 className="mb-3 text-sm font-semibold tracking-tight text-foreground">Ringkasan Skor</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">Komponen</th>
                <th className="px-3 py-2 text-right text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">Capaian</th>
                <th className="px-3 py-2 text-right text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">Bobot</th>
                <th className="px-3 py-2 text-right text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">Skor</th>
              </tr>
            </thead>
            <tbody>
              {ringkas.map((k) => (
                <tr key={k.huruf} className="border-b border-border/60 last:border-0">
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-2">
                      <span className="grid size-5 shrink-0 place-items-center rounded text-[10px] font-bold text-white" style={{ background: k.warna }}>
                        {k.huruf}
                      </span>
                      <span className="font-medium text-foreground">{k.nama}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-foreground/85">{persen(k.capaian * 100)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{k.bobot}%</td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums text-foreground">{dua(k.skor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 border-t border-border/60 pt-3 text-[12.5px] text-muted-foreground">
          {ringkas.map((k) => dua(k.skor)).join(" + ")} ={" "}
          <b className="text-foreground">{dua(skor.akhir)}</b> / 100 ·{" "}
          <span style={{ color: NADA[skor.peringkat.tone] }}>{skor.peringkat.label}</span>
        </p>
        <label className="mt-4 block">
          <span className="mb-1 block text-[11.5px] text-muted-foreground">Catatan bulan ini</span>
          <textarea
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            rows={2}
            placeholder="Opsional — konteks yang perlu diingat saat angka ini dibaca ulang bulan depan."
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
          />
        </label>
      </div>
    </div>
  );
}
