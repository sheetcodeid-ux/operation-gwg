import "server-only";

import { db, dbEnabled } from "@/lib/data/db";
import { getCourseTree, listCourses } from "@/lib/data/elearning";
import { listLearners } from "@/lib/data/elearning-admin";
import { pesertaEfektif, pesertaSemuaCourse } from "@/lib/data/elearning-peserta";

/**
 * Rekap E-Learning LINTAS SUBJECT, beserta penelusurannya per subject dan per
 * orang.
 *
 * Dashboard yang sudah ada menjawab satu subject sekaligus, dan itu memang yang
 * dibutuhkan saat sedang mengurus satu kelas. Yang tidak bisa dijawabnya adalah
 * pertanyaan pimpinan: "seluruh pelatihan tahun ini sampai mana". Menjumlahkan
 * dashboard subject satu per satu di kepala bukan jawaban — dan orang yang
 * sama muncul di beberapa subject, jadi angkanya tidak boleh sekadar ditambah.
 *
 * PENYEBUT SETIAP PERSENTASE DI SINI ADALAH PESERTA EFEKTIF, bukan seluruh
 * karyawan. Subject yang ditugaskan ke lima orang dan tuntas kelimanya adalah
 * 100%, bukan 5% dari seratus karyawan. Itu satu-satunya alasan penugasan
 * peserta dibuat: tanpa penyebut yang benar, persentase apa pun cuma hiasan.
 */

export interface RingkasReport {
  totalSubject: number;
  totalMateri: number;
  /** Orang berbeda yang jadi peserta minimal satu subject. */
  pesertaUnik: number;
  /** Rata-rata ketuntasan seluruh subject, ditimbang per subject. */
  avgCompletion: number;
  materiBerkuis: number;
  totalAttempt: number;
  avgScore: number;
}

export interface BarisReportSubject {
  courseId: string;
  judul: string;
  aktif: boolean;
  totalMateri: number;
  peserta: number;
  /** Peserta yang sudah menuntaskan SELURUH materinya. */
  tuntas: number;
  completion: number;
  avgScore: number | null;
  attempt: number;
}

export interface BarisReportUser {
  userId: string;
  nama: string;
  jabatan: string;
  /** Subject yang jadi tugasnya — termasuk yang terbuka untuk semua. */
  subject: number;
  materiTuntas: number;
  materiTotal: number;
  completion: number;
  avgScore: number | null;
  terakhir: string | null;
}

export interface ReportElearning {
  ringkas: RingkasReport;
  perSubject: BarisReportSubject[];
  perUser: BarisReportUser[];
}

const persen = (a: number, b: number) => (b === 0 ? 0 : Math.round((a / b) * 100));

/**
 * Seluruh rekapnya dihitung sekali, bukan per subject saat dibuka.
 *
 * Empat kueri untuk seluruh riwayat, lalu semuanya dikelompokkan di memori.
 * Satu kueri per subject akan berarti belasan bolak-balik ke basis data untuk
 * satu layar yang dibuka sekali seminggu.
 */
export async function reportElearning(): Promise<ReportElearning> {
  const kosong: ReportElearning = {
    ringkas: { totalSubject: 0, totalMateri: 0, pesertaUnik: 0, avgCompletion: 0, materiBerkuis: 0, totalAttempt: 0, avgScore: 0 },
    perSubject: [],
    perUser: [],
  };
  if (!dbEnabled) return kosong;

  const courses = await listCourses();
  if (courses.length === 0) return kosong;

  const semuaPeserta = listLearners();
  const ditugaskan = await pesertaSemuaCourse();

  const pohon = await Promise.all(courses.map((c) => getCourseTree(c.id)));
  const materiPerCourse = new Map<string, string[]>();
  courses.forEach((c, i) => {
    materiPerCourse.set(c.id, (pohon[i] ?? []).flatMap((d) => (d.lessons ?? []).map((l) => l.id)));
  });

  const [{ data: progRows }, { data: hasilRows }, { data: kuisRows }] = await Promise.all([
    db().from("elearning_progress").select("course_id,user_id,lesson_id,completed,last_viewed_at"),
    db().from("elearning_quiz_results").select("course_id,user_id,lesson_id,score"),
    db().from("elearning_quizzes").select("lesson_id"),
  ]);

  const prog = (progRows ?? []) as { course_id: string; user_id: string; lesson_id: string; completed: boolean; last_viewed_at: string | null }[];
  const hasil = (hasilRows ?? []) as { course_id: string; user_id: string; lesson_id: string; score: number }[];
  const berkuis = new Set(((kuisRows ?? []) as { lesson_id: string }[]).map((r) => r.lesson_id));

  // Materi tuntas per (course, user) — dipakai dua-duanya, per subject dan per orang.
  const tuntas = new Map<string, Set<string>>();
  const terakhirUser = new Map<string, string>();
  for (const p of prog) {
    if (p.completed) {
      const k = `${p.course_id}|${p.user_id}`;
      const s = tuntas.get(k) ?? new Set<string>();
      s.add(p.lesson_id);
      tuntas.set(k, s);
    }
    if (p.last_viewed_at && (!terakhirUser.get(p.user_id) || p.last_viewed_at > terakhirUser.get(p.user_id)!)) {
      terakhirUser.set(p.user_id, p.last_viewed_at);
    }
  }

  const nilaiPerUser = new Map<string, number[]>();
  const nilaiPerCourse = new Map<string, number[]>();
  for (const r of hasil) {
    nilaiPerUser.set(r.user_id, [...(nilaiPerUser.get(r.user_id) ?? []), r.score]);
    nilaiPerCourse.set(r.course_id, [...(nilaiPerCourse.get(r.course_id) ?? []), r.score]);
  }
  const rata = (xs: number[] | undefined) => (xs && xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

  /* ── per subject ── */
  const perSubject: BarisReportSubject[] = courses.map((c) => {
    const materi = materiPerCourse.get(c.id) ?? [];
    const peserta = pesertaEfektif(ditugaskan.get(c.id) ?? [], semuaPeserta);
    // Materi kosong berarti belum ada yang bisa dituntaskan — 0%, bukan 100%.
    const selesai = materi.length === 0 ? 0 : peserta.filter((u) => (tuntas.get(`${c.id}|${u.id}`)?.size ?? 0) >= materi.length).length;
    return {
      courseId: c.id,
      judul: c.title,
      aktif: c.active,
      totalMateri: materi.length,
      peserta: peserta.length,
      tuntas: selesai,
      completion: persen(selesai, peserta.length),
      avgScore: rata(nilaiPerCourse.get(c.id)),
      attempt: (nilaiPerCourse.get(c.id) ?? []).length,
    };
  });

  /* ── per orang ── */
  const perUser: BarisReportUser[] = semuaPeserta
    .map((u) => {
      const miliknya = courses.filter((c) => {
        const daftar = ditugaskan.get(c.id) ?? [];
        return daftar.length === 0 || daftar.includes(u.id);
      });
      const total = miliknya.reduce((a, c) => a + (materiPerCourse.get(c.id)?.length ?? 0), 0);
      const beres = miliknya.reduce((a, c) => a + (tuntas.get(`${c.id}|${u.id}`)?.size ?? 0), 0);
      return {
        userId: u.id,
        nama: u.name,
        jabatan: (u.jabatan ?? "").trim() || (u.department ?? "").trim() || "—",
        subject: miliknya.length,
        materiTuntas: beres,
        materiTotal: total,
        completion: persen(beres, total),
        avgScore: rata(nilaiPerUser.get(u.id)),
        terakhir: terakhirUser.get(u.id) ?? null,
      };
    })
    .sort((a, b) => b.completion - a.completion || a.nama.localeCompare(b.nama, "id"));

  /* ── ringkasan ── */
  const semuaMateri = [...materiPerCourse.values()].flat();
  const pesertaUnik = new Set<string>();
  for (const c of courses) for (const u of pesertaEfektif(ditugaskan.get(c.id) ?? [], semuaPeserta)) pesertaUnik.add(u.id);
  const nilaiSemua = hasil.map((r) => r.score);

  return {
    ringkas: {
      totalSubject: courses.length,
      totalMateri: semuaMateri.length,
      pesertaUnik: pesertaUnik.size,
      // Rata-rata ketuntasan ditimbang per SUBJECT, bukan per orang: yang
      // ditanyakan "seberapa jalan pelatihan kita", dan subject kecil yang
      // tuntas sama berartinya dengan subject besar yang tuntas.
      avgCompletion: perSubject.length ? Math.round(perSubject.reduce((a, s) => a + s.completion, 0) / perSubject.length) : 0,
      materiBerkuis: semuaMateri.filter((id) => berkuis.has(id)).length,
      totalAttempt: hasil.length,
      avgScore: rata(nilaiSemua) ?? 0,
    },
    perSubject,
    perUser,
  };
}
