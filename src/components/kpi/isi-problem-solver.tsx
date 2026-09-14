"use client";

import * as React from "react";
import * as XLSX from "xlsx";
import { Download, FileUp, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { angkaExcel } from "@/lib/ops/angka-excel";
import {
  daftarProblemSolverAction,
  simpanProblemSolverAction,
  type BarisProblemSolver,
} from "@/lib/actions/problem-solver";
import { labelPeriode } from "./periode";
import { cn } from "@/lib/utils";

/**
 * Isian Problem Solver — satu angka per outlet, untuk lima puluh delapan outlet.
 *
 * DUA JALAN MASUK, satu tujuan. Berkas untuk pengisian bulanan: unduh template
 * yang sudah berisi nama outletnya, isi di Excel, unggah kembali. Ketikan di
 * layar untuk perbaikan satu-dua baris — membuka Excel demi mengubah satu
 * angka lebih lama daripada mengetiknya.
 *
 * TEMPLATENYA SUDAH BERISI ANGKA YANG TERSIMPAN, bukan kolom kosong. Yang
 * mengunduhnya di tengah bulan mendapat apa yang sudah ada dan tinggal
 * menambah; template kosong membuat pengisian kedua menghapus pengisian
 * pertama tanpa ada yang menyadarinya.
 *
 * ID OUTLET IKUT DI KOLOM PERTAMA. Mencocokkan kembali lewat nama akan gagal
 * diam-diam begitu ada outlet yang berganti nama — dan yang gagal itu tidak
 * mengeluh, ia hanya tidak tersimpan.
 */

const SHEET = "Problem Solver";
const KOL_ID = "ID Outlet";
const KOL_NAMA = "Nama Outlet";
const KOL_KODE = "Kode";
const KOL_JENIS = "Jenis";
const KOL_ISI = "Jumlah Problem Solver";

export function IsiProblemSolver({
  open,
  onOpenChange,
  periode,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  periode: string;
}) {
  const [baris, setBaris] = React.useState<BarisProblemSolver[] | null>(null);
  const [nilai, setNilai] = React.useState<Record<string, string>>({});
  const [simpan, setSimpan] = React.useState(false);
  const berkas = React.useRef<HTMLInputElement>(null);

  // Dibaca ulang tiap kali dibuka. TANPA `setBaris(null)` sinkron di sini:
  // setState di dalam badan efek memicu render bertingkat, dan yang
  // didapatnya cuma satu kedipan pemuat. Daftar lama tetap terlihat sampai
  // yang baru datang — dan daftar lama bukan daftar yang salah.
  React.useEffect(() => {
    if (!open) return;
    let batal = false;
    daftarProblemSolverAction(periode).then((d) => {
      if (batal) return;
      setBaris(d);
      setNilai(Object.fromEntries(d.map((b) => [b.outletId, b.jumlah === null ? "" : String(b.jumlah)])));
    });
    return () => {
      batal = true;
    };
  }, [open, periode]);

  const terisi = baris?.filter((b) => (nilai[b.outletId] ?? "").trim() !== "").length ?? 0;

  function unduh() {
    if (!baris) return;
    const aoa = [
      [KOL_ID, KOL_KODE, KOL_NAMA, KOL_JENIS, KOL_ISI],
      ...baris.map((b) => [b.outletId, b.kode, b.nama, b.jenis, nilai[b.outletId] ?? ""]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [{ wch: 40 }, { wch: 10 }, { wch: 34 }, { wch: 8 }, { wch: 22 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, SHEET);
    XLSX.writeFile(wb, `Problem Solver ${periode}.xlsx`);
  }

  async function bacaBerkas(f: File) {
    try {
      const wb = XLSX.read(await f.arrayBuffer(), { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
      // Judul dicocokkan tanpa membedakan besar-kecil huruf dan spasi berlebih:
      // berkas yang pulang lewat WhatsApp sering berubah sedikit, dan menolaknya
      // karena itu membuat orang menyerah lalu mengetik manual.
      const rapikan = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
      const cari = (r: Record<string, unknown>, judul: string) => {
        const k = Object.keys(r).find((x) => rapikan(x) === rapikan(judul));
        return k === undefined ? "" : String(r[k] ?? "");
      };
      const sah = new Set((baris ?? []).map((b) => b.outletId));
      const masuk: Record<string, string> = {};
      let lewat = 0;
      for (const r of rows) {
        const id = cari(r, KOL_ID).trim();
        if (!id || !sah.has(id)) {
          if (Object.values(r).some((v) => String(v ?? "").trim() !== "")) lewat += 1;
          continue;
        }
        const isi = cari(r, KOL_ISI).trim();
        if (isi === "") continue;
        const n = angkaExcel(isi);
        if (n === null || n < 0) continue;
        masuk[id] = String(Math.round(n));
      }
      const jumlah = Object.keys(masuk).length;
      if (jumlah === 0) {
        toast.error("Tidak ada baris yang terbaca. Pastikan berkasnya hasil unduhan template ini.");
        return;
      }
      setNilai((lama) => ({ ...lama, ...masuk }));
      toast.success(
        lewat > 0
          ? `${jumlah} outlet terbaca. ${lewat} baris dilewati karena outletnya tidak dikenali.`
          : `${jumlah} outlet terbaca — periksa dulu, lalu tekan Simpan.`,
      );
    } catch {
      toast.error("Berkasnya tidak bisa dibaca. Pastikan formatnya .xlsx.");
    }
  }

  async function kirim() {
    if (!baris) return;
    const isi = baris
      .map((b) => ({ outletId: b.outletId, teks: (nilai[b.outletId] ?? "").trim() }))
      .filter((x) => x.teks !== "")
      .map((x) => ({ outletId: x.outletId, jumlah: Number(x.teks) }))
      .filter((x) => Number.isFinite(x.jumlah) && x.jumlah >= 0);
    if (isi.length === 0) {
      toast.error("Belum ada satu angka pun yang diisi.");
      return;
    }
    setSimpan(true);
    try {
      const h = await simpanProblemSolverAction({ periode, baris: isi });
      if (h.error) toast.error(h.error);
      else {
        toast.success(`${h.tersimpan} outlet tersimpan.`);
        onOpenChange(false);
      }
    } finally {
      setSimpan(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Isi Problem Solver"
        description={`${labelPeriode(periode)} · satu angka per outlet, target 10`}
        className="max-w-3xl"
      >
        <div className="flex h-[72vh] flex-col">
          <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
            <Button variant="outline" onClick={unduh} disabled={!baris}>
              <Download className="size-4" /> Unduh Template
            </Button>
            <Button variant="outline" onClick={() => berkas.current?.click()} disabled={!baris}>
              <FileUp className="size-4" /> Unggah Berkas
            </Button>
            <input
              ref={berkas}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void bacaBerkas(f);
                e.target.value = "";
              }}
            />
            <span className="ml-auto text-[12px] tabular-nums text-muted-foreground">
              {terisi} dari {baris?.length ?? 0} outlet terisi
            </span>
            <Button onClick={kirim} disabled={simpan || !baris}>
              {simpan ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Simpan
            </Button>
          </div>

          {!baris ? (
            <div className="grid flex-1 place-items-center">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto">
              <table className="w-full border-collapse text-left">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-muted">
                    <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Outlet</th>
                    <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Jenis</th>
                    <th className="w-32 px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Jumlah
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {baris.map((b) => (
                    <tr key={b.outletId} className="border-t border-border/70">
                      <td className="px-3 py-1.5">
                        <span className="block text-[13px] text-foreground">{b.nama}</span>
                        <span className="block text-[11px] text-muted-foreground">{b.kode}</span>
                      </td>
                      <td className="px-3 py-1.5">
                        <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">{b.jenis}</span>
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        <input
                          value={nilai[b.outletId] ?? ""}
                          onChange={(e) =>
                            setNilai((l) => ({ ...l, [b.outletId]: e.target.value.replace(/[^\d]/g, "") }))
                          }
                          inputMode="numeric"
                          placeholder="—"
                          className={cn(
                            "h-8 w-24 rounded-md border bg-background/40 px-2 text-right text-[13px] tabular-nums outline-none focus:border-ring",
                            (nilai[b.outletId] ?? "").trim() === "" ? "border-input" : "border-brand-600/40",
                          )}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
