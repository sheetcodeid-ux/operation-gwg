import { Award } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { canReachMenu } from "@/lib/nav";
import { getActiveCourse, getCertificate } from "@/lib/data/elearning";
import { certVerifyQr } from "@/lib/elearning-cert-qr";
import { EmptyState, PageHeader } from "@/components/ui/page-header";
import { Certificate } from "@/components/elearning/certificate";

export const metadata: Metadata = { title: "Sertifikat" };

export default async function CertificatePage() {
  const user = await requireSessionUser();
  if (!canReachMenu(user, "elearning")) redirect("/dashboard");

  const course = await getActiveCourse();
  const cert = course ? await getCertificate(user.id, course.id) : null;

  if (!cert) {
    return (
      <div className="w-full">
        <PageHeader icon={Award} title="Sertifikat" description="Sertifikat kelulusan pembelajaran Anda." />
        <EmptyState icon={Award} title="Belum ada sertifikat" description="Selesaikan seluruh materi dan lulus semua assessment untuk memperoleh sertifikat otomatis." />
      </div>
    );
  }

  const { qrDataUrl } = await certVerifyQr(cert.number);

  return (
    <div className="w-full">
      <PageHeader icon={Award} title="Sertifikat Kelulusan" description="Selamat! Simpan atau cetak sertifikat Anda." />
      <Certificate cert={cert} qrDataUrl={qrDataUrl} />
    </div>
  );
}
