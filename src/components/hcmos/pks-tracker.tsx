import { CalendarClock, FileSignature, Handshake, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatTile } from "@/components/ui/stat";
import { MASA_BERLAKU_PERINGATAN_HARI, STATUS_DOKUMEN_META, sisaBerlaku } from "@/lib/hcmos/dokumen";
import { pengingatPks, rekapPks, type PerjanjianRingkas } from "@/lib/hcmos/pks";
import { formatDate } from "@/lib/utils";

/**
 * Pelacak PKS Kemitraan — dipasang di halaman Document & Compliance.
 *
 * Ditaruh di situ, bukan di halamannya sendiri, karena yang mengurusnya orang
 * yang sama dengan yang mengurus dokumen kepatuhan, dan pertanyaannya pun
 * datang bersamaan: "legalitas kita aman tidak bulan ini". Memisahkannya ke
 * menu lain berarti satu dari dua jawaban selalu tertinggal tidak dibaca.
 */
export function PksTracker({ rows }: { rows: PerjanjianRingkas[] }) {
  const r = rekapPks(rows);
  const pengingat = pengingatPks(rows);
  const daftar = rows.filter((x) => x.status !== "arsip");

  return (
    <div className="mb-4 space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile icon={Handshake} label="PKS Aktif" value={r.aktif} sub="sedang berjalan" />
        <StatTile
          icon={CalendarClock}
          label={`Akan Berakhir ≤ ${MASA_BERLAKU_PERINGATAN_HARI} Hari`}
          value={r.segeraHabis}
          sub="termasuk dalam PKS aktif"
        />
        <StatTile icon={FileSignature} label="Dalam Proses Draft/Negosiasi" value={r.draf} sub="belum mengikat" />
        <StatTile
          icon={TriangleAlert}
          label="Sudah Lewat Jatuh Tempo"
          value={r.lewat}
          sub={r.lewat === 0 ? "tidak ada" : "belum ditutup atau diperpanjang"}
        />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Daftar PKS Kemitraan</CardTitle>
          <p className="text-[11px] text-muted-foreground">
            Perjanjian Kerja Sama — sewa lokasi, kemitraan brand, dan kolaborasi usaha
          </p>
        </CardHeader>
        <CardContent>
          {daftar.length === 0 ? (
            <div className="grid place-items-center rounded-xl border border-dashed border-border bg-muted/20 py-10 text-center text-xs text-muted-foreground">
              Belum ada PKS yang tercatat. Tambahkan lewat Pusat Dokumen dengan jenis “PKS Kemitraan”.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {["Mitra / Lokasi", "Jenis PKS", "Mulai", "Berakhir", "Status"].map((h) => (
                      <th
                        key={h}
                        className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {daftar.map((d, i) => {
                    const st = STATUS_DOKUMEN_META[d.status];
                    // Yang ditampilkan di kolom status adalah keadaan yang paling
                    // perlu ditindaklanjuti, bukan sekadar status administratifnya:
                    // sebuah PKS "aktif" yang jatuh tempo bulan depan lebih tepat
                    // dibaca sebagai "Akan Berakhir".
                    const tanda =
                      d.status === "aktif" && d.masaBerlaku === "habis"
                        ? { label: "Lewat Jatuh Tempo", tone: "danger" as const }
                        : d.status === "aktif" && d.masaBerlaku === "segera_habis"
                          ? { label: "Akan Berakhir", tone: "warning" as const }
                          : { label: st.label, tone: st.tone };
                    return (
                      <tr key={i} className="border-b border-border/60 last:border-0">
                        <td className="px-3 py-2.5 align-middle">
                          <p className="font-medium text-foreground">{d.pihak || d.judul}</p>
                          {d.pihak && <p className="text-[11px] text-muted-foreground">{d.judul}</p>}
                        </td>
                        <td className="px-3 py-2.5 align-middle text-muted-foreground">{d.judul}</td>
                        <td className="px-3 py-2.5 align-middle text-muted-foreground">
                          {d.berlakuMulai ? formatDate(d.berlakuMulai) : "—"}
                        </td>
                        <td className="px-3 py-2.5 align-middle text-muted-foreground">
                          {d.berlakuSampai ? formatDate(d.berlakuSampai) : "—"}
                        </td>
                        <td className="px-3 py-2.5 align-middle">
                          <Badge tone={tanda.tone}>{tanda.label}</Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {pengingat.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Pengingat Perpanjangan PKS</CardTitle>
            <p className="text-[11px] text-muted-foreground">
              Jatuh tempo dalam {MASA_BERLAKU_PERINGATAN_HARI} hari ke depan — yang sudah lewat di urutan atas
            </p>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {pengingat.map((d, i) => {
                const sisa = sisaBerlaku(d.berlakuSampai);
                return (
                  <li key={i} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-muted ring-1 ring-border">
                      <CalendarClock className="size-4 text-foreground/70" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {d.pihak || d.judul}
                      </span>
                      <span className="block text-[12px] text-muted-foreground">
                        Berakhir {d.berlakuSampai ? formatDate(d.berlakuSampai) : "—"}
                      </span>
                    </span>
                    <Badge tone={sisa !== null && sisa < 0 ? "danger" : "warning"}>
                      {sisa === null
                        ? "Segera"
                        : sisa < 0
                          ? `Telat ${Math.abs(sisa)} hari`
                          : `${sisa} hari lagi`}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
