"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Paperclip, Plus, Save, Table2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  simpanEfisiensiMassalAction,
  simpanEntriMassalAction,
  simpanOutletBulananAction,
  simpanFeeMassalAction,
  simpanMenuPasarMassalAction,
  uploadKpiBuktiAction,
} from "@/lib/actions/kpi";
import type { BarisEfisiensi } from "@/lib/kpi/hitung";
import type { JenisEntri } from "@/lib/kpi/indikator";
import type { DetailFee } from "@/lib/data/kpi";
import { uploadMany } from "@/lib/upload-client";
import { labelPeriode } from "./periode";
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
                        {b.average === null && (
                          <p className="text-[11px] text-amber-600 dark:text-amber-400">{b.alasan ?? "belum ada data ESB"}</p>
                        )}
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

export function FormFee({ posisi, periode, pic, baris }: { posisi: string; periode: string; pic: string; baris: DetailFee[] }) {
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
    const res = await simpanFeeMassalAction({ posisi, periode, pic, baris: kirim });
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
                            <p className="text-[11px] text-amber-600 dark:text-amber-400">{b.alasan ?? "belum ada data ESB"}</p>
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

/* ─────────── catat kegiatan & angka bulanan (satu pintu masuk) ─────────── */

export interface OpsiKegiatan {
  /** Jenis entri yang ditulis, mis. `event`; atau angka bulanan per outlet. */
  jenis: JenisEntri | "net_profit" | "hpp" | "gross_manual";
  /** Nama indikatornya di layar, mis. "Total Event / Program". */
  label: string;
  /** Tiap barisnya wajib berlampiran. */
  bukti?: boolean;
}

export interface OutletBaris {
  outletId: string;
  outletNama: string;
  gross: number | null;
  dariEsb: boolean;
  netProfit: number | null;
  hpp: number | null;
  ikut: boolean;
}

/** Kenapa outlet ini belum ikut dinilai — dibedakan supaya tidak menyesatkan. */
function alasanBelumIkut(bulanKosong: string[]): string {
  return bulanKosong.length > 0
    ? "angka ESB bulan pembanding belum ditarik"
    : "belum genap 3 bulan — belum ikut dinilai";
}

interface BarisKegiatan {
  tanggal: string;
  picNama: string;
  outletId: string;
  judul: string;
  deskripsi: string;
  bukti: File[];
}

const BARIS_AWAL = 5;

/**
 * SATU pintu masuk untuk seluruh isian bulanan.
 *
 * Sebelumnya ada dua: tombol Input untuk angka satuan, dan tabel ini untuk
 * kegiatan. Dua pintu ke tujuan yang sama membuat orang bertanya-tanya yang
 * mana yang benar, dan angka yang sama bisa masuk dua kali lewat jalan yang
 * berbeda. Sekarang indikatornya dipilih di sini, dan tabelnya berganti
 * mengikuti — kegiatan berbaris tanggal, angka bulanan berbaris outlet.
 */
export function FormKegiatan({
  posisi,
  periode,
  pic,
  picOpsi,
  opsi,
  outlet,
  bulanKosong,
}: {
  posisi: string;
  periode: string;
  pic: string;
  picOpsi: string[];
  opsi: OpsiKegiatan[];
  outlet: OutletBaris[];
  bulanKosong: string[];
}) {
  const router = useRouter();
  const [buka, setBuka] = React.useState(false);
  const [sibuk, setSibuk] = React.useState(false);
  const [jenis, setJenis] = React.useState<OpsiKegiatan["jenis"]>(opsi[0]?.jenis ?? "event");
  const [baris, setBaris] = React.useState<BarisKegiatan[]>([]);
  const [isiOutlet, setIsiOutlet] = React.useState<Record<string, { gross: string; netProfit: string; hpp: string }>>({});

  const dipilih = opsi.find((o) => o.jenis === jenis) ?? opsi[0];
  const perOutlet = jenis === "net_profit" || jenis === "hpp" || jenis === "gross_manual";
  const perluBukti = !!dipilih?.bukti;

  const kosong = React.useCallback(
    (): BarisKegiatan => ({ tanggal: `${periode}-01`, picNama: pic || picOpsi[0] || "", outletId: "", judul: "", deskripsi: "", bukti: [] }),
    [periode, pic, picOpsi],
  );

  function bukaForm() {
    setJenis(opsi[0]?.jenis ?? "event");
    setBaris(Array.from({ length: BARIS_AWAL }, kosong));
    setIsiOutlet(
      Object.fromEntries(
        outlet.map((o) => [
          o.outletId,
          {
            gross: o.dariEsb || o.gross === null ? "" : String(o.gross),
            netProfit: o.netProfit === null ? "" : String(o.netProfit),
            hpp: o.hpp === null ? "" : String(o.hpp),
          },
        ]),
      ),
    );
    setBuka(true);
  }

  const ubah = (i: number, kolom: keyof BarisKegiatan, v: string | File[]) =>
    setBaris((s) => s.map((b, n) => (n === i ? { ...b, [kolom]: v } : b)));

  const ubahOutlet = (id: string, kolom: "gross" | "netProfit" | "hpp", v: string) =>
    setIsiOutlet((s) => ({ ...s, [id]: { ...(s[id] ?? { gross: "", netProfit: "", hpp: "" }), [kolom]: v } }));

  async function simpanOutlet() {
    const kirim = outlet
      .map((o) => {
        const isi = isiOutlet[o.outletId];
        if (!isi) return null;
        const nilai = num(jenis === "gross_manual" ? isi.gross : jenis === "net_profit" ? isi.netProfit : isi.hpp);
        if (nilai === null) return null;
        const lama = jenis === "gross_manual" ? (o.dariEsb ? null : o.gross) : jenis === "net_profit" ? o.netProfit : o.hpp;
        if (nilai === lama) return null; // tidak berubah — tidak perlu ditulis ulang
        return {
          outletId: o.outletId,
          ...(jenis === "gross_manual" ? { gross: nilai } : jenis === "net_profit" ? { netProfit: nilai } : { hpp: nilai }),
        };
      })
      .filter(Boolean) as { outletId: string; gross?: number; netProfit?: number; hpp?: number }[];

    if (kirim.length === 0) {
      toast.info("Tidak ada yang berubah.");
      return;
    }
    setSibuk(true);
    const res = await simpanOutletBulananAction({ posisi, periode, pic, baris: kirim });
    setSibuk(false);
    if (res.error) return toast.error(res.error);
    toast.success(`${res.tersimpan} outlet tersimpan`);
    setBuka(false);
    router.refresh();
  }

  async function simpanKegiatan() {
    const isi = baris.filter((b) => b.judul.trim() !== "" || b.bukti.length > 0);
    if (isi.length === 0) {
      toast.info("Belum ada baris yang diisi.");
      return;
    }
    if (perluBukti && isi.some((b) => b.bukti.length === 0)) {
      toast.error("Ada baris tanpa bukti — tiap catatan wajib berlampiran.");
      return;
    }

    setSibuk(true);
    try {
      // Diunggah baris demi baris supaya berkas milik satu baris tidak pernah
      // tertukar ke baris lain saat sebagiannya gagal.
      const kirim = [];
      for (const b of isi) {
        const lampiran = b.bukti.length > 0 ? await uploadMany("kpi", b.bukti, uploadKpiBuktiAction) : [];
        kirim.push({
          tanggal: b.tanggal,
          picNama: b.picNama,
          outletId: b.outletId || null,
          judul: b.judul.trim(),
          deskripsi: b.deskripsi.trim(),
          lampiran,
        });
      }
      const res = await simpanEntriMassalAction({ posisi, periode, pic, jenis: jenis as JenisEntri, baris: kirim });
      if (res.error) return toast.error(res.error);
      toast.success(`${res.tersimpan} baris tersimpan`);
      setBuka(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Unggah bukti gagal.");
    } finally {
      setSibuk(false);
    }
  }

  if (opsi.length === 0) return null;

  return (
    <>
      <Button size="sm" variant="outline" className="gap-1.5" onClick={bukaForm}>
        <Table2 className="size-4" /> Catat Kegiatan
      </Button>

      <Dialog open={buka} onOpenChange={setBuka}>
        <DialogContent
          title="Catat Kegiatan"
          description="Satu tabel untuk sebulan — pilih indikatornya, isi barisnya, lalu simpan sekali"
          align="center"
          className="max-w-5xl"
        >
          <div className="flex max-h-[78vh] flex-col p-5">
            <div className="mb-3 flex shrink-0 flex-wrap items-center gap-2">
              <span className="text-[12px] font-medium text-muted-foreground">Indikator</span>
              <Combobox
                portal
                searchable={false}
                className="w-72"
                value={jenis}
                onChange={(v) => setJenis(v as OpsiKegiatan["jenis"])}
                options={opsi.map((o) => ({ value: o.jenis, label: o.label }))}
              />
              <span className="text-[12px] text-muted-foreground">
                {perOutlet
                  ? `Angka ${labelPeriode(periode)} per outlet.`
                  : `Satu baris terisi bernilai satu poin pada ${labelPeriode(periode)}.`}
              </span>
            </div>

            {perOutlet ? (
              <TabelOutlet jenis={jenis} outlet={outlet} isi={isiOutlet} ubah={ubahOutlet} bulanKosong={bulanKosong} />
            ) : (
              <TabelKegiatan
                baris={baris}
                picOpsi={picOpsi}
                outlet={outlet}
                perluBukti={perluBukti}
                ubah={ubah}
              />
            )}

            <div className="mt-3 flex shrink-0 items-center justify-between gap-2">
              {perOutlet ? (
                <span className="text-[12px] text-muted-foreground">
                  Kosongkan yang tidak diubah — yang kosong tidak ditulis ulang.
                </span>
              ) : (
                <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => setBaris((s) => [...s, kosong()])} disabled={sibuk}>
                  <Plus className="size-4" /> Tambah baris
                </Button>
              )}
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setBuka(false)} disabled={sibuk}>
                  Batal
                </Button>
                <Button onClick={perOutlet ? simpanOutlet : simpanKegiatan} disabled={sibuk}>
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

/** Tabel kegiatan: satu baris satu kejadian. */
function TabelKegiatan({
  baris,
  picOpsi,
  outlet,
  perluBukti,
  ubah,
}: {
  baris: BarisKegiatan[];
  picOpsi: string[];
  outlet: OutletBaris[];
  perluBukti: boolean;
  ubah: (i: number, kolom: keyof BarisKegiatan, v: string | File[]) => void;
}) {
  return (
    <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-border">
      <table className="w-full min-w-[900px] border-collapse text-sm">
        <thead className="sticky top-0 z-10">
          <tr className="border-b border-border text-left">
            <Kepala className="w-10 text-center">#</Kepala>
            <Kepala className="w-44">Tanggal</Kepala>
            <Kepala className="w-40">PIC</Kepala>
            <Kepala className="w-52">Outlet</Kepala>
            <Kepala>Nama Kegiatan</Kepala>
            {perluBukti && <Kepala className="w-44">Bukti submit</Kepala>}
            <Kepala>Keterangan</Kepala>
          </tr>
        </thead>
        <tbody>
          {baris.map((b, i) => (
            <tr key={i} className="border-b border-border/60 last:border-0">
              <td className="px-3 py-1.5 text-center text-[12px] tabular-nums text-muted-foreground">{i + 1}</td>
              <td className="px-3 py-1.5">
                <DatePicker value={b.tanggal} onChange={(v) => ubah(i, "tanggal", v)} />
              </td>
              <td className="px-3 py-1.5">
                {picOpsi.length > 0 ? (
                  <Combobox
                    portal
                    searchable={false}
                    className="w-full"
                    value={b.picNama}
                    onChange={(v) => ubah(i, "picNama", v)}
                    options={picOpsi.map((p) => ({ value: p, label: p }))}
                  />
                ) : (
                  <Input className="h-8" value={b.picNama} onChange={(e) => ubah(i, "picNama", e.target.value)} />
                )}
              </td>
              <td className="px-3 py-1.5">
                <Combobox
                  portal
                  searchPlaceholder="Cari outlet…"
                  className="w-full"
                  value={b.outletId}
                  onChange={(v) => ubah(i, "outletId", v)}
                  options={[{ value: "", label: "— tanpa outlet —" }, ...outlet.map((o) => ({ value: o.outletId, label: o.outletNama }))]}
                />
              </td>
              <td className="px-3 py-1.5">
                <Input className="h-8" placeholder="…" value={b.judul} onChange={(e) => ubah(i, "judul", e.target.value)} />
              </td>
              {perluBukti && (
                <td className="px-3 py-1.5">
                  <BuktiBaris berkas={b.bukti} onPilih={(f) => ubah(i, "bukti", f)} />
                </td>
              )}
              <td className="px-3 py-1.5">
                <Input className="h-8" placeholder="opsional" value={b.deskripsi} onChange={(e) => ubah(i, "deskripsi", e.target.value)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Pemilih berkas satu baris — tombolnya milik aplikasi, bukan bawaan peramban. */
function BuktiBaris({ berkas, onPilih }: { berkas: File[]; onPilih: (f: File[]) => void }) {
  const ref = React.useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-1">
      <input
        ref={ref}
        type="file"
        accept="image/png,image/jpeg,application/pdf"
        multiple
        hidden
        onChange={(e) => onPilih([...(e.target.files ?? [])])}
      />
      <Button type="button" size="sm" variant="outline" className="h-8 w-full gap-1.5" onClick={() => ref.current?.click()}>
        <Paperclip className="size-3.5" /> {berkas.length > 0 ? `${berkas.length} berkas` : "Pilih"}
      </Button>
      {berkas.length > 0 && <p className="truncate text-[10.5px] text-muted-foreground">{berkas.map((f) => f.name).join(", ")}</p>}
    </div>
  );
}

/** Tabel angka bulanan: satu baris satu outlet. */
function TabelOutlet({
  jenis,
  outlet,
  isi,
  ubah,
  bulanKosong,
}: {
  jenis: OpsiKegiatan["jenis"];
  outlet: OutletBaris[];
  isi: Record<string, { gross: string; netProfit: string; hpp: string }>;
  ubah: (id: string, kolom: "gross" | "netProfit" | "hpp", v: string) => void;
  bulanKosong: string[];
}) {
  // Gross manual HANYA untuk outlet yang ESB-nya tidak punya angkanya. Yang
  // lain ditampilkan apa adanya dan tidak bisa diketik — angka yang bisa
  // diperdebatkan tidak boleh mengalahkan angka yang tidak bisa.
  const daftar = jenis === "gross_manual" ? outlet.filter((o) => !o.dariEsb) : outlet;
  const kolom = jenis === "gross_manual" ? "gross" : jenis === "net_profit" ? "netProfit" : "hpp";
  const judul = jenis === "gross_manual" ? "Gross Sales (Rp)" : jenis === "net_profit" ? "Net Profit (Rp)" : "HPP (%)";

  if (daftar.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center rounded-xl border border-border px-6 py-10 text-center text-[13px] text-muted-foreground">
        Seluruh outlet di area ini sudah punya angka dari ESB — tidak ada yang perlu diisi tangan.
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-border">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead className="sticky top-0 z-10">
          <tr className="border-b border-border text-left">
            <Kepala>Outlet</Kepala>
            {jenis !== "gross_manual" && <Kepala className="text-right">Gross Sales</Kepala>}
            <Kepala className="w-52">{judul}</Kepala>
          </tr>
        </thead>
        <tbody>
          {daftar.map((o) => (
            <tr key={o.outletId} className="border-b border-border/60 last:border-0">
              <td className="px-3 py-1.5">
                <p className="font-medium text-foreground">{o.outletNama}</p>
                {!o.ikut && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400">{alasanBelumIkut(bulanKosong)}</p>
                )}
              </td>
              {jenis !== "gross_manual" && (
                <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                  {o.gross === null ? "—" : formatIDR(o.gross)}
                </td>
              )}
              <td className="px-3 py-1.5">
                <Input
                  inputMode="numeric"
                  className="h-8"
                  placeholder={jenis === "hpp" ? "mis. 37.5" : "0"}
                  value={isi[o.outletId]?.[kolom] ?? ""}
                  onChange={(e) => ubah(o.outletId, kolom, e.target.value)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─────────────────── ceklis menu keberhasilan pasar ─────────────────── */

export interface MenuEsb {
  menu: string;
  kategori: string;
  /** Penjualan 30 hari terakhir menurut katalog ESB. */
  estimasi: number;
}

/**
 * Pemilih menu dari katalog ESB — dicentang, bukan diketik.
 *
 * Diminta: "nama menu harusnya otomatis muncul, saya bisa pilih beberapa menu
 * di dalam sini tinggal ceklis aja". Selain lebih cepat, ini menutup satu
 * kesalahan yang tidak pernah kelihatan: nama menu yang diketik sendiri tidak
 * akan pernah cocok dengan nama di ESB, dan penjualannya berhenti terbaca
 * berbulan-bulan tanpa ada pesan salah satu pun.
 *
 * ANGKA PENJUALANNYA MASIH BISA DIUBAH, DAN ITU DISENGAJA. Katalog ESB hanya
 * menyimpan penjualan 30 hari terakhir, sedangkan indikator ini menghitung tiga
 * bulan. Angka katalog dipakai sebagai isian awal — jelas ditulis rentangnya —
 * supaya tidak ada yang mengira 30 hari itu sudah tiga bulan.
 */
export function FormMenuPasar({
  posisi,
  periode,
  pic,
  katalog,
  terpilih,
}: {
  posisi: string;
  periode: string;
  pic: string;
  katalog: MenuEsb[];
  terpilih: { menu: string; penjualan: number }[];
}) {
  const router = useRouter();
  const [buka, setBuka] = React.useState(false);
  const [sibuk, setSibuk] = React.useState(false);
  const [cari, setCari] = React.useState("");
  const [isi, setIsi] = React.useState<Record<string, { pilih: boolean; penjualan: string }>>({});

  function bukaForm() {
    const sudah = new Map(terpilih.map((t) => [t.menu, t.penjualan]));
    setIsi(
      Object.fromEntries(
        katalog.map((m) => {
          const n = sudah.get(m.menu);
          return [m.menu, { pilih: n !== undefined, penjualan: n === undefined ? "" : String(n) }];
        }),
      ),
    );
    setCari("");
    setBuka(true);
  }

  const alih = (m: MenuEsb, pilih: boolean) =>
    setIsi((s) => ({
      ...s,
      // Saat dicentang, angka penjualannya langsung terisi dari ESB supaya tidak
      // ada yang perlu diketik ulang; yang sudah pernah diisi tidak ditimpa.
      [m.menu]: { pilih, penjualan: s[m.menu]?.penjualan || (pilih ? String(Math.round(m.estimasi)) : "") },
    }));

  const isiPenjualan = (menu: string, v: string) =>
    setIsi((s) => ({ ...s, [menu]: { pilih: s[menu]?.pilih ?? true, penjualan: v } }));

  const tampil = React.useMemo(() => {
    const q = cari.trim().toLowerCase();
    if (!q) return katalog;
    return katalog.filter((m) => m.menu.toLowerCase().includes(q) || m.kategori.toLowerCase().includes(q));
  }, [katalog, cari]);

  const dipilih = katalog.filter((m) => isi[m.menu]?.pilih);

  async function simpan() {
    const kirim = dipilih.map((m) => ({ menu: m.menu, penjualan: num(isi[m.menu].penjualan) ?? 0 }));
    if (kirim.length === 0) {
      toast.info("Belum ada menu yang dicentang.");
      return;
    }
    setSibuk(true);
    const res = await simpanMenuPasarMassalAction({ posisi, periode, pic, baris: kirim });
    setSibuk(false);
    if (res.error) return toast.error(res.error);
    toast.success(`${res.tersimpan} menu tersimpan`);
    setBuka(false);
    router.refresh();
  }

  return (
    <>
      <Button size="sm" variant="outline" className="gap-1.5" onClick={bukaForm} disabled={katalog.length === 0}>
        <Table2 className="size-4" /> Pilih Menu
      </Button>

      <Dialog open={buka} onOpenChange={setBuka}>
        <DialogContent
          title="Pilih Menu yang Dinilai"
          description="Nama menu diambil dari katalog ESB — centang yang dinilai bulan ini"
          align="center"
          className="max-w-4xl"
        >
          <div className="flex max-h-[75vh] flex-col p-5">
            <div className="mb-3 flex shrink-0 flex-wrap items-center gap-2">
              <Input
                className="h-9 w-64"
                placeholder="Cari menu atau kategori…"
                value={cari}
                onChange={(e) => setCari(e.target.value)}
              />
              <span className="text-[12px] text-muted-foreground">
                {dipilih.length} menu dicentang dari {katalog.length} menu ESB.
              </span>
            </div>

            <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-border">
              <table className="w-full min-w-[720px] border-collapse text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-border text-left">
                    <Kepala className="w-14 text-center">Pilih</Kepala>
                    <Kepala>Nama Menu</Kepala>
                    <Kepala>Kategori</Kepala>
                    <Kepala className="w-52">Penjualan 3 Bulan</Kepala>
                  </tr>
                </thead>
                <tbody>
                  {tampil.map((m) => {
                    const s = isi[m.menu] ?? { pilih: false, penjualan: "" };
                    return (
                      <tr key={m.menu} className="border-b border-border/60 last:border-0">
                        <td className="px-3 py-1.5 text-center">
                          <input
                            type="checkbox"
                            className="size-4 accent-brand-500"
                            checked={s.pilih}
                            onChange={(e) => alih(m, e.target.checked)}
                            aria-label={`Nilai menu ${m.menu}`}
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <p className="font-medium text-foreground">{m.menu}</p>
                          <p className="text-[11px] text-muted-foreground">
                            30 hari terakhir di ESB: {formatIDR(m.estimasi)}
                          </p>
                        </td>
                        <td className="px-3 py-1.5 text-muted-foreground">{m.kategori || "—"}</td>
                        <td className="px-3 py-1.5">
                          <Input
                            inputMode="numeric"
                            className="h-8"
                            placeholder="0"
                            disabled={!s.pilih}
                            value={s.penjualan}
                            onChange={(e) => isiPenjualan(m.menu, e.target.value)}
                          />
                        </td>
                      </tr>
                    );
                  })}
                  {tampil.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                        Tidak ada menu yang cocok.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <p className="mt-3 shrink-0 text-[12px] leading-relaxed text-muted-foreground">
              Omsetnya tidak diisi: diambil sendiri dari net sales ESB pada rentang yang sama. Angka penjualan terisi
              otomatis dari katalog ESB yang berjangka 30 hari — sesuaikan bila angka tiga bulannya berbeda.
            </p>

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
