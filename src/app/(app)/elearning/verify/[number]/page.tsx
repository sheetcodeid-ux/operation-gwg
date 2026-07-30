import { BadgeCheck, ShieldX } from "lucide-react";
import type { Metadata } from "next";
import { getCertificateByNumber } from "@/lib/data/elearning";
import { certVerifyQr } from "@/lib/elearning-cert-qr";
import { PageHeader } from "@/components/ui/page-header";
import { Certificate } from "@/components/elearning/certificate";

export const metadata: Metadata = { title: "Validasi Sertifikat" };

export default async function VerifyPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const cert = await getCertificateByNumber(decodeURIComponent(number));

  if (!cert) {
    return (
      <div className="w-full">
        <PageHeader icon={ShieldX} title="Validasi Sertifikat" description="Verifikasi keaslian sertifikat E-Learning." />
        <div className="mx-auto max-w-md rounded-2xl border border-red-500/30 bg-red-500/5 p-8 text-center">
          <ShieldX className="mx-auto size-10 text-red-500" />
          <p className="mt-3 text-base font-semibold text-foreground">Sertifikat tidak ditemukan</p>
          <p className="mt-1 text-sm text-muted-foreground">Nomor <span className="font-mono">{decodeURIComponent(number)}</span> tidak terdaftar dalam sistem.</p>
        </div>
      </div>
    );
  }

  const { qrDataUrl } = await certVerifyQr(cert.number);

  return (
    <div className="w-full space-y-4">
      <PageHeader icon={BadgeCheck} title="Validasi Sertifikat" description="Verifikasi keaslian sertifikat E-Learning." />
      <div className="mx-auto flex max-w-3xl items-center gap-3 rounded-xl border border-brand-500/30 bg-brand-500/5 p-4">
        <BadgeCheck className="size-6 shrink-0 text-brand-500" />
        <div>
          <p className="text-sm font-semibold text-foreground">Sertifikat Terverifikasi ✅</p>
          <p className="text-xs text-muted-foreground">Sertifikat ini asli & terdaftar atas nama {cert.recipientName}.</p>
        </div>
      </div>
      <Certificate cert={cert} qrDataUrl={qrDataUrl} showActions={false} />
    </div>
  );
}
