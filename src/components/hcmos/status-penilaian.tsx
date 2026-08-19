import { ClipboardCheck, ClipboardList } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatTile } from "@/components/ui/stat";
import type { BarisUnit } from "@/lib/hcmos/penilaian";

/**
 * Status penilaian berjalan — berapa dari sekian karyawan yang sudah dinilai.
 *
 * Kolom terakhir berisi PERIODE, bukan tenggat. Tenggatnya memang keputusan
 * yang tidak tercatat di mana pun dalam sistem ini, dan menampilkan tanggal
 * yang dikarang di kolom bernama "Target" akan dipercaya orang persis seperti
 * tanggal yang sungguhan — lalu dijadikan dasar menagih.
 */
export function StatusPenilaian({ unit }: { unit: BarisUnit[] }) {
  return (
    <>
      <div className="mb-4 grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
        {unit.map((u) => (
          <StatTile
            key={u.unit}
            icon={u.scope === "manajemen" ? ClipboardList : ClipboardCheck}
            label={`${u.unit} — Selesai Dinilai`}
            value={`${u.selesai}/${u.totalKaryawan}`}
            sub={
              u.persen === null
                ? "belum ada karyawan terdaftar di unit ini"
                : `${u.persen}% · ${u.belum} belum dinilai`
            }
          />
        ))}
      </div>

      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle>Status Penilaian Berjalan</CardTitle>
          <p className="text-[11px] text-muted-foreground">
            Jumlah karyawan diambil dari User Management dan Kontrak Tracker — bukan dari tabel penilaian, supaya yang
            belum dinilai tetap ikut terhitung
          </p>
        </CardHeader>
        <CardContent>
          <div className="-mx-4 overflow-x-auto px-4">
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <Th>Unit</Th>
                  <Th>Total Karyawan</Th>
                  <Th>Selesai</Th>
                  <Th>Belum</Th>
                  <Th>Periode</Th>
                </tr>
              </thead>
              <tbody>
                {unit.map((u) => (
                  <tr key={u.unit} className="border-b border-border/60 last:border-0">
                    <Td className="font-medium text-foreground">{u.unit}</Td>
                    <Td className="tabular-nums">{u.totalKaryawan}</Td>
                    <Td className="tabular-nums">
                      {u.selesai}
                      {u.persen !== null && (
                        <span className="ml-2">
                          <Badge tone={u.persen >= 100 ? "success" : u.persen >= 50 ? "warning" : "neutral"}>
                            {u.persen}%
                          </Badge>
                        </span>
                      )}
                    </Td>
                    <Td className="tabular-nums">{u.belum}</Td>
                    <Td>{u.periode || <span className="text-muted-foreground">belum ada penilaian</span>}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
            Tenggat penilaian belum tercatat di sistem, jadi kolom terakhir menampilkan periode yang sedang berjalan
            alih-alih tanggal target. Kalau tenggatnya perlu ikut dipantau, ia harus punya tempat penyimpanannya sendiri
            lebih dulu.
          </p>
        </CardContent>
      </Card>
    </>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{children}</th>
  );
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2.5 align-top text-muted-foreground ${className}`}>{children}</td>;
}
