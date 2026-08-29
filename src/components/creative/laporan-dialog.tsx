"use client";

import * as React from "react";
import { Loader2, Send, UserCog } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/input";
import { kirimLaporanPenilaianAction } from "@/lib/actions/creative-penilaian";
import type { PenerimaLaporan } from "@/lib/data/creative-penilaian";

/**
 * Kirim laporan penilaian ke Coordinator Area.
 *
 * YANG DIKIRIM BUKAN ANGKA DARI LAYAR INI. Layar hanya mengirim periode dan
 * siapa penerimanya; naskahnya disusun ulang di server dari data yang sama.
 * Kalau angkanya ikut dikirim dari peramban, siapa pun yang bisa memanggil
 * aksinya bisa mengarang rapor atas nama orang lain — dan laporan yang bisa
 * dikarang tidak layak jadi bahan evaluasi siapa pun.
 *
 * Yang dicentang lebih dulu adalah CA yang wilayahnya MEMANG muncul pada
 * saringan sekarang. Mengirim ke semua orang secara asal membuat CA menerima
 * rapor wilayah rekannya, dan alat evaluasi yang bocor ke samping berhenti
 * dipakai sebagai alat evaluasi.
 */
export function LaporanDialog({
  periode,
  periodeLabel,
  penerima,
  areaTerlihat,
  jumlahPermintaan,
}: {
  periode: string;
  periodeLabel: string;
  penerima: PenerimaLaporan[];
  areaTerlihat: string[];
  jumlahPermintaan: number;
}) {
  const [buka, setBuka] = React.useState(false);
  const relevan = React.useMemo(
    () => penerima.filter((p) => p.areaIds.some((id) => areaTerlihat.includes(id))),
    [penerima, areaTerlihat],
  );
  const [pilih, setPilih] = React.useState<string[]>([]);
  const [catatan, setCatatan] = React.useState("");
  const [sibuk, setSibuk] = React.useState(false);

  // Centang awal mengikuti wilayah yang sedang tampak. Dihitung saat dialognya
  // dibuka, bukan saat dirender: saringan bulannya bisa berubah berkali-kali
  // sebelum tombolnya ditekan.
  function bukaDialog() {
    setPilih(relevan.map((p) => p.id));
    setBuka(true);
  }

  const alih = (id: string) => setPilih((v) => (v.includes(id) ? v.filter((x) => x !== id) : [...v, id]));

  async function kirim() {
    if (pilih.length === 0) return toast.error("Pilih dulu Coordinator Area yang dituju.");
    setSibuk(true);
    const res = await kirimLaporanPenilaianAction({ periode, penerimaIds: pilih, catatan });
    setSibuk(false);
    if (res.error) return toast.error(res.error);
    toast.success(`Laporan terkirim ke ${res.terkirim} Coordinator Area`);
    setBuka(false);
    setCatatan("");
  }

  return (
    <>
      <Button size="sm" onClick={bukaDialog} disabled={jumlahPermintaan === 0} className="gap-1.5">
        <Send className="size-4" /> Report ke CA
      </Button>

      <Dialog open={buka} onOpenChange={setBuka}>
        <DialogContent title="Kirim Laporan Penilaian" description={`Periode ${periodeLabel}`} align="center" className="max-w-lg">
          <div className="max-h-[70vh] space-y-3 overflow-y-auto p-5">
            <p className="rounded-lg bg-brand-500/10 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
              Setiap Coordinator Area menerima <b className="text-foreground">wilayahnya sendiri</b> — daftar pemohon,
              label, persen mendadak, dan rata-rata tenggangnya. Laporannya masuk ke Pesan dan lonceng notifikasi mereka.
            </p>

            <Field label={`Coordinator Area (${pilih.length} dipilih)`}>
              <div className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-border p-1.5">
                {penerima.length === 0 ? (
                  <p className="px-2 py-6 text-center text-[12.5px] text-muted-foreground">
                    Belum ada akun Coordinator Area yang aktif.
                  </p>
                ) : (
                  penerima.map((p) => {
                    const punyaData = p.areaIds.some((id) => areaTerlihat.includes(id));
                    return (
                      <label
                        key={p.id}
                        className="flex cursor-pointer items-start gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted/50"
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5 size-4 shrink-0 accent-brand-500"
                          checked={pilih.includes(p.id)}
                          onChange={() => alih(p.id)}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <UserCog className="size-3.5 shrink-0 text-muted-foreground" />
                            <span className="truncate text-[13px] font-medium text-foreground">{p.nama}</span>
                          </span>
                          <span className="block truncate text-[11px] text-muted-foreground">{p.areaNama}</span>
                        </span>
                        {!punyaData && (
                          <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            tanpa data
                          </span>
                        )}
                      </label>
                    );
                  })
                )}
              </div>
            </Field>

            <Field label="Catatan (opsional)" hint="Ikut terkirim di bawah angkanya — misalnya kesepakatan tenggang minimum.">
              <Textarea
                rows={3}
                value={catatan}
                onChange={(e) => setCatatan(e.target.value)}
                placeholder="Mohon permintaan design diajukan minimal H-7 supaya antriannya tidak menumpuk…"
              />
            </Field>

            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="ghost" onClick={() => setBuka(false)} disabled={sibuk}>
                Batal
              </Button>
              <Button onClick={kirim} disabled={sibuk || pilih.length === 0}>
                {sibuk ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Kirim laporan
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
