import { GraduationCap } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { canReachMenu } from "@/lib/nav";
import { getActiveCourse, getCourseTree, getProgressMap, getQuizResultsMap } from "@/lib/data/elearning";
import { canManageElearning } from "@/lib/elearning-shared";
import { EmptyState, PageHeader } from "@/components/ui/page-header";
import { LearnPath } from "@/components/elearning/learn-path";
import { AlurBelajar } from "@/components/elearning/alur-belajar";

export const metadata: Metadata = { title: "E-Learning" };

export default async function ElearningPage() {
  const user = await requireSessionUser();
  if (!canReachMenu(user, "elearning")) redirect("/dashboard");

  const canManage = canManageElearning(user);
  const course = await getActiveCourse();

  if (!course) {
    return (
      <div className="w-full">
        <PageHeader
          icon={GraduationCap}
          title="E-Learning"
          description="Pusat pembelajaran mandiri untuk onboarding & pengembangan. Belajar bertahap, kerjakan assessment, dan pantau progres Anda."
        />
        <EmptyState
          icon={GraduationCap}
          title="Belum ada materi pembelajaran"
          description={
            canManage
              ? "Buka Kelola E-Learning untuk membuat course, menyusun Hari 1–7, dan mengunggah materi."
              : "Materi pembelajaran belum tersedia. Silakan cek kembali nanti — Head Operational sedang menyiapkannya."
          }
        />
      </div>
    );
  }

  const [days, progress, quizResults] = await Promise.all([
    getCourseTree(course.id),
    getProgressMap(user.id, course.id),
    getQuizResultsMap(user.id, course.id),
  ]);

  return (
    <div className="w-full space-y-4">
      {/* Alurnya dijelaskan sekali di atas, sebelum daftar materinya.
          Fast Start & Fast Track tidak lagi jadi halaman terpisah (hasil
          Meeting Fitur HRD), jadi di sinilah crew outlet menemukan
          penjelasannya — bukan di menu yang sudah tidak ada. */}
      <AlurBelajar />
      <LearnPath course={course} days={days} progress={progress} quizResults={quizResults} canManage={canManage} />
    </div>
  );
}
