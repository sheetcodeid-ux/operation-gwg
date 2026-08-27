import { GraduationCap } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { canReachMenu } from "@/lib/nav";
import { getActiveCourse, getCourseTree, getProgressMap, getQuizResultsMap } from "@/lib/data/elearning";
import { canManageElearning } from "@/lib/elearning-shared";
import { bolehIkut, pesertaCourse } from "@/lib/data/elearning-peserta";
import { EmptyState } from "@/components/ui/page-header";
import { LearnPath } from "@/components/elearning/learn-path";
import { RuangBelajar } from "@/components/elearning/ruang-belajar";

export const metadata: Metadata = { title: "Self-Learning (LMS)" };

export default async function ElearningPage() {
  const user = await requireSessionUser();
  if (!canReachMenu(user, "elearning")) redirect("/dashboard");

  const canManage = canManageElearning(user);

  /**
   * Subject yang boleh dibuka orang ini.
   *
   * Subject tanpa daftar peserta TERBUKA untuk semua — itu perilaku lama, dan
   * seluruh course yang sudah ada memang begitu. Begitu HC menetapkan peserta,
   * subject itu berhenti terbuka. Yang tidak ditugaskan tidak boleh sekadar
   * "tidak melihatnya di daftar": ia benar-benar tidak dimuat, supaya materi
   * yang bukan untuknya tidak pernah sampai ke perambannya.
   *
   * Pengelola dikecualikan — merekalah yang menyusun materinya, dan tidak bisa
   * meninjau apa yang tidak boleh mereka buka.
   */
  const aktif = await getActiveCourse();
  const course =
    !aktif || canManage
      ? aktif
      : bolehIkut(await pesertaCourse(aktif.id), user.id)
        ? aktif
        : null;

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
        /* Dua sebab, dua kalimat. Yang belum ditugaskan tidak boleh dibilang
           "materinya belum terbit" — materinya ADA, cuma bukan untuknya, dan
           kalimat yang salah membuatnya menunggu sesuatu yang tidak akan
           pernah datang alih-alih menanyakannya ke Human Capital. */
        <EmptyState
          icon={GraduationCap}
          title={aktif ? "Belum ada subject untuk Anda" : "Materi digitalnya belum terbit"}
          description={
            aktif
              ? "Subject yang berjalan saat ini pesertanya sudah ditetapkan dan nama Anda belum termasuk. Hubungi Human Capital bila seharusnya ikut."
              : canManage
                ? "Kurikulum di atas sudah ditetapkan. Buka Kelola E-Learning untuk menyusun materinya jadi course yang bisa dikerjakan."
                : "Kurikulum di atas sudah ditetapkan, materi digitalnya sedang disiapkan Learning & Development."
          }
        />
      )}
    </div>
  );
}
