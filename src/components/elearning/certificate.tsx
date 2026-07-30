"use client";

import * as React from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface CertificateView {
  number: string;
  recipientName: string;
  jabatan: string;
  courseTitle: string;
  score: number;
  issuedAt: string;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

/** A printable completion certificate. The QR (data URI, generated server-side)
 *  encodes the public verification URL. */
export function Certificate({ cert, qrDataUrl, showActions = true }: { cert: CertificateView; qrDataUrl: string; showActions?: boolean }) {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      {showActions && (
        <div className="flex justify-end print:hidden">
          <Button onClick={() => window.print()}><Printer className="size-4" /> Cetak / Simpan PDF</Button>
        </div>
      )}

      <div className="cert-sheet relative overflow-hidden rounded-2xl border-4 border-brand-500/30 bg-white p-8 text-center text-slate-800 shadow-xl sm:p-12">
        {/* Corner flourishes */}
        <div className="pointer-events-none absolute inset-3 rounded-xl border border-brand-500/20" />

        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-600">GWG Group</p>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Sertifikat Kelulusan</h1>
        <p className="mt-1 text-sm text-slate-500">Diberikan sebagai penghargaan atas penyelesaian program pembelajaran</p>

        <p className="mt-8 text-xs uppercase tracking-widest text-slate-400">Diberikan kepada</p>
        <p className="mt-2 text-3xl font-bold text-brand-700 sm:text-4xl">{cert.recipientName || "—"}</p>
        {cert.jabatan && <p className="mt-1 text-sm text-slate-500">{cert.jabatan}</p>}

        <p className="mx-auto mt-6 max-w-xl text-sm leading-relaxed text-slate-600">
          Telah berhasil menyelesaikan seluruh materi dan penilaian pada program
          <span className="font-semibold text-slate-800"> “{cert.courseTitle || "Pembelajaran"}” </span>
          dengan nilai rata-rata <span className="font-semibold text-slate-800">{cert.score}</span>.
        </p>

        <div className="mt-10 flex items-end justify-between gap-4">
          <div className="text-left">
            <p className="text-xs text-slate-400">Nomor Sertifikat</p>
            <p className="font-mono text-sm font-semibold text-slate-700">{cert.number}</p>
            <p className="mt-3 text-xs text-slate-400">Tanggal Terbit</p>
            <p className="text-sm font-medium text-slate-700">{fmtDate(cert.issuedAt)}</p>
          </div>
          <div className="text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrDataUrl} alt="QR validasi" className="size-24 rounded-lg bg-white" />
            <p className="mt-1 text-[10px] text-slate-400">Pindai untuk validasi</p>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          body { background: #fff !important; }
          .cert-sheet { box-shadow: none !important; border-color: rgba(0,0,0,.2) !important; }
        }
      `}</style>
    </div>
  );
}
