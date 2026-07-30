import { LibraryBig } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { canManageElearning } from "@/lib/elearning-shared";
import { getActiveCourse, getCourseTree, listCertificates, listCourses } from "@/lib/data/elearning";
import { getElearningDashboard, getEssayReviews, getParticipantRows } from "@/lib/data/elearning-admin";
import { PageHeader } from "@/components/ui/page-header";
import { KelolaShell } from "@/components/elearning/dashboard";

export const metadata: Metadata = { title: "Kelola E-Learning" };

export default async function ElearningManagePage() {
  const user = (await getSessionUser())!;
  if (!canManageElearning(user)) redirect("/dashboard");

  const courses = await listCourses();
  const primary = (await getActiveCourse()) ?? courses[0] ?? null;

  const [days, dashboard, participants, essays, certificates] = primary
    ? await Promise.all([
        getCourseTree(primary.id),
        getElearningDashboard(primary.id),
        getParticipantRows(primary.id),
        getEssayReviews(primary.id),
        listCertificates(primary.id),
      ])
    : [[], null, [], [], []];

  return (
    <div className="w-full">
      <PageHeader
        icon={LibraryBig}
        title="Kelola E-Learning"
        description="Susun Learning Path, unggah materi & assessment, dan pantau progres peserta. Hanya Head Operational yang dapat mengubah materi."
      />
      <KelolaShell
        course={primary}
        days={days}
        dashboard={dashboard}
        participants={participants}
        essays={essays}
        certificates={certificates.map((c) => ({ number: c.number, recipientName: c.recipientName, issuedAt: c.issuedAt }))}
      />
    </div>
  );
}
