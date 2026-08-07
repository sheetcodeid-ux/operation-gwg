"use client";

import * as React from "react";
import Link from "next/link";
import { ExternalLink, FileText, Loader2, RotateCcw } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { chatRequestDetailAction } from "@/lib/actions/chat";
import { fmtRupiah } from "@/lib/hc-request";
import { formatDate } from "@/lib/utils";
import type { RequestDetail } from "@/lib/chat-shared";

/**
 * Detail pengajuan yang dibuka DARI DALAM obrolan.
 *
 * Dulu kartunya menautkan ke halaman Pengajuan, yang berarti meninggalkan
 * percakapan — padahal yang dibutuhkan setelah membaca detailnya justru
 * membalas di obrolan itu juga. Panel ini menutup dan mengembalikan pengguna
 * tepat ke tempatnya semula; tautan ke halaman penuh tetap disediakan.
 */
export function RequestDetailSheet({
  requestId,
  onClose,
}: {
  requestId: string | null;
  onClose: () => void;
}) {
  const [data, setData] = React.useState<RequestDetail | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!requestId) return;
    setData(null);
    setLoading(true);
    let alive = true;
    void chatRequestDetailAction(requestId).then((d) => {
      if (!alive) return;
      setData(d);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [requestId]);

  return (
    <BottomSheet
      open={requestId !== null}
      onOpenChange={(v) => !v && onClose()}
      title={data?.kindLabel ?? "Pengajuan"}
      description={data ? data.statusLabel : undefined}
      className="sm:max-w-lg"
    >
      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : !data ? (
        <p className="px-5 py-12 text-center text-sm text-muted-foreground">
          Pengajuan tidak ditemukan, atau Anda tidak punya akses ke sana.
        </p>
      ) : (
        <div className="px-5 pb-6">
          <h3 className="text-lg font-semibold leading-snug text-foreground">{data.title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {data.requesterName} · {data.department} · {formatDate(data.createdAt)}
          </p>

          {data.description && (
            <p className="mt-4 whitespace-pre-wrap rounded-xl bg-muted/40 p-3 text-sm leading-relaxed text-foreground">
              {data.description}
            </p>
          )}

          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
            <Row label="Status" value={data.statusLabel} />
            {data.assigneeName && <Row label="Dikerjakan" value={data.assigneeName} />}
            {data.designType && <Row label="Jenis" value={data.designType} />}
            {data.designSize && <Row label="Ukuran" value={data.designSize} />}
            {data.position && <Row label="Posisi" value={data.position} />}
            {data.headcount > 0 && <Row label="Jumlah" value={`${data.headcount} orang`} />}
            {data.trainingType && <Row label="Pelatihan" value={data.trainingType} />}
            {data.participants > 0 && <Row label="Peserta" value={`${data.participants} orang`} />}
            {data.budget > 0 && <Row label="Anggaran" value={fmtRupiah(data.budget)} />}
            {data.plannedDate && <Row label="Rencana" value={formatDate(data.plannedDate)} />}
          </dl>

          {data.attachments.length > 0 && (
            <>
              <p className="mb-2 mt-5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Lampiran
              </p>
              <div className="space-y-1.5">
                {data.attachments.map((a) => (
                  <a
                    key={a.name}
                    href={a.url ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs transition-colors ${
                      a.url ? "hover:bg-muted/60" : "pointer-events-none opacity-60"
                    }`}
                  >
                    <FileText className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate text-foreground">{a.name}</span>
                  </a>
                ))}
              </div>
            </>
          )}

          {data.revisions.length > 0 && (
            <>
              <p className="mb-2 mt-5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Riwayat Revisi
              </p>
              <div className="space-y-2">
                {data.revisions.map((r, i) => (
                  <div key={i} className="rounded-xl border border-border p-3">
                    <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <RotateCcw className="size-3" />
                      {r.byName} · {formatDate(r.at)}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{r.note}</p>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="mt-6 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              Kembali ke obrolan
            </button>
            <Link
              href={data.href}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              Buka halaman <ExternalLink className="size-3.5" />
            </Link>
          </div>
        </div>
      )}
    </BottomSheet>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="truncate text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}
