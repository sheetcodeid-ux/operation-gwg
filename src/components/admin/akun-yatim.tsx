import { KeyRound, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AkunYatim } from "@/lib/data/akun-yatim";
import { formatDate } from "@/lib/utils";

/**
 * Akun login tanpa profil karyawan.
 *
 * Ditaruh di User Management, tepat di atas daftar penggunanya: di sinilah
 * orang datang ketika ada yang mengeluh tidak bisa masuk, dan inilah satu-
 * satunya tempat yang bisa menjelaskan kenapa sebuah password yang benar tetap
 * ditolak.
 *
 * Yang PERNAH LOGIN dipisahkan dari yang belum, dan diletakkan lebih dulu.
 * Keduanya sama-sama tidak bisa memakai aplikasi, tapi maknanya berbeda jauh:
 * yang pernah login berarti ada orang sungguhan yang sedang mencoba masuk dan
 * gagal berulang kali — itu keluhan yang belum sampai ke meja siapa pun.
 */
export function AkunYatimKartu({ rows }: { rows: AkunYatim[] }) {
  if (rows.length === 0) return null;
  const pernah = rows.filter((r) => r.loginTerakhir);
  const belum = rows.filter((r) => !r.loginTerakhir);

  return (
    <Card className="mb-4 border-amber-500/40">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <TriangleAlert className="size-4 text-amber-500" />
          Akun Login Tanpa Profil — {rows.length}
        </CardTitle>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Password mereka diterima Supabase, tapi aplikasi tidak menemukan profil karyawan dengan email itu — jadi
          mereka terlempar kembali ke halaman login dan mengira passwordnya salah. Biasanya karena orangnya punya
          lebih dari satu alamat email dan profilnya memakai alamat yang berbeda.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {pernah.length > 0 && (
          <Bagian
            judul={`${pernah.length} pernah berhasil login — kemungkinan sedang kesulitan masuk sekarang`}
            rows={pernah}
            mendesak
          />
        )}
        {belum.length > 0 && (
          <Bagian judul={`${belum.length} belum pernah login sama sekali`} rows={belum} mendesak={false} />
        )}
      </CardContent>
    </Card>
  );
}

function Bagian({ judul, rows, mendesak }: { judul: string; rows: AkunYatim[]; mendesak: boolean }) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{judul}</p>
      <ul className="divide-y divide-border rounded-xl border border-border">
        {rows.map((r) => (
          <li key={r.email} className="flex items-center gap-3 px-3 py-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted ring-1 ring-border">
              <KeyRound className="size-3.5 text-muted-foreground" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-foreground">{r.email}</span>
              <span className="block text-[11px] text-muted-foreground">
                {r.loginTerakhir
                  ? `Terakhir login ${formatDate(r.loginTerakhir)}`
                  : r.dibuat
                    ? `Dibuat ${formatDate(r.dibuat)}, belum pernah dipakai`
                    : "—"}
              </span>
            </span>
            <Badge tone={mendesak ? "warning" : "neutral"}>{mendesak ? "Perlu dicek" : "Tidak terpakai"}</Badge>
          </li>
        ))}
      </ul>
    </div>
  );
}
