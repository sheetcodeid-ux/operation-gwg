"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, Table2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { simpanEfisiensiMassalAction, simpanFeeMassalAction } from "@/lib/actions/kpi";
import type { BarisEfisiensi } from "@/lib/kpi/hitung";
import type { DetailFee } from "@/lib/data/kpi";
import { formatIDR } from "@/lib/utils";

/**
 * Form berbentuk TABEL — seluruh outlet sekaligus, satu kali simpan.
 *
 * Bentuk sebelumnya memaksa memilih outlet, mengisi, menyimpan, lalu mengulang
 * dari awal. Untuk 58 outlet dikali dua kolom itu 116 putaran, dan pekerjaan
 * sebanyak itu tidak akan pernah selesai dikerjakan sampai habis — yang terjadi
 * justru datanya diisi separuh lalu ditinggalkan, dan angka KPI-nya jadi
 * setengah benar. Setengah benar lebih berbahaya daripada kosong: yang kosong
 * kelihatan kosong.
 *
 * Kepala tabelnya menempel (`sticky`) supaya nama kolomnya tetap terbaca sampai
 * outlet ke-58, dan hanya baris yang benar-benar diubah yang dikirim.
 */

const num = (v: string): number | null => {
  const t = String(v).replace(/[^\d.-]/g, "");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

function Kepala({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`whitespace-nowrap bg-muted px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground ${className}`}>
      {children}
    </th>
  );
}

/* ───────────────────── efisiensi beban operasional ───────────────────── */

export function FormEfisiensi({
  posisi,
  periode,
  pic,
  baris,
}: {
  posisi: string;
  periode: string;
  pic: string;
  baris: BarisEfisiensi[];
}) {
  const router = useRouter();
  const [buka, setBuka] = React.useState(false);
  const [sibuk, setSibuk] = React.useState(false);
  const [isi, setIsi] = React.useState<Record<string, { wh: string; nonWh: string }>>({});

  function bukaForm() {
    setIsi(
      Object.fromEntries(
        baris.map((b) => [b.outletId, { wh: b.actualWh === null ? "" : String(b.actualWh), nonWh: b.actualNonWh === null ? "" : String(b.actualNonWh) }]),
      ),
    );
    setBuka(true);
  }

  const ubah = (id: string, kolom: "wh" | "nonWh", v: string) =>
    setIsi((s) => ({ ...s, [id]: { ...(s[id] ?? { wh: "", nonWh: "" }), [kolom]: v } }));

  async function simpan() {
    // Hanya yang berubah. Mengirim 58 baris utuh setiap kali menyimpan berarti
    // menimpa isian orang lain yang kebetulan menyimpan lebih dulu.
    const berubah = baris
      .filter((b) => {
        const s = isi[b.outletId];
        if (!s) return false;
        const wh = num(s.wh);
        const nonWh = num(s.nonWh);
        return wh !== b.actualWh || nonWh !== b.actualNonWh;
      })
      .map((b) => ({ outletId: b.outletId, actualWh: num(isi[b.outletId].wh), actualNonWh: num(isi[b.outletId].nonWh) }));

    if (berubah.length === 0) {
      toast.info("Tidak ada yang berubah.");
      return;
    }
    setSibuk(true);
    const res = await simpanEfisiensiMassalAction({ posisi, periode, pic, baris: berubah });
    setSibuk(false);
    if (res.error) return toast.error(res.error);
    toast.success(`${res.tersimpan} outlet tersimpan`);
    setBuka(false);
    router.refresh();
  }

  return (
    <>
      <Button size="sm" variant="outline" className="gap-1.5" onClick={bukaForm}>
        <Table2 className="size-4" /> Isi Realisasi
      </Button>

      <Dialog open={buka} onOpenChange={setBuka}>
        <DialogContent
          title="Realisasi Beban Operasional"
          description="Seluruh outlet dalam satu tabel — isi yang perlu saja, lalu simpan sekali"
          align="center"
          className="max-w-4xl"
        >
          <div className="flex max-h-[75vh] flex-col p-5">
            <p className="mb-3 shrink-0 text-[12px] leading-relaxed text-muted-foreground">
              Budget-nya tidak diisi: dihitung sendiri dari rata-rata net sales tiga bulan terakhir tiap outlet. Yang
              dikosongkan tetap dianggap belum dilaporkan, bukan nol.
            </p>

            <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-border">
              <table className="w-full min-w-[720px] border-collapse text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-border text-left">
                    <Kepala>Outlet</Kepala>
                    <Kepala className="text-right">Average 3 Bln</Kepala>
                    <Kepala className="text-right">Budget</Kepala>
                    <Kepala className="w-40">Actual WH</Kepala>
                    <Kepala className="w-40">Actual Non-WH</Kepala>
                  </tr>
                </thead>
                <tbody>
                  {baris.map((b) => (
                    <tr key={b.outletId} className="border-b border-border/60 last:border-0">
                      <td className="px-3 py-1.5">
                        <p className="font-medium text-foreground">{b.outletNama}</p>
                        {b.average === null && <p className="text-[11px] text-amber-600 dark:text-amber-400">belum tersambung ke ESB</p>}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                        {b.average === null ? "—" : formatIDR(b.average)}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                        {b.budget === null ? "—" : formatIDR(b.budget)}
                      </td>
                      <td className="px-3 py-1.5">
                        <Input
                          inputMode="numeric"
                          className="h-8"
                          placeholder="0"
                          value={isi[b.outletId]?.wh ?? ""}
                          onChange={(e) => ubah(b.outletId, "wh", e.target.value)}
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <Input
                          inputMode="numeric"
                          className="h-8"
                          placeholder="0"
                          value={isi[b.outletId]?.nonWh ?? ""}
                          onChange={(e) => ubah(b.outletId, "nonWh", e.target.value)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-3 flex shrink-0 justify-end gap-2">
              <Button variant="ghost" onClick={() => setBuka(false)} disabled={sibuk}>
                Batal
              </Button>
              <Button onClick={simpan} disabled={sibuk}>
                {sibuk ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Simpan semua
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ─────────────────────── ceklis management fee ─────────────────────── */

export function FormFee({ posisi, periode, baris }: { posisi: string; periode: string; baris: DetailFee[] }) {
  const router = useRouter();
  const [buka, setBuka] = React.useState(false);
  const [sibuk, setSibuk] = React.useState(false);
  const [isi, setIsi] = React.useState<Record<string, { sesuai: boolean; catatan: string }>>({});

  function bukaForm() {
    setIsi(Object.fromEntries(baris.map((b) => [b.outletId, { sesuai: b.sesuai, catatan: "" }])));
    setBuka(true);
  }

  const alih = (id: string, sesuai: boolean) => setIsi((s) => ({ ...s, [id]: { ...(s[id] ?? { catatan: "" }), sesuai } }));
  const catat = (id: string, catatan: string) =>
    setIsi((s) => ({ ...s, [id]: { ...(s[id] ?? { sesuai: false }), catatan } }));

  async function simpan() {
    const kirim = baris
      .filter((b) => isi[b.outletId] && (isi[b.outletId].sesuai !== b.sesuai || isi[b.outletId].catatan.trim() !== ""))
      .map((b) => ({ outletId: b.outletId, sesuai: isi[b.outletId].sesuai, catatan: isi[b.outletId].catatan }));

    if (kirim.length === 0) {
      toast.info("Tidak ada yang berubah.");
      return;
    }
    setSibuk(true);
    const res = await simpanFeeMassalAction({ posisi, periode, baris: kirim });
    setSibuk(false);
    if (res.error) return toast.error(res.error);
    toast.success(`${res.tersimpan} outlet tersimpan`);
    setBuka(false);
    router.refresh();
  }

  const dicentang = baris.filter((b) => isi[b.outletId]?.sesuai ?? b.sesuai).length;

  return (
    <>
      <Button size="sm" variant="outline" className="gap-1.5" onClick={bukaForm}>
        <Table2 className="size-4" /> Ceklis Management Fee
      </Button>

      <Dialog open={buka} onOpenChange={setBuka}>
        <DialogContent
          title="Ceklis Invoice Management Fee"
          description="Seluruh outlet dalam satu tabel — centang yang sesuai, tulis selisihnya bila tidak"
          align="center"
          className="max-w-4xl"
        >
          <div className="flex max-h-[75vh] flex-col p-5">
            <p className="mb-3 shrink-0 text-[12px] leading-relaxed text-muted-foreground">
              Net sales dan fee 5%-nya diambil sendiri dari ESB. Yang tidak sesuai cukup dibiarkan tidak tercentang dan
              ditulis selisihnya — contoh: <i>laporan keuangan 10.000.000, di sistem 9.000.000</i>.
            </p>

            <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-border">
              <table className="w-full min-w-[760px] border-collapse text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-border text-left">
                    <Kepala>Outlet</Kepala>
                    <Kepala className="text-right">Net Sales</Kepala>
                    <Kepala className="text-right">Fee Seharusnya (5%)</Kepala>
                    <Kepala className="w-20 text-center">Sesuai</Kepala>
                    <Kepala className="w-64">Catatan bila tidak sesuai</Kepala>
                  </tr>
                </thead>
                <tbody>
                  {baris.map((b) => {
                    const s = isi[b.outletId] ?? { sesuai: b.sesuai, catatan: "" };
                    return (
                      <tr key={b.outletId} className="border-b border-border/60 last:border-0">
                        <td className="px-3 py-1.5">
                          <p className="font-medium text-foreground">{b.outletNama}</p>
                          {b.netSales === null && (
                            <p className="text-[11px] text-amber-600 dark:text-amber-400">belum tersambung ke ESB</p>
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                          {b.netSales === null ? "—" : formatIDR(b.netSales)}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-foreground/80">
                          {b.feeSeharusnya === null ? "—" : formatIDR(b.feeSeharusnya)}
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          <input
                            type="checkbox"
                            className="size-4 accent-brand-500"
                            checked={s.sesuai}
                            onChange={(e) => alih(b.outletId, e.target.checked)}
                            aria-label={`Management fee ${b.outletNama} sesuai`}
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <Input
                            className="h-8"
                            placeholder={s.sesuai ? "" : "laporan 10.000.000, sistem 9.000.000"}
                            value={s.catatan}
                            onChange={(e) => catat(b.outletId, e.target.value)}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-3 flex shrink-0 items-center justify-between gap-2">
              <span className="text-[12px] text-muted-foreground">
                {dicentang} dari {baris.length} outlet tercentang sesuai
              </span>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setBuka(false)} disabled={sibuk}>
                  Batal
                </Button>
                <Button onClick={simpan} disabled={sibuk}>
                  {sibuk ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Simpan semua
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
