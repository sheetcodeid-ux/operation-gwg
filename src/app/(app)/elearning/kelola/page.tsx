import { LibraryBig } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { canManageElearning } from "@/lib/elearning-shared";
import { getActiveCourse, getCourseTree, listCourses } from "@/lib/data/elearning";
import { PageHeader } from "@/components/ui/page-header";
import { ManageElearning } from "@/components/elearning/manage";

export const metadata: Metadata = { title: "Kelola E-Learning" };

export default async function ElearningManagePage() {
  const user = (await getSessionUser())!;
  if (!canManageElearning(user)) redirect("/dashboard");

  const courses = await listCourses();
  const primary = (await getActiveCourse()) ?? courses[0] ?? null;
  const days = primary ? await getCourseTree(primary.id) : [];

  return (
    <div className="w-full">
      <PageHeader
        icon={LibraryBig}
        title="Kelola E-Learning"
        description="Susun Learning Path (Hari 1–7), unggah video/PDF/SOP, dan atur aturan belajar. Hanya Head Operational yang dapat mengunggah & mengubah materi."
      />
      <ManageElearning course={primary} days={days} />
    </div>
  );
}
