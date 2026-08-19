"use client";

import * as React from "react";
import { BookOpen, Building2, ClipboardCheck, GraduationCap, Layers, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { StatTile } from "@/components/ui/stat";
import { FASE_BELAJAR, LABEL_FASE, PENJELASAN_FASE } from "@/lib/elearning-fase";
import { NILAI_LULUS } from "@/lib/hcmos/lanjutan";
import { SCOPE_LABEL, type HcScope } from "@/lib/hcmos/pillars";
import { TARGET_PESERTA, kurikulumScope } from "@/lib/hcmos/pelatihan";

/**
 * Ruang belajar — pengantar di atas daftar materi yang sebenarnya.
 *
 * Yang ditampilkan di sini KURIKULUM REKOMENDASI, bukan progres seseorang, dan
 * pembedaan itu dijaga secara terang-terangan di layar. Kurikulum ditetapkan
 * Learning & Development dan sama untuk semua orang; progres dibaca dari materi
 * yang benar-benar dipublikasikan di E-Learning dan berbeda tiap orang.
 *
 * Menggambar batang progres di atas kartu kurikulum akan terlihat rapi dan
 * salah: kurikulum belum tentu sudah ada materi digitalnya, sehingga batang
 * yang muncul di sana tidak mengukur apa pun yang bisa dikerjakan pembacanya.
 */
export function RuangBelajar({
  namaPengguna,
  materiTuntas,
  totalMateriTerbit,
}: {
  namaPengguna: string;
  /** Materi E-Learning yang benar-benar dituntaskan pengguna ini. */
  materiTuntas: number;
  /** Materi E-Learning yang sudah terbit — pembagi progresnya. */
  totalMateriTerbit: number;
}) {
  const [scope, setScope] = React.useState<HcScope>("manajemen");
  const kurikulum = kurikulumScope(scope);
  const totalMenit = kurikulum.reduce((a, m) => a + m.menit, 0);

  return (
    <div className="space-y-4">
      <SegmentedTabs
        className="max-w-md"
        value={scope}
        onChange={(v) => setScope(v as HcScope)}
        items={[
          { value: "manajemen", label: SCOPE_LABEL.manajemen, icon: Building2 },
          { value: "outlet", label: SCOPE_LABEL.outlet, icon: Users },
        ]}
      />

      {/* ── Sambutan ────────────────────────────────────────────────────── */}
      <Card>
        <CardContent className="py-5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Ruang Belajar {scope === "manajemen" ? "Manajemen" : "Outlet"}
          </p>
          <p className="mt-1 text-lg font-semibold text-foreground">Selamat belajar, {namaPengguna}.</p>
          <p className="mt-1 max-w-3xl text-[12px] leading-relaxed text-muted-foreground">
            {kurikulum.length} materi {scope === "manajemen" ? "Onboarding Manajemen" : "Fast Start & Fast Track"}{" "}
            direkomendasikan sebagai standar perusahaan — {TARGET_PESERTA[scope].toLowerCase()}. Setiap materi dijalani
            dengan ritme belajarmu sendiri, dan nilainya diambil dari percobaan pertama.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge tone="neutral">{kurikulum.length} materi kurikulum</Badge>
            <Badge tone="neutral">{Math.round((totalMenit / 60) * 10) / 10} jam total</Badge>
            <Badge tone="neutral">Kelulusan minimal {NILAI_LULUS}</Badge>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          icon={Layers}
          label={`Total Materi (Standar ${scope === "manajemen" ? "Onboarding Manajemen" : "Outlet"})`}
          value={kurikulum.length}
          sub={`${totalMenit} menit seluruhnya`}
        />
        <StatTile
          icon={GraduationCap}
          label="Materi Saya Tuntas"
          value={totalMateriTerbit === 0 ? "—" : `${materiTuntas}/${totalMateriTerbit}`}
          sub={
            totalMateriTerbit === 0
              ? "belum ada materi E-Learning yang terbit"
              : "dihitung dari materi E-Learning yang sudah terbit"
          }
        />
        <StatTile
          icon={ClipboardCheck}
          label="Nilai Minimum Kelulusan"
          value={NILAI_LULUS}
          sub="sama dengan standar Fast Start / Fast Track"
        />
        <StatTile
          icon={BookOpen}
          label="Tahap per Materi"
          value={FASE_BELAJAR.length}
          sub={FASE_BELAJAR.map((f) => LABEL_FASE[f]).join(" → ")}
        />
      </div>

      {/* ── Alur belajar ────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Alur Belajar</CardTitle>
          <p className="text-[11px] text-muted-foreground">
            Berlaku untuk seluruh materi — Post Test baru terbuka setelah materinya tuntas
          </p>
        </CardHeader>
        <CardContent>
          <ol className="grid grid-cols-[minmax(0,1fr)] gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {FASE_BELAJAR.map((f, i) => (
              <li key={f} className="flex items-start gap-2.5 rounded-xl border border-border bg-background/40 p-3">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-muted text-[11px] font-semibold tabular-nums text-foreground">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium text-foreground">{LABEL_FASE[f]}</span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                    {PENJELASAN_FASE[f]}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {/* ── Kurikulum rekomendasi ───────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>
            Materi Muatan {scope === "manajemen" ? "Onboarding Manajemen" : "Fast Start & Fast Track"}
          </CardTitle>
          <p className="text-[11px] text-muted-foreground">
            Kurikulum rekomendasi standar perusahaan — daftar acuan, bukan progres pribadi. Materi yang sudah punya versi
            digitalnya muncul di daftar E-Learning di bawah.
          </p>
        </CardHeader>
        <CardContent>
          <ol className="grid grid-cols-[minmax(0,1fr)] gap-2 md:grid-cols-2">
            {kurikulum.map((m) => (
              <li key={m.no} className="rounded-xl border border-border bg-background/40 p-3">
                <div className="flex items-start gap-2.5">
                  <span className="grid size-6 shrink-0 place-items-center rounded-lg bg-muted text-[11px] font-semibold tabular-nums text-foreground">
                    {m.no}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-foreground">{m.judul}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {m.bentuk} · {m.menit} menit
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {FASE_BELAJAR.map((f) => (
                        <Badge key={f} tone="neutral">
                          {LABEL_FASE[f]}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
