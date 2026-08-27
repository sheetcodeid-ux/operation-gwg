import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { canManageElearning } from "@/lib/elearning-shared";
import { getActiveCourse, getCourseTree, listCertificates, listCourses } from "@/lib/data/elearning";
import {
  getElearningDashboard,
  getEssayReviews,
  getParticipantRows,
  listElearningAudit,
  listLearners,
} from "@/lib/data/elearning-admin";
import { pesertaSemuaCourse } from "@/lib/data/elearning-peserta";
import { KelolaShell } from "@/components/elearning/dashboard";

export const metadata: Metadata = { title: "Kelola E-Learning" };

export default async function ElearningManagePage({
  searchParams,
}: {
  searchParams: Promise<{ course?: string }>;
}) {
  const user = await requireSessionUser();
  if (!canManageElearning(user)) redirect("/dashboard");

  const sp = await searchParams;
  const courses = await listCourses();
  const aktif = await getActiveCourse();

  /**
   * Subject yang sedang dibuka ditentukan alamatnya, bukan keadaan peramban.
   *
   * Dengan begitu materinya, dashboard-nya, dan pesertanya dihitung di server
   * untuk course yang benar — dan tautannya bisa dibagikan ke rekan tanpa
   * membuat mereka mendarat di subject yang berbeda.
   */
  const dipilih = sp.course ? (courses.find((c) => c.id === sp.course) ?? null) : null;
  const primary = dipilih ?? aktif ?? courses[0] ?? null;

  // Jumlah materi tiap subject dibaca dari pohonnya masing-masing. Untuk
  // belasan subject ini masih murah; kalau nanti jadi ratusan, angkanya perlu
  // dihitung sekali lewat satu kueri agregat, bukan pohon per pohon.
  const pohonSemua = await Promise.all(courses.map((c) => getCourseTree(c.id)));
  const jumlahMateri = new Map(
    courses.map((c, i) => [c.id, (pohonSemua[i] ?? []).reduce((a, d) => a + (d.lessons?.length ?? 0), 0)]),
  );

  const pesertaPerCourse = await pesertaSemuaCourse();
  const semuaPeserta = listLearners();

  const subjects = courses.map((c) => ({
    id: c.id,
    judul: c.title,
    keterangan: c.description,
    aktif: c.active,
    jumlahMateri: jumlahMateri.get(c.id) ?? 0,
    jumlahPeserta: (pesertaPerCourse.get(c.id) ?? []).length,
    totalPeserta: semuaPeserta.length,
  }));

  const [days, dashboard, participants, essays, certificates, audit] = primary
    ? await Promise.all([
        getCourseTree(primary.id),
        getElearningDashboard(primary.id),
        getParticipantRows(primary.id),
        getEssayReviews(primary.id),
        listCertificates(primary.id),
        listElearningAudit(60),
      ])
    : [[], null, [], [], [], []];

  // Tanpa kepala halaman: bingkai modulnya membawa judul, angka ringkas,
  // pencarian, dan saringannya sendiri.
  return (
    <div className="flex w-full flex-col">
      <KelolaShell
        course={primary}
        days={days}
        dashboard={dashboard}
        participants={participants}
        essays={essays}
        certificates={certificates.map((c) => ({ number: c.number, recipientName: c.recipientName, issuedAt: c.issuedAt }))}
        audit={audit}
        subjects={subjects}
        pilihanPeserta={semuaPeserta.map((u) => ({
          id: u.id,
          nama: u.name,
          departemen: (u.department ?? "").trim(),
        }))}
        courseAktifId={aktif?.id ?? null}
      />
    </div>
  );
}
