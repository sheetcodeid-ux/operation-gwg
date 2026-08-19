import { GraduationCap } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { canReachMenu } from "@/lib/nav";
import { getActiveCourse, getCourseTree, getProgressMap, getQuizResultsMap } from "@/lib/data/elearning";
import { canManageElearning } from "@/lib/elearning-shared";
import { EmptyState } from "@/components/ui/page-header";
import { LearnPath } from "@/components/elearning/learn-path";
import { RuangBelajar } from "@/components/elearning/ruang-belajar";

export const metadata: Metadata = { title: "Self-Learning (LMS)" };

export default async function ElearningPage() {
  const user = await requireSessionUser();
  if (!canReachMenu(user, "elearning")) redirect("/dashboard");

  const canManage = canManageElearning(user);
  const course = await getActiveCourse();

  // Kurikulumnya ditampilkan lebih dulu dan SELALU, juga ketika belum ada satu
  // pun materi digital yang terbit. Sebelumnya halaman ini berhenti di layar
  // kosong "belum ada materi", sehingga orang yang membukanya tidak punya cara
  // tahu ia sebenarnya sedang menunggu apa — padahal daftar materi yang wajib
  // ia jalani sudah ditetapkan Learning & Development sejak awal.
  const [days, progress, quizResults] = course
    ? await Promise.all([
        getCourseTree(course.id),
        getProgressMap(user.id, course.id),
        getQuizResultsMap(user.id, course.id),
      ])
    : [[], {}, {}];

  // Progres dihitung dari materi yang BENAR-BENAR terbit, bukan dari kurikulum
  // rekomendasi. Kurikulum belum tentu sudah ada versi digitalnya, dan memakai
  // jumlahnya sebagai pembagi membuat progres orang terlihat mandek padahal ia
  // sudah menyelesaikan semua yang tersedia.
  const materiTerbit = days.flatMap((d) => d.lessons ?? []);
  const materiTuntas = materiTerbit.filter((l) => progress[l.id]?.completed).length;

  return (
    <div className="w-full space-y-4">
      <RuangBelajar
        namaPengguna={user.name.split(" ")[0] || user.name}
        materiTuntas={materiTuntas}
        totalMateriTerbit={materiTerbit.length}
      />
      {course ? (
        <LearnPath course={course} days={days} progress={progress} quizResults={quizResults} canManage={canManage} />
      ) : (
        <EmptyState
          icon={GraduationCap}
          title="Materi digitalnya belum terbit"
          description={
            canManage
              ? "Kurikulum di atas sudah ditetapkan. Buka Kelola E-Learning untuk menyusun materinya jadi course yang bisa dikerjakan."
              : "Kurikulum di atas sudah ditetapkan, materi digitalnya sedang disiapkan Learning & Development."
          }
        />
      )}
    </div>
  );
}
