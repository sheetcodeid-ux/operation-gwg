"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { WORK_BRANDS } from "@/lib/constants";
import {
  simpanActualAction,
  simpanEfisiensiAction,
  simpanEntriAction,
  simpanFeeAction,
  simpanMenuPasarAction,
} from "@/lib/actions/kpi";
import type { Indikator } from "@/lib/kpi/indikator";
import { BULAN, periodeDari, tahunPilihan } from "./periode";

/**
 * Satu pintu untuk MENGISI angka KPI.
 *
 * Sebelumnya tidak ada sama sekali: halamannya menampilkan target dan capaian,
 * tapi tidak pernah menjelaskan di mana angkanya diisi. Yang membuka layarnya
 * melihat "Total Event / Program, target 30, actual 0" dan tidak punya satu pun
 * tombol untuk menambah event.
 *
 * BENTUK FORMNYA MENGIKUTI INDIKATOR YANG DIPILIH. Sepuluh posisi punya
 * belasan jenis isian yang berbeda — angka tunggal, angka per brand, satu baris
 * kegiatan, satu temuan, satu outlet. Membuat satu form untuk masing-masing
 * berarti belasan tombol di layar dan orang yang bingung harus menekan yang
 * mana. Di sini tombolnya satu: pilih bulan, pilih indikator, isiannya
 * menyesuaikan sendiri.
 */

export interface OutletRingkas {
  id: string;
  nama: string;
}

type Bentuk = "angka" | "brand" | "kegiatan" | "temuan" | "tenggat" | "efisiensi" | "fee" | "pasar" | "otomatis";

/** Bentuk isian untuk sebuah indikator. */
export function bentukIsian(i: Indikator): Bentuk {
  if (i.actual.sumber === "manual") return "angka";
  if (i.actual.sumber === "manual_brand") return "brand";
  if (i.actual.sumber === "entri") return "kegiatan";
  if (i.actual.sumber === "pengurang") return i.actual.entri === "penyampaian" ? "tenggat" : "temuan";
  if (i.actual.sumber === "lulus") return "tenggat";
  switch (i.actual.kode) {
    case "efisiensi_operasional":
      return "efisiensi";
    case "management_fee":
      return "fee";
    case "keberhasilan_pasar":
      return "pasar";
    default:
      return "otomatis";
  }
}

const KETERANGAN: Record<Bentuk, string> = {
  angka: "Isi capaian bulan ini dalam satu angka.",
  brand: "Isi per brand — sistem yang menjumlahkannya.",
  kegiatan: "Satu baris yang tercatat bernilai satu poin.",
  temuan: "Satu temuan mengurangi satu poin dari target.",
  tenggat: "Catat pengirimannya. Yang telat mengurangi poin.",
  efisiensi: "Isi realisasi beban satu outlet.",
  fee: "Tandai apakah management fee outlet ini sudah sesuai.",
  pasar: "Tambah menu yang dinilai, beserta penjualan dan omset bulan ini.",
  otomatis: "Indikator ini terisi otomatis — tidak perlu diisi tangan.",
};

export function DialogInput({
  posisi,
  periode,
  indikator,
  outlets,
  pic,
  tenggatHari,
}: {
  posisi: string;
  periode: string;
  indikator: Indikator[];
  outlets: OutletRingkas[];
  pic: string[];
  /** Tanggal tenggat yang berlaku untuk posisi ini, mis. [8, 15, 22, 28]. */
  tenggatHari: number[];
}) {
  const router = useRouter();
  const [buka, setBuka] = React.useState(false);
  const [sibuk, setSibuk] = React.useState(false);

  const [tahun, setTahun] = React.useState(periode.slice(0, 4));
  const [bulan, setBulan] = React.useState(periode.slice(5, 7));
  const bisaDiisi = React.useMemo(() => indikator.filter((i) => bentukIsian(i) !== "otomatis"), [indikator]);
  const [key, setKey] = React.useState(bisaDiisi[0]?.key ?? "");

  const dipilih = bisaDiisi.find((i) => i.key === key) ?? bisaDiisi[0];
  const bentuk = dipilih ? bentukIsian(dipilih) : "otomatis";
  const periodeDipilih = periodeDari(tahun, bulan);

  // Isian — satu kumpulan untuk semua bentuk. Yang tidak dipakai bentuk ini
  // tidak ikut terkirim, jadi tidak perlu satu state per bentuk.
  const [nilai, setNilai] = React.useState("");
  const [perBrand, setPerBrand] = React.useState<Record<string, string>>({});
  const [tanggal, setTanggal] = React.useState(`${periodeDipilih}-01`);
  const [picNama, setPicNama] = React.useState(pic[0] ?? "");
  const [outletId, setOutletId] = React.useState("");
  const [judul, setJudul] = React.useState("");
  const [deskripsi, setDeskripsi] = React.useState("");
  const [nominal, setNominal] = React.useState("");
  const [nominalSeharusnya, setNominalSeharusnya] = React.useState("");
  const [tenggat, setTenggat] = React.useState(String(tenggatHari[0] ?? 15));
  const [telat, setTelat] = React.useState(false);
  const [wh, setWh] = React.useState("");
  const [nonWh, setNonWh] = React.useState("");
  const [sesuai, setSesuai] = React.useState(true);
  const [penjualan, setPenjualan] = React.useState("");
  const [omset, setOmset] = React.useState("");

  const num = (v: string) => {
    const n = Number(String(v).replace(/[^\d.-]/g, ""));
    return Number.isFinite(n) ? n : 0;
  };

  function reset() {
    setNilai("");
    setPerBrand({});
    setJudul("");
    setDeskripsi("");
    setNominal("");
    setNominalSeharusnya("");
    setWh("");
    setNonWh("");
    setPenjualan("");
    setTelat(false);
  }

  async function simpan() {
    if (!dipilih) return;
    setSibuk(true);
    const dasar = { posisi, periode: periodeDipilih };
    let res: { ok?: true; error?: string } = { error: "Bentuk isian tidak dikenali." };

    if (bentuk === "angka") {
      res = await simpanActualAction({ ...dasar, indikator: dipilih.key, nilai: num(nilai), catatan: deskripsi });
    } else if (bentuk === "brand") {
      // Satu baris per brand — supaya bisa dilihat brand mana yang tertinggal,
      // bukan cuma totalnya.
      for (const b of WORK_BRANDS) {
        res = await simpanActualAction({ ...dasar, indikator: dipilih.key, brand: b, nilai: num(perBrand[b] ?? "0") });
        if (res.error) break;
      }
    } else if (bentuk === "kegiatan") {
      const jenis = dipilih.actual.sumber === "entri" ? dipilih.actual.entri : "quality_control";
      res = await simpanEntriAction({ ...dasar, jenis, tanggal, picNama, outletId: outletId || null, judul, deskripsi });
    } else if (bentuk === "temuan") {
      const jenis = dipilih.actual.sumber === "pengurang" ? dipilih.actual.entri : "temuan";
      res = await simpanEntriAction({
        ...dasar,
        jenis,
        tanggal,
        picNama,
        judul,
        deskripsi,
        nominal: nominal ? num(nominal) : null,
        nominalSeharusnya: nominalSeharusnya ? num(nominalSeharusnya) : null,
        gagal: true,
      });
    } else if (bentuk === "tenggat") {
      const jenis = dipilih.actual.sumber === "pengurang" || dipilih.actual.sumber === "lulus" ? dipilih.actual.entri : "penyampaian";
      res = await simpanEntriAction({
        ...dasar,
        jenis,
        tanggal,
        picNama,
        judul: `Tenggat tanggal ${tenggat}`,
        deskripsi,
        tenggat: `${periodeDipilih}-${String(tenggat).padStart(2, "0")}`,
        gagal: telat,
      });
    } else if (bentuk === "efisiensi") {
      res = await simpanEfisiensiAction({
        ...dasar,
        outletId,
        actualWh: wh === "" ? null : num(wh),
        actualNonWh: nonWh === "" ? null : num(nonWh),
      });
    } else if (bentuk === "fee") {
      res = await simpanFeeAction({ ...dasar, outletId, sesuai, catatan: deskripsi });
    } else if (bentuk === "pasar") {
      res = await simpanMenuPasarAction({ ...dasar, menu: judul, penjualan: num(penjualan), omset: num(omset) });
    }

    setSibuk(false);
    if (res.error) return toast.error(res.error);
    toast.success(`Tersimpan — ${dipilih.label}`);
    reset();
    router.refresh();
  }

  const outletOpsi = React.useMemo(() => outlets.map((o) => ({ value: o.id, label: o.nama })), [outlets]);

  return (
    <>
      <Button size="sm" className="gap-1.5" onClick={() => setBuka(true)} disabled={bisaDiisi.length === 0}>
        <Plus className="size-4" /> Input
      </Button>

      <Dialog open={buka} onOpenChange={setBuka}>
        <DialogContent title="Input Data KPI" description={dipilih?.label ?? ""} align="center" className="max-w-lg">
          <div className="max-h-[70vh] space-y-3 overflow-y-auto p-5">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tahun">
                <Combobox searchable={false} value={tahun} onChange={setTahun} options={tahunPilihan()} matchTriggerWidth />
              </Field>
              <Field label="Bulan">
                <Combobox searchable={false} value={bulan} onChange={setBulan} options={BULAN} matchTriggerWidth />
              </Field>
            </div>

            <Field label="Indikator" hint={KETERANGAN[bentuk]}>
              <Combobox
                searchable={false}
                value={dipilih?.key ?? ""}
                onChange={(v) => {
                  setKey(v);
                  reset();
                }}
                options={bisaDiisi.map((i) => ({ value: i.key, label: i.label }))}
                matchTriggerWidth
              />
            </Field>

            {/* ── isian yang menyesuaikan indikatornya ───────────────────── */}

            {bentuk === "angka" && (
              <>
                <Field label="Capaian bulan ini">
                  <Input inputMode="numeric" value={nilai} onChange={(e) => setNilai(e.target.value)} placeholder="0" />
                </Field>
                <Field label="Catatan (opsional)">
                  <Textarea rows={2} value={deskripsi} onChange={(e) => setDeskripsi(e.target.value)} placeholder="Sumber angkanya, tangkapan layar, dan sebagainya…" />
                </Field>
              </>
            )}

            {bentuk === "brand" && (
              <div className="grid grid-cols-2 gap-3">
                {WORK_BRANDS.map((b) => (
                  <Field key={b} label={b}>
                    <Input
                      inputMode="numeric"
                      value={perBrand[b] ?? ""}
                      onChange={(e) => setPerBrand((v) => ({ ...v, [b]: e.target.value }))}
                      placeholder="0"
                    />
                  </Field>
                ))}
              </div>
            )}

            {(bentuk === "kegiatan" || bentuk === "temuan" || bentuk === "tenggat") && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Tanggal">
                    <Input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
                  </Field>
                  <Field label="PIC">
                    {pic.length > 0 ? (
                      <Combobox searchable={false} value={picNama} onChange={setPicNama} options={pic.map((p) => ({ value: p, label: p }))} matchTriggerWidth />
                    ) : (
                      <Input value={picNama} onChange={(e) => setPicNama(e.target.value)} placeholder="Nama" />
                    )}
                  </Field>
                </div>

                {bentuk === "kegiatan" && (
                  <>
                    <Field label={dipilih?.key === "riset_menu" ? "Nama menu" : dipilih?.key === "event" ? "Nama event / program" : "Judul"}>
                      <Input value={judul} onChange={(e) => setJudul(e.target.value)} placeholder="…" />
                    </Field>
                    {dipilih?.key === "quality_control" && (
                      <Field label="Outlet">
                        <Combobox searchPlaceholder="Cari outlet…" value={outletId} onChange={setOutletId} options={outletOpsi} matchTriggerWidth />
                      </Field>
                    )}
                  </>
                )}

                {bentuk === "temuan" && (
                  <>
                    <Field label={dipilih?.key === "faktur_pajak" ? "No. invoice" : "Ringkasan temuan"}>
                      <Input value={judul} onChange={(e) => setJudul(e.target.value)} placeholder="…" />
                    </Field>
                    {dipilih?.key === "faktur_pajak" && (
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Nominal">
                          <Input inputMode="numeric" value={nominal} onChange={(e) => setNominal(e.target.value)} placeholder="0" />
                        </Field>
                        <Field label="Nominal seharusnya">
                          <Input inputMode="numeric" value={nominalSeharusnya} onChange={(e) => setNominalSeharusnya(e.target.value)} placeholder="0" />
                        </Field>
                      </div>
                    )}
                  </>
                )}

                {bentuk === "tenggat" && (
                  <>
                    <Field label="Tenggat tanggal">
                      <Combobox
                        searchable={false}
                        value={tenggat}
                        onChange={setTenggat}
                        options={(tenggatHari.length ? tenggatHari : [15]).map((h) => ({ value: String(h), label: `Tanggal ${h}` }))}
                        matchTriggerWidth
                      />
                    </Field>
                    <label className="flex cursor-pointer items-start gap-2.5 rounded-lg px-1 py-1">
                      <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-brand-500" checked={telat} onChange={(e) => setTelat(e.target.checked)} />
                      <span className="min-w-0">
                        <span className="block text-[13px] font-medium text-foreground">Terlambat</span>
                        <span className="block text-[11px] leading-relaxed text-muted-foreground">
                          Dicentang berarti mengurangi poin. Yang tepat waktu tetap dicatat supaya terlihat sudah dikirim.
                        </span>
                      </span>
                    </label>
                  </>
                )}

                <Field label="Keterangan (opsional)">
                  <Textarea rows={2} value={deskripsi} onChange={(e) => setDeskripsi(e.target.value)} />
                </Field>
              </>
            )}

            {bentuk === "efisiensi" && (
              <>
                <Field label="Outlet">
                  <Combobox searchPlaceholder="Cari outlet…" value={outletId} onChange={setOutletId} options={outletOpsi} matchTriggerWidth />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Actual Warehouse">
                    <Input inputMode="numeric" value={wh} onChange={(e) => setWh(e.target.value)} placeholder="0" />
                  </Field>
                  <Field label="Actual Non-Warehouse">
                    <Input inputMode="numeric" value={nonWh} onChange={(e) => setNonWh(e.target.value)} placeholder="0" />
                  </Field>
                </div>
                <p className="text-[11.5px] leading-relaxed text-muted-foreground">
                  Budget-nya tidak diisi — dihitung sendiri dari rata-rata net sales tiga bulan terakhir outlet itu.
                </p>
              </>
            )}

            {bentuk === "fee" && (
              <>
                <Field label="Outlet">
                  <Combobox searchPlaceholder="Cari outlet…" value={outletId} onChange={setOutletId} options={outletOpsi} matchTriggerWidth />
                </Field>
                <label className="flex cursor-pointer items-start gap-2.5 rounded-lg px-1 py-1">
                  <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-brand-500" checked={sesuai} onChange={(e) => setSesuai(e.target.checked)} />
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium text-foreground">Management fee sesuai</span>
                    <span className="block text-[11px] leading-relaxed text-muted-foreground">
                      Dibandingkan dengan 5% net sales outlet itu, yang sudah tertera di tabelnya.
                    </span>
                  </span>
                </label>
                <Field label="Catatan (opsional)">
                  <Textarea rows={2} value={deskripsi} onChange={(e) => setDeskripsi(e.target.value)} />
                </Field>
              </>
            )}

            {bentuk === "pasar" && (
              <>
                <Field label="Nama menu">
                  <Input value={judul} onChange={(e) => setJudul(e.target.value)} placeholder="mis. WIM" />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Penjualan menu (3 bulan)">
                    <Input inputMode="numeric" value={penjualan} onChange={(e) => setPenjualan(e.target.value)} placeholder="0" />
                  </Field>
                  <Field label="Omset (3 bulan)">
                    <Input inputMode="numeric" value={omset} onChange={(e) => setOmset(e.target.value)} placeholder="0" />
                  </Field>
                </div>
                <p className="text-[11.5px] leading-relaxed text-muted-foreground">
                  Omsetnya cukup diisi sekali per bulan; menu berikutnya memakai angka yang sama. Keduanya akan ditarik
                  otomatis dari ESB setelah sambungannya siap.
                </p>
              </>
            )}

            <div className="flex flex-wrap justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={() => setBuka(false)} disabled={sibuk}>
                Tutup
              </Button>
              <Button onClick={simpan} disabled={sibuk || !dipilih}>
                {sibuk ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Simpan
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
