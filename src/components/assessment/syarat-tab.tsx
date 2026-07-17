"use client";

import { ArrowRight, Check, MessageSquare, Star, TriangleAlert, X } from "lucide-react";
import { PARAMETERS, SYARAT_UTAMA } from "@/lib/assessment/config";
import { BATCHES, GOLONGAN } from "@/lib/assessment/org";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { useAssessment } from "./context";
import { Banner, Card, Dropdown, ScoreOptions, ScrollRow, SectionLabel } from "./parts";

const golonganOptions = GOLONGAN.map((g) => ({ value: g, label: g }));
const batchOptions = BATCHES.map((b) => ({ value: b, label: b }));

/** Tab ②: verify the 3 hard requirements, capture identity, and self-assessment. */
export function SyaratTab() {
  const a = useAssessment();

  return (
    <div className="space-y-4">
      <SectionLabel>① Verifikasi Syarat Utama</SectionLabel>
      <Banner tone="amber" icon={<TriangleAlert className="size-4" />}>
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
        {/* Identity is the signed-in participant themselves — no picking. */}
        <div className="rounded-xl border border-border bg-muted/20 p-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Peserta (Anda)</p>
          <p className="mt-0.5 text-sm font-semibold text-foreground">{a.viewer.name || "—"}</p>
          <p className="text-xs text-muted-foreground">{[a.viewer.jabatan, a.viewer.department].filter(Boolean).join(" · ") || "—"}</p>
        </div>

        <div className="mt-3">
          <ScrollRow cols={2}>
            <Field label="NIK / ID Karyawan">
              <Input value={a.selfId.nik} onChange={(e) => a.patchSelfId({ nik: e.target.value })} placeholder="Contoh: EMP-2019-0123" />
            </Field>
            <Dropdown label="Batch" value={a.selfId.batch} onChange={(v) => a.patchSelfId({ batch: v })} options={batchOptions} placeholder="Pilih batch…" />
          </ScrollRow>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Dropdown label="Golongan Saat Ini" value={a.selfId.golongan} onChange={(v) => a.patchSelfId({ golongan: v })} options={golonganOptions} placeholder="Pilih golongan…" />
          <Dropdown label="Golongan Tujuan" value={a.selfId.golonganTujuan} onChange={(v) => a.patchSelfId({ golonganTujuan: v })} options={golonganOptions} placeholder="Pilih golongan…" />
        </div>

        {(a.viewer.jabatan ?? "").toLowerCase().startsWith("head") && (
          <div className="mt-4">
            <Banner tone="violet" icon={<Star className="size-4" />}>
              Jabatan <strong>Head</strong> — sebagai peserta Anda dinilai oleh <strong>Director (60%)</strong> &amp; <strong>HC (40%)</strong>.
            </Banner>
          </div>
        )}
      </Card>

      <SectionLabel>③ Self Assessment — Penilaian Mandiri Karyawan</SectionLabel>
      <Banner tone="violet" icon={<MessageSquare className="size-4" />}>
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

      {/* Spec §2: continue button once Panduan, Syarat & SA, and Referensi are done. */}
      <ContinueGate />
    </div>
  );
}

function ContinueGate() {
  const a = useAssessment();
  const canProceed = a.role !== "karyawan";
  if (a.readyForPenilaian) {
    return (
      <div className="space-y-2">
        {a.saved && (
          <Banner tone="success" icon={<Check className="size-4" />}>
            <strong>Data assessment tersimpan.</strong>{" "}
            {canProceed ? "Melanjutkan ke halaman Penilaian." : "Penilaian dilakukan oleh Atasan Langsung, HR, atau Director."}
          </Banner>
        )}
        <Button className="h-12 w-full text-base" onClick={a.saveAndContinue} disabled={a.selfBusy}>
          {canProceed ? "Simpan & Lanjut ke Penilaian" : "Simpan Self Assessment"}
          <ArrowRight className="size-5" />
        </Button>
      </div>
    );
  }

  const missing: string[] = [];
  if (!a.syaratPassed) missing.push("centang 3 syarat utama");
  if (!a.selfIdentityComplete) missing.push("lengkapi golongan saat ini, golongan tujuan & batch");
  if (!a.selfComplete) missing.push("isi seluruh Self Assessment");
  if (!a.visited.has("panduan")) missing.push("buka tab Panduan");
  if (!a.visited.has("referensi")) missing.push("buka tab Referensi");

  return (
    <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4 text-center text-sm text-muted-foreground">
      Untuk melanjutkan ke Penilaian: {missing.join(" · ")}.
    </div>
  );
}
