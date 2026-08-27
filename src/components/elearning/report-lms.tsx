"use client";

import * as React from "react";
import { BarChart3, Loader2, RefreshCw, Users } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { StatTile } from "@/components/ui/stat";
import { reportElearningAction } from "@/lib/actions/elearning";
import type { ReportElearning } from "@/lib/data/elearning-report";
import { formatDate } from "@/lib/utils";

/**
 * Report E-Learning lintas subject, dengan penelusuran per subject dan per orang.
 *
 * MENGAPA ANGKANYA BARU DIHITUNG SAAT DIBUKA. Rekap ini menyentuh seluruh
 * riwayat progres dan hasil kuis; ikut dimuat di setiap kunjungan halaman
 * Kelola, ia membebani orang yang datang cuma untuk menyunting satu materi.
 *
 * MENGAPA PENYEBUTNYA PESERTA, BUKAN SELURUH KARYAWAN. Subject yang ditugaskan
 * ke lima orang dan tuntas kelimanya adalah 100%, bukan 5% dari seratus
 * karyawan. Itulah satu-satunya alasan penugasan peserta dibuat — tanpa
 * penyebut yang benar, persentase apa pun cuma hiasan.
 */
export function ReportLms({ onClose }: { onClose: () => void }) {
  const [data, setData] = React.useState<ReportElearning | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [subject, setSubject] = React.useState("all");
  const [userId, setUserId] = React.useState("all");

  const muat = React.useCallback(async () => {
    setBusy(true);
    try {
      const res = await reportElearningAction();
      if ("error" in res) return toast.error(res.error);
      setData(res.report);
    } finally {
      setBusy(false);
    }
  }, []);

  React.useEffect(() => {
    void muat();
  }, [muat]);

  const r = data?.ringkas;
  const subjectDipilih = data?.perSubject.find((s) => s.courseId === subject) ?? null;
  const userDipilih = data?.perUser.find((u) => u.userId === userId) ?? null;

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        title="Report E-Learning"
        description="Rekap seluruh subject, beserta penelusuran per subject dan per orang."
        align="center"
        className="max-w-4xl"
      >
        {!data ? (
          <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Menghitung rekap…
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatTile icon={BarChart3} label="Total Subject" value={r!.totalSubject} sub="seluruh kurikulum" />
              <StatTile icon={BarChart3} label="Total Materi" value={r!.totalMateri} sub="di semua subject" />
              <StatTile icon={Users} label="Peserta Unik" value={r!.pesertaUnik} sub="orang berbeda" />
              <StatTile
                icon={BarChart3}
                label="Rata-rata Ketuntasan"
                value={`${r!.avgCompletion}%`}
                sub="ditimbang per subject"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <StatTile icon={BarChart3} label="Materi Berkuis" value={r!.materiBerkuis} sub={`dari ${r!.totalMateri} materi`} />
              <StatTile icon={BarChart3} label="Total Percobaan Kuis" value={r!.totalAttempt} sub="seluruh riwayat" />
              <StatTile
                icon={BarChart3}
                label="Rata-rata Nilai Kuis"
                value={r!.totalAttempt === 0 ? "—" : r!.avgScore}
                sub={r!.totalAttempt === 0 ? "belum ada yang mengerjakan" : "dari 100"}
              />
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <Telusur judul="Telusuri: Subject">
                <Combobox
                  portal
                  value={subject}
                  onChange={setSubject}
                  options={[
                    { value: "all", label: "— Pilih subject untuk lihat report —" },
                    ...data.perSubject.map((s) => ({ value: s.courseId, label: s.judul })),
                  ]}
                  searchPlaceholder="Cari subject…"
                />
                {subjectDipilih && (
                  <dl className="mt-3 space-y-1.5">
                    <Baris label="Status">
                      <Badge tone={subjectDipilih.aktif ? "success" : "neutral"}>
                        {subjectDipilih.aktif ? "Active" : "Nonaktif"}
                      </Badge>
                    </Baris>
                    <Baris label="Materi">{subjectDipilih.totalMateri}</Baris>
                    <Baris label="Peserta">{subjectDipilih.peserta}</Baris>
                    <Baris label="Tuntas seluruh materi">
                      {subjectDipilih.tuntas} orang · {subjectDipilih.completion}%
                    </Baris>
                    <Baris label="Percobaan kuis">{subjectDipilih.attempt}</Baris>
                    <Baris label="Rata-rata nilai">{subjectDipilih.avgScore ?? "belum ada"}</Baris>
                  </dl>
                )}
              </Telusur>

              <Telusur judul="Telusuri: Peserta">
                <Combobox
                  portal
                  value={userId}
                  onChange={setUserId}
                  options={[
                    { value: "all", label: "— Pilih peserta untuk lihat report —" },
                    ...data.perUser.map((u) => ({ value: u.userId, label: `${u.nama} · ${u.jabatan}` })),
                  ]}
                  searchPlaceholder="Cari nama…"
                />
                {userDipilih && (
                  <dl className="mt-3 space-y-1.5">
                    <Baris label="Subject yang jadi tugasnya">{userDipilih.subject}</Baris>
                    <Baris label="Materi tuntas">
                      {userDipilih.materiTuntas} dari {userDipilih.materiTotal}
                    </Baris>
                    <Baris label="Ketuntasan">{userDipilih.completion}%</Baris>
                    <Baris label="Rata-rata nilai">{userDipilih.avgScore ?? "belum ada"}</Baris>
                    <Baris label="Terakhir belajar">
                      {userDipilih.terakhir ? formatDate(userDipilih.terakhir) : "belum pernah"}
                    </Baris>
                  </dl>
                )}
              </Telusur>
            </div>

            {/* Peringkat ketuntasan. Yang PALING TERTINGGAL ditaruh paling atas
                bila tidak ada yang dipilih — itulah yang perlu ditindaklanjuti,
                bukan yang sudah selesai. */}
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Peserta yang paling tertinggal
              </p>
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full min-w-[520px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-left">
                      <Th>Nama</Th>
                      <Th className="w-28">Subject</Th>
                      <Th className="w-32">Materi tuntas</Th>
                      <Th className="w-24">Ketuntasan</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...data.perUser]
                      .sort((a, b) => a.completion - b.completion)
                      .slice(0, 8)
                      .map((u) => (
                        <tr key={u.userId} className="border-b border-border/60 last:border-0">
                          <Td>
                            <p className="font-medium text-foreground">{u.nama}</p>
                            <p className="text-[11px] text-muted-foreground">{u.jabatan}</p>
                          </Td>
                          <Td className="tabular-nums">{u.subject}</Td>
                          <Td className="tabular-nums">
                            {u.materiTuntas}/{u.materiTotal}
                          </Td>
                          <Td>
                            <Badge tone={u.completion >= 80 ? "success" : u.completion >= 40 ? "warning" : "danger"}>
                              {u.completion}%
                            </Badge>
                          </Td>
                        </tr>
                      ))}
                    {data.perUser.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-3 py-8 text-center text-sm text-muted-foreground">
                          Belum ada peserta terdaftar.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => void muat()} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />} Hitung ulang
          </Button>
          <Button onClick={onClose}>Tutup</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Telusur({ judul, children }: { judul: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-muted/20 p-3">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{judul}</p>
      {children}
    </div>
  );
}

function Baris({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-[12px] text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium text-foreground">{children}</dd>
    </div>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground ${className}`}>{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2.5 align-top ${className}`}>{children}</td>;
}
