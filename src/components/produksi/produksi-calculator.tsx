"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Boxes, Calculator, Flame, History, Loader2, Package, Plus, RotateCcw, Save, Scale, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { StatTile } from "@/components/ui/stat";
import { useConfirm } from "@/components/ui/confirm";
import { cn } from "@/lib/utils";
import { UNITS, itemSubtotal, type VariableItem } from "@/lib/hpp/calc";
import { SATUAN_HASIL, hitungProduksi, satuanSejenis, type OverheadProduksi, type ProduksiMode } from "@/lib/produksi/calc";
import { hapusProduksiAction, perbaruiProduksiAction, simpanProduksiAction } from "@/lib/actions/produksi";
import type { ProduksiRecord } from "@/lib/data/produksi";

const rp = (n: number) => "Rp " + Math.round(n || 0).toLocaleString("id-ID");
const uid = () => Math.random().toString(36).slice(2, 9);
const angka = (v: string) => Number(String(v).replace(/[^\d.-]/g, "")) || 0;

const KATEGORI = [
  { value: "olahan", label: "Olahan Dapur" },
  { value: "bakery", label: "Bakery & Pastry" },
  { value: "minuman", label: "Bahan Minuman" },
  { value: "kemasan", label: "Repack / Kemasan" },
  { value: "lainnya", label: "Lainnya" },
];

const bahanKosong = (): VariableItem => ({ id: uid(), name: "", takaran: 0, takaranUnit: "g", buyPrice: 0, buyQty: 1, buyUnit: "kg" });
const overheadKosong = (): OverheadProduksi => ({ id: uid(), name: "", biaya: 0 });

/** Overhead yang hampir selalu ada di gudang — sekali tekan, tidak perlu diketik. */
const OVERHEAD_UMUM = ["Gas", "Listrik", "Air", "Tenaga Kerja", "Kemasan", "Penyusutan Alat"];

function NumInput({
  value,
  onChange,
  className,
  placeholder,
}: {
  value: number;
  onChange: (n: number) => void;
  className?: string;
  placeholder?: string;
}) {
  const [teks, setTeks] = React.useState(String(value || ""));
  const [terakhir, setTerakhir] = React.useState(value);

  // Menyelaraskan teks saat nilainya berubah DARI LUAR (mis. formulir dimuat
  // ulang untuk mengubah resep lama). Dilakukan saat render, bukan di dalam
  // effect: effect berjalan setelah layar tergambar, jadi angka lama sempat
  // terlihat sekejap lalu berganti.
  //
  // Teks yang sedang diketik tidak ikut ditimpa selama artinya masih sama.
  // Tanpa syarat itu, mengetik "12." langsung dipangkas jadi "12" dan koma
  // desimalnya mustahil dimasukkan.
  if (value !== terakhir) {
    setTerakhir(value);
    if (angka(teks) !== value) setTeks(value ? String(value) : "");
  }
  return (
    <Input
      value={teks}
      inputMode="decimal"
      placeholder={placeholder}
      className={className}
      onChange={(e) => {
        setTeks(e.target.value);
        onChange(angka(e.target.value));
      }}
    />
  );
}

function UnitSelect({ value, onChange, opsi }: { value: string; onChange: (v: string) => void; opsi: string[] }) {
  return (
    <Combobox
      value={value}
      onChange={onChange}
      options={opsi.map((u) => ({ value: u, label: UNITS[u]?.label ?? u }))}
      matchTriggerWidth
    />
  );
}

/**
 * Kalkulator HPP Produksi — gudang (Supply Chain).
 *
 * Bentuknya sengaja dibuat sama dengan Kalkulator HPP milik PDQ: baris bahan
 * dengan takaran dan harga beli, blok overhead, lalu kartu hasil di kanan. Yang
 * memakai keduanya sering orang yang sama, dan tata letak yang berbeda memaksa
 * mereka belajar dua kali untuk pekerjaan yang mirip.
 *
 * Yang BERBEDA hanya pertanyaannya, dan itu terlihat di kolomnya:
 *  • tidak ada harga jual, margin, maupun target omset — gudang tidak menjual;
 *  • overhead diisi PER SEKALI MASAK, bukan per bulan;
 *  • ada hasil produksi dan penyusutan, karena itu yang menentukan biaya satuan.
 */
export function ProduksiCalculator({
  riwayat,
  bisaEdit,
}: {
  riwayat: ProduksiRecord[];
  bisaEdit: boolean;
}) {
  const router = useRouter();
  const { confirm, dialog } = useConfirm();
  const [pending, startTransition] = React.useTransition();

  const [editId, setEditId] = React.useState<string | null>(null);
  const [nama, setNama] = React.useState("");
  const [kategori, setKategori] = React.useState("olahan");
  const [mode, setMode] = React.useState<ProduksiMode>("batch");
  const [hasil, setHasil] = React.useState(0);
  const [hasilUnit, setHasilUnit] = React.useState("pcs");
  const [susutPct, setSusutPct] = React.useState(0);
  const [bahan, setBahan] = React.useState<VariableItem[]>([bahanKosong()]);
  const [overhead, setOverhead] = React.useState<OverheadProduksi[]>([]);
  const [catatan, setCatatan] = React.useState("");

  const hitung = React.useMemo(
    () => hitungProduksi({ bahan, overhead, hasil: mode === "satuan" ? 1 : hasil, hasilUnit, susutPct }),
    [bahan, overhead, hasil, hasilUnit, susutPct, mode],
  );

  // Peringatan, bukan penolakan: menghasilkan "40 pcs" dari bahan kilogram itu
  // wajar. Yang ditanyakan hanya bila hasilnya berdimensi tapi beda jenis.
  const satuanJanggal = React.useMemo(() => {
    if (mode === "satuan") return false;
    const berat = bahan.find((b) => b.takaran > 0);
    return berat ? !satuanSejenis(hasilUnit, berat.takaranUnit) && !!UNITS[hasilUnit] : false;
  }, [bahan, hasilUnit, mode]);

  function reset() {
    setEditId(null);
    setNama("");
    setKategori("olahan");
    setMode("batch");
    setHasil(0);
    setHasilUnit("pcs");
    setSusutPct(0);
    setBahan([bahanKosong()]);
    setOverhead([]);
    setCatatan("");
  }

  function muat(r: ProduksiRecord) {
    setEditId(r.id);
    setNama(r.nama);
    setKategori(r.kategori);
    setMode(r.mode);
    setHasil(r.hasil);
    setHasilUnit(r.hasilUnit);
    setSusutPct(r.susutPct);
    setBahan(r.bahan.length ? r.bahan : [bahanKosong()]);
    setOverhead(r.overhead);
    setCatatan(r.catatan ?? "");
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function simpan() {
    if (!nama.trim()) return toast.error("Nama produk wajib diisi.");
    if (bahan.every((b) => !b.name.trim())) return toast.error("Tambahkan minimal satu bahan.");
    if (mode === "batch" && hasil <= 0) return toast.error("Hasil sekali masak wajib diisi.");

    const isi = {
      nama,
      kategori,
      mode,
      hasil,
      hasilUnit,
      susutPct,
      // Baris kosong dibuang di sini, bukan disimpan lalu disaring saat dibaca.
      bahan: bahan.filter((b) => b.name.trim()),
      overhead: overhead.filter((o) => o.name.trim()),
      catatan,
    };
    startTransition(async () => {
      const res = editId ? await perbaruiProduksiAction({ ...isi, id: editId }) : await simpanProduksiAction(isi);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success(editId ? "Resep produksi diperbarui." : "Resep produksi tersimpan.");
      reset();
      router.refresh();
    });
  }

  async function hapus(r: ProduksiRecord) {
    const ya = await confirm({
      title: "Hapus resep produksi?",
      description: `"${r.nama}" akan dihapus permanen. Perhitungan biayanya ikut hilang.`,
      confirmLabel: "Hapus",
      tone: "danger",
    });
    if (!ya) return;
    startTransition(async () => {
      const res = await hapusProduksiAction(r.id);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Resep dihapus.");
      if (editId === r.id) reset();
      router.refresh();
    });
  }

  const satuanTampil = mode === "satuan" ? "unit" : hasilUnit;

  return (
    <div className="space-y-4">
      {dialog}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        {/* ── Kiri: formulir ─────────────────────────────────────────── */}
        <div className="min-w-0 space-y-4">
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
              <Package className="size-4 text-muted-foreground" /> Produk
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nama Produk">
                <Input value={nama} onChange={(e) => setNama(e.target.value)} placeholder="mis. Ayam Ungkep" />
              </Field>
              <Field label="Kategori">
                <Combobox value={kategori} onChange={setKategori} options={KATEGORI} />
              </Field>
            </div>

            <Field label="Cara Hitung" className="mt-3" hint="Sekali masak menghasilkan banyak, atau dihitung langsung per satu unit.">
              <div className="flex gap-1.5">
                {(["batch", "satuan"] as ProduksiMode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    aria-pressed={mode === m}
                    className={cn(
                      "flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
                      mode === m
                        ? "border-brand-500/50 bg-brand-500/10 text-foreground"
                        : "border-input text-muted-foreground hover:bg-muted/50",
                    )}
                  >
                    {m === "batch" ? "Sekali Masak (batch)" : "Per Satuan"}
                  </button>
                ))}
              </div>
            </Field>

            {mode === "batch" && (
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <Field label="Hasil Sekali Masak">
                  <NumInput value={hasil} onChange={setHasil} placeholder="40" />
                </Field>
                <Field label="Satuan Hasil">
                  <UnitSelect value={hasilUnit} onChange={setHasilUnit} opsi={[...SATUAN_HASIL]} />
                </Field>
                <Field label="Penyusutan (%)" hint="Susut saat diproses.">
                  <NumInput value={susutPct} onChange={setSusutPct} placeholder="0" />
                </Field>
              </div>
            )}

            {satuanJanggal && (
              <p className="mt-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-[11px] text-foreground/80">
                Satuan hasil <b>{hasilUnit}</b> beda jenis dengan satuan bahan. Ini boleh saja — pastikan saja angkanya memang
                yang Anda maksud.
              </p>
            )}
          </div>

          {/* Bahan */}
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Boxes className="size-4 text-muted-foreground" /> Bahan
                <span className="text-xs font-normal text-muted-foreground">
                  {mode === "batch" ? "untuk sekali masak" : "untuk satu unit"}
                </span>
              </p>
              <Button size="sm" variant="outline" onClick={() => setBahan((b) => [...b, bahanKosong()])}>
                <Plus className="size-4" /> Bahan
              </Button>
            </div>

            <div className="space-y-2">
              {bahan.map((b, i) => (
                <div key={b.id} className="rounded-xl border border-border bg-muted/20 p-2.5">
                  <div className="flex items-center gap-2">
                    <Input
                      value={b.name}
                      onChange={(e) => setBahan((s) => s.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                      placeholder="Nama bahan — mis. Ayam potong"
                      className="flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => setBahan((s) => (s.length === 1 ? [bahanKosong()] : s.filter((_, j) => j !== i)))}
                      aria-label="Hapus bahan"
                      className="grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <Field label="Dipakai">
                      <NumInput value={b.takaran} onChange={(n) => setBahan((s) => s.map((x, j) => (j === i ? { ...x, takaran: n } : x)))} />
                    </Field>
                    <Field label="Satuan">
                      <UnitSelect
                        value={b.takaranUnit}
                        onChange={(v) => setBahan((s) => s.map((x, j) => (j === i ? { ...x, takaranUnit: v } : x)))}
                        opsi={Object.keys(UNITS)}
                      />
                    </Field>
                    <Field label="Harga Beli">
                      <NumInput value={b.buyPrice} onChange={(n) => setBahan((s) => s.map((x, j) => (j === i ? { ...x, buyPrice: n } : x)))} />
                    </Field>
                    <Field label="Isi Pembelian">
                      <div className="flex gap-1.5">
                        <NumInput
                          value={b.buyQty}
                          onChange={(n) => setBahan((s) => s.map((x, j) => (j === i ? { ...x, buyQty: n } : x)))}
                          className="w-16"
                        />
                        <div className="min-w-0 flex-1">
                          <UnitSelect
                            value={b.buyUnit}
                            onChange={(v) => setBahan((s) => s.map((x, j) => (j === i ? { ...x, buyUnit: v } : x)))}
                            opsi={Object.keys(UNITS)}
                          />
                        </div>
                      </div>
                    </Field>
                  </div>
                  <p className="mt-1.5 text-right text-xs text-muted-foreground">
                    Subtotal <b className="text-foreground">{rp(itemSubtotal(b))}</b>
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Overhead */}
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-1 flex items-center justify-between gap-2">
              <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Flame className="size-4 text-muted-foreground" /> Overhead
              </p>
              <Button size="sm" variant="outline" onClick={() => setOverhead((o) => [...o, overheadKosong()])}>
                <Plus className="size-4" /> Overhead
              </Button>
            </div>
            <p className="mb-3 text-[11px] text-muted-foreground">
              Diisi untuk <b>satu kali produksi</b>, bukan per bulan — gas, listrik, dan tenaga kerja yang terpakai pada masakan ini.
            </p>

            {overhead.length === 0 && (
              <div className="flex flex-wrap gap-1.5">
                {OVERHEAD_UMUM.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setOverhead((o) => [...o, { id: uid(), name: n, biaya: 0 }])}
                    className="rounded-lg border border-input px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                  >
                    + {n}
                  </button>
                ))}
              </div>
            )}

            <div className="space-y-2">
              {overhead.map((o, i) => (
                <div key={o.id} className="flex items-center gap-2">
                  <Input
                    value={o.name}
                    onChange={(e) => setOverhead((s) => s.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                    placeholder="Nama biaya"
                    className="min-w-0 flex-1"
                  />
                  <NumInput
                    value={o.biaya}
                    onChange={(n) => setOverhead((s) => s.map((x, j) => (j === i ? { ...x, biaya: n } : x)))}
                    className="w-28 shrink-0"
                    placeholder="0"
                  />
                  <button
                    type="button"
                    onClick={() => setOverhead((s) => s.filter((_, j) => j !== i))}
                    aria-label="Hapus overhead"
                    className="grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <Field label="Catatan (opsional)">
            <Textarea
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              rows={2}
              placeholder="mis. Ungkep 90 menit, api kecil. Simpan chiller maks 3 hari."
            />
          </Field>
        </div>

        {/* ── Kanan: hasil ───────────────────────────────────────────── */}
        <div className="min-w-0 space-y-3 xl:sticky xl:top-4 xl:self-start">
          <div className="rounded-2xl border border-brand-500/30 bg-brand-500/5 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Biaya per {satuanTampil}</p>
            <p className="mt-1 text-3xl font-semibold tracking-tight text-foreground">{rp(hitung.hppPerUnit)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {mode === "batch"
                ? `${rp(hitung.totalBatch)} untuk ${hitung.hasilBersih || 0} ${hasilUnit}`
                : "dihitung untuk satu unit"}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <StatTile icon={Boxes} label="Bahan" value={rp(hitung.biayaBahan)} sub={`${hitung.porsiBahanPct}% dari total`} />
            <StatTile icon={Flame} label="Overhead" value={rp(hitung.biayaOverhead)} />
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between py-1.5 text-sm">
              <span className="text-muted-foreground">Total sekali masak</span>
              <span className="font-medium text-foreground">{rp(hitung.totalBatch)}</span>
            </div>
            {mode === "batch" && (
              <>
                <div className="flex items-center justify-between border-t border-border py-1.5 text-sm">
                  <span className="text-muted-foreground">Hasil kotor</span>
                  <span className="font-medium text-foreground">
                    {hasil || 0} {hasilUnit}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-border py-1.5 text-sm">
                  <span className="text-muted-foreground">Setelah susut {susutPct || 0}%</span>
                  <span className="font-medium text-foreground">
                    {hitung.hasilBersih} {hasilUnit}
                  </span>
                </div>
              </>
            )}
          </div>

          {bisaEdit && (
            <div className="flex gap-2">
              <Button onClick={simpan} disabled={pending} className="flex-1">
                {pending ? <Loader2 className="animate-spin" /> : <Save className="size-4" />}
                {editId ? "Perbarui" : "Simpan"}
              </Button>
              {editId && (
                <Button variant="outline" onClick={reset} disabled={pending}>
                  <RotateCcw className="size-4" /> Batal
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Riwayat ────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
          <History className="size-4 text-muted-foreground" /> Resep Tersimpan
          <span className="ml-auto text-xs font-normal text-muted-foreground">{riwayat.length} resep</span>
        </p>
        {riwayat.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Belum ada resep. Isi formulir di atas lalu simpan — hasilnya muncul di sini.
          </p>
        ) : (
          <div className="space-y-2">
            {riwayat.map((r) => (
              <div key={r.id} className="flex items-center gap-3 rounded-xl border border-border p-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                  <Scale className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{r.nama}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {KATEGORI.find((k) => k.value === r.kategori)?.label ?? r.kategori} ·{" "}
                    {r.mode === "batch" ? `${r.hasil} ${r.hasilUnit} / masak` : "per satuan"}
                  </p>
                </div>
                <Badge tone="cyan">{rp(r.hppPerUnit)}</Badge>
                {bisaEdit && (
                  <div className="flex shrink-0 gap-1">
                    <Button size="sm" variant="ghost" onClick={() => muat(r)}>
                      Ubah
                    </Button>
                    <button
                      type="button"
                      onClick={() => void hapus(r)}
                      aria-label={`Hapus ${r.nama}`}
                      className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Ikon halaman — diekspor supaya halaman servernya tidak perlu mengimpor lucide. */
export const IkonProduksi = Calculator;
