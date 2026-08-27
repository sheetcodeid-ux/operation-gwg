"use client";

import * as React from "react";
import { BookOpen, ClipboardCheck, Clock, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatTile } from "@/components/ui/stat";
import { GrafikBatangGanda } from "./grafik";
import {
  BilahModul,
  KerangkaModul,
  useLayarPenuh,
} from "@/components/hcmos/kit-modul";
import { AlurLangkah } from "./alur";
import {
  ALUR_ASSESSMENT,
  CARA_KERJA_AKUMULASI,
  HASIL_META,
  LABEL_TAHAP,
  STATUS_TAHAP_META,
  ringkasAssessment,
  ringkasProgram,
  type BarisAssessment,
} from "@/lib/hcmos/assessment-materi";
import type { RekamanPelatihan } from "@/lib/hcmos/pelatihan";

/**
 * Pre Test & Post Test.
 *
 * Sepuluh materi Fast Start / Fast Track selalu ditampilkan seluruhnya, juga
 * yang belum dinilai. Tabel yang hanya memuat materi bernilai menyembunyikan
 * justru yang paling perlu ditindaklanjuti: materi yang belum pernah diuji.
 */
export function AssessmentBoard({ rekaman }: { rekaman: RekamanPelatihan[] }) {
  const baris = React.useMemo(() => ringkasAssessment(rekaman), [rekaman]);
  const program = React.useMemo(() => ringkasProgram(baris), [baris]);
  const { bingkai, layarPenuh, alih } = useLayarPenuh();

  return (
    <KerangkaModul ref={bingkai}>
      {/* Tanpa kotak cari: isinya sepuluh materi tetap, dan sepuluh baris tidak
          perlu dicari. Kotak cari yang ada karena modul lain punya hanya
          menambah satu hal untuk diabaikan. */}
      <BilahModul
        ikon={ClipboardCheck}
        gradien="from-violet-500 via-purple-500 to-indigo-600 shadow-purple-500/20"
        judul="Pre Test & Post Test"
        ringkas={
          <>
            {program.totalMateri} materi · {program.materiSelesai} Post Test lengkap · lulus minimal{" "}
            {program.nilaiMinimum}
            {program.rerataPeningkatan !== null &&
              ` · peningkatan rata-rata ${program.rerataPeningkatan >= 0 ? "+" : ""}${program.rerataPeningkatan}`}
          </>
        }
        panduan="assessment"
        layarPenuh={layarPenuh}
        onLayarPenuh={alih}
      />

      <div className="min-h-0 flex-1 space-y-4 overflow-auto p-3">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          icon={BookOpen}
          label="Total Materi Fast Start / Fast Track"
          value={program.totalMateri}
          sub={`${program.materiSelesai} materi Post Test-nya sudah lengkap`}
        />
        <StatTile
          icon={Clock}
          label="Durasi Post Test per Materi"
          value={`${program.durasiPostTest} menit`}
          sub={`${program.durasiPostTest * program.totalMateri} menit bila seluruhnya ditempuh`}
        />
        <StatTile
          icon={ClipboardCheck}
          label="Nilai Minimum Kelulusan"
          value={program.nilaiMinimum}
          sub={
            program.akumulasiProgram === null
              ? "nilai akumulasi belum bisa dihitung"
              : `nilai akumulasi saat ini ${program.akumulasiProgram}`
          }
        />
        <StatTile
          icon={TrendingUp}
          label="Rata-rata Peningkatan Pre → Post"
          value={
            program.rerataPeningkatan === null
              ? "—"
              : `${program.rerataPeningkatan >= 0 ? "+" : ""}${program.rerataPeningkatan}`
          }
          sub={
            program.rerataPre === null || program.rerataPost === null
              ? "belum ada materi yang punya Pre dan Post Test"
              : `Pre ${program.rerataPre} → Post ${program.rerataPost}`
          }
        />
      </div>

      <AlurLangkah
        judul="Alur Assessment"
        ringkas="Setiap materi wajib melalui tahapan berikut sebelum masuk ke nilai akumulasi"
        langkah={ALUR_ASSESSMENT}
      />

      {/* ── Rincian per materi ──────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Rincian Assessment per Materi Muatan</CardTitle>
          <p className="text-[11px] text-muted-foreground">
            Fast Start / Fast Track — {program.totalMateri} materi wajib: {LABEL_TAHAP.pre}, {LABEL_TAHAP.role_play},{" "}
            {LABEL_TAHAP.post}. Kelulusan minimal {program.nilaiMinimum}.
          </p>
        </CardHeader>
        <CardContent>
          <div className="-mx-4 overflow-x-auto px-4">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <Th>No</Th>
                  <Th>Materi</Th>
                  <Th>Pre Test</Th>
                  <Th>Role Play</Th>
                  <Th>{LABEL_TAHAP.post}</Th>
                  <Th>Nilai Akumulasi</Th>
                  <Th>Kelulusan</Th>
                </tr>
              </thead>
              <tbody>
                {baris.map((b) => (
                  <BarisMateri key={b.no} b={b} />
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ── Perbandingan Pre vs Post ────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Perbandingan Pre Test vs Post Test</CardTitle>
          <p className="text-[11px] text-muted-foreground">
            Mengukur peningkatan pemahaman peserta sebelum &amp; sesudah materi diberikan
          </p>
        </CardHeader>
        <CardContent>
          {program.rerataPeningkatan === null ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Belum ada materi yang punya nilai Pre Test dan Post Test sekaligus.
            </p>
          ) : (
            <div className="-mx-4 overflow-x-auto px-4">
              <table className="w-full min-w-[560px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <Th>Materi</Th>
                    <Th>Pre Test</Th>
                    <Th>Post Test</Th>
                    <Th>Peningkatan</Th>
                    <Th>Ket.</Th>
                  </tr>
                </thead>
                <tbody>
                  {baris
                    .filter((b) => b.peningkatan !== null)
                    .map((b) => (
                      <tr key={b.no} className="border-b border-border/60">
                        <Td className="font-medium text-foreground">{b.judul}</Td>
                        <Td className="tabular-nums">{b.pre}</Td>
                        <Td className="tabular-nums">{b.post}</Td>
                        <Td>
                          <Badge tone={(b.peningkatan as number) >= 0 ? "success" : "danger"}>
                            {(b.peningkatan as number) >= 0 ? "+" : ""}
                            {b.peningkatan}
                          </Badge>
                        </Td>
                        <Td>{(b.peningkatan as number) >= 0 ? "Naik" : "Turun"}</Td>
                      </tr>
                    ))}
                  <tr className="bg-muted/30">
                    <Td className="font-semibold text-foreground">
                      Rata-rata ({baris.filter((b) => b.peningkatan !== null).length} materi dinilai)
                    </Td>
                    <Td className="tabular-nums font-semibold text-foreground">{program.rerataPre}</Td>
                    <Td className="tabular-nums font-semibold text-foreground">{program.rerataPost}</Td>
                    <Td>
                      <Badge tone={(program.rerataPeningkatan ?? 0) >= 0 ? "success" : "danger"}>
                        {(program.rerataPeningkatan ?? 0) >= 0 ? "+" : ""}
                        {program.rerataPeningkatan}
                      </Badge>
                    </Td>
                    <Td className="font-semibold text-foreground">
                      {(program.rerataPeningkatan ?? 0) >= 0 ? "Naik" : "Turun"}
                    </Td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <GrafikBatangGanda
        judul="Grafik Perbandingan Pre Test vs Post Test"
        subjudul="Per materi — hanya materi yang sudah punya kedua nilainya"
        data={baris.map((b) => ({ nama: b.judul, kiri: b.pre, kanan: b.post }))}
        labelKiri="Pre Test"
        labelKanan="Post Test"
        pesanKosong="Belum ada materi yang punya nilai Pre Test dan Post Test sekaligus."
      />

      {/* ── Aturan mainnya ──────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Cara Kerja Akumulasi Nilai</CardTitle>
          <p className="text-[11px] text-muted-foreground">
            Nilai akhir Fast Start / Fast Track dihitung otomatis dari seluruh materi
          </p>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-border">
            {CARA_KERJA_AKUMULASI.map((c) => (
              <li key={c.judul} className="py-3 first:pt-0 last:pb-0">
                <p className="text-sm font-medium text-foreground">{c.judul}</p>
                <p className="text-[12px] leading-relaxed text-muted-foreground">{c.isi}</p>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      </div>
    </KerangkaModul>
  );
}

function BarisMateri({ b }: { b: BarisAssessment }) {
  const hasil = HASIL_META[b.hasil];
  return (
    <tr className="border-b border-border/60 last:border-0">
      <Td className="tabular-nums">{b.no}</Td>
      <Td className="font-medium text-foreground">
        {b.judul}
        <span className="block text-[11px] font-normal text-muted-foreground">
          {b.bentuk} · {b.menit} menit
          {b.peserta > 0 ? ` · ${b.peserta} peserta` : ""}
        </span>
      </Td>
      <Td className="tabular-nums">{b.pre ?? <TahapKosong status={b.statusPre} />}</Td>
      <Td>
        <StatusChip status={b.statusRolePlay} />
      </Td>
      <Td>
        {b.post === null ? (
          <StatusChip status={b.statusPost} />
        ) : (
          <Badge tone={STATUS_TAHAP_META[b.statusPost].tone}>
            {STATUS_TAHAP_META[b.statusPost].label} — {b.post}
          </Badge>
        )}
      </Td>
      <Td className="tabular-nums">{b.akumulasi ?? "—"}</Td>
      <Td>
        <Badge tone={hasil.tone} dot>
          {hasil.label}
        </Badge>
      </Td>
    </tr>
  );
}

const StatusChip = ({ status }: { status: "belum" | "berjalan" | "selesai" }) => {
  const m = STATUS_TAHAP_META[status];
  return <Badge tone={m.tone}>{m.label}</Badge>;
};

const TahapKosong = ({ status }: { status: "belum" | "berjalan" | "selesai" }) => (
  <span className="text-muted-foreground">{status === "belum" ? "—" : STATUS_TAHAP_META[status].label}</span>
);

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{children}</th>
  );
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2.5 align-top text-muted-foreground ${className}`}>{children}</td>;
}
