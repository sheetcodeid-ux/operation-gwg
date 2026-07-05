"use client";

import { Check, X } from "lucide-react";
import { PARAMETERS, SYARAT_UTAMA } from "@/lib/assessment/config";
import { cn } from "@/lib/utils";
import { Field, Input, Select } from "@/components/ui/input";
import { useAssessment } from "./context";
import { Banner, Card, ScoreOptions, SectionLabel } from "./parts";

/** Tab ②: verify the 3 hard requirements, capture identity, and self-assessment. */
export function SyaratTab() {
  const a = useAssessment();

  return (
    <div className="space-y-4">
      <SectionLabel>① Verifikasi Syarat Utama</SectionLabel>
      <Banner tone="amber" icon="⚠">
        Ketiga syarat di bawah <strong>harus terpenuhi</strong> sebelum proses penilaian dilanjutkan. Jika ada yang tidak
        terpenuhi, proses dihentikan dan dijadwalkan ulang.
      </Banner>

      <div className="grid gap-3 sm:grid-cols-3">
        {SYARAT_UTAMA.map((s) => {
          const checked = !!a.syarat[s.id];
          return (
            <Card key={s.id} className={cn("transition-colors", checked && "ring-1 ring-brand-500/30")}>
              <div className="mb-2 flex items-center justify-between">
                <span
                  className={cn(
                    "grid size-7 place-items-center rounded-full text-xs font-bold",
                    checked ? "bg-brand-500 text-white" : "bg-muted text-muted-foreground ring-1 ring-border",
                  )}
                >
                  {checked ? <Check className="size-4" /> : "?"}
                </span>
                <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Syarat {s.id}</span>
              </div>
              <p className="text-sm font-semibold text-foreground">{s.label}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{s.sub}</p>
              <label className="mt-3 flex cursor-pointer items-start gap-2 text-xs font-medium text-foreground">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => a.toggleSyarat(s.id, e.target.checked)}
                  className="mt-0.5 size-4 accent-brand-500"
                />
                <span>{s.confirm}</span>
              </label>
            </Card>
          );
        })}
      </div>

      {a.syaratPassed ? (
        <Banner tone="success" icon={<Check className="size-4" />}>
          <strong>Semua syarat terpenuhi</strong> — proses dapat dilanjutkan. Lengkapi identitas dan Self Assessment di bawah.
        </Banner>
      ) : (
        <Banner tone="danger" icon={<X className="size-4" />}>
          <strong>Syarat belum lengkap</strong> — centang ketiga syarat utama untuk melanjutkan proses penilaian.
        </Banner>
      )}

      <SectionLabel>② Identitas Karyawan</SectionLabel>
      <Card>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nama lengkap karyawan">
            <Input value={a.candidate.nama} onChange={(e) => a.setCandidate({ nama: e.target.value })} placeholder="Contoh: Budi Santoso" />
          </Field>
          <Field label="NIK / ID Karyawan">
            <Input value={a.candidate.nik} onChange={(e) => a.setCandidate({ nik: e.target.value })} placeholder="Contoh: EMP-2019-0123" />
          </Field>
          <Field label="Jabatan saat ini">
            <Input value={a.candidate.jabatan} onChange={(e) => a.setCandidate({ jabatan: e.target.value })} placeholder="Contoh: Staff Senior" />
          </Field>
          <Field label="Departemen">
            <Input value={a.candidate.departemen} onChange={(e) => a.setCandidate({ departemen: e.target.value })} placeholder="Contoh: Operations" />
          </Field>
          <Field label="Golongan saat ini">
            <Input value={a.candidate.golongan} onChange={(e) => a.setCandidate({ golongan: e.target.value })} placeholder="Contoh: II-B" />
          </Field>
          <Field label="Golongan tujuan">
            <Input value={a.candidate.golonganTujuan} onChange={(e) => a.setCandidate({ golonganTujuan: e.target.value })} placeholder="Contoh: III-A" />
          </Field>
          <Field label="Masa kerja (untuk parameter Masa Kerja)" className="sm:col-span-2">
            <Select
              value={String(a.candidate.masaKerja)}
              onChange={(e) => {
                const v = Number(e.target.value);
                a.setCandidate({ masaKerja: v });
                a.pickScore("hc", "msk", v); // masa kerja is auto-scored from HR
              }}
            >
              <option value="1">Kurang dari 1 tahun</option>
              <option value="2">1 – 2 tahun</option>
              <option value="3">2 – 3 tahun</option>
              <option value="4">3 – 5 tahun</option>
              <option value="5">Lebih dari 5 tahun</option>
            </Select>
          </Field>
        </div>
      </Card>

      <SectionLabel>③ Self Assessment — Penilaian Mandiri Karyawan</SectionLabel>
      <Banner tone="violet" icon="💬">
        Diisi oleh karyawan secara mandiri dan jujur. Penilaian ini <strong>tidak mempengaruhi skor final</strong>, namun
        dipakai sebagai bahan perbandingan persepsi saat kalibrasi dan interview akhir.
      </Banner>

      <div className="space-y-3">
        {PARAMETERS.map((p) => (
          <Card key={p.key}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-foreground">{p.title}</p>
              <span className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Bobot {p.weight}% · Skala 1–{p.scale}
              </span>
            </div>
            <ScoreOptions options={p.options} value={a.self[p.key]} onPick={(v) => a.pickSelf(p.key, v)} accent="violet" />
          </Card>
        ))}
      </div>
    </div>
  );
}
