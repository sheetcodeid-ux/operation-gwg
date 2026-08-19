-- Self-Learning (LMS): satu materi punya beberapa TAHAP, bukan satu kuis.
--
-- Alurnya: Pre Test → Studi Kasus → Materi Utama → Post Test.
--
-- Sebelumnya satu materi hanya boleh punya SATU kuis (UNIQUE lesson_id), dan
-- kuis itu selalu berarti "ujian di akhir". Pre Test tidak bisa dititipkan ke
-- sana: ia harus dikerjakan SEBELUM materinya dibuka, dan angkanya baru berarti
-- kalau dibandingkan dengan Post Test setelahnya.
--
-- Kuis lama seluruhnya menjadi 'post'. Itu memang perannya selama ini — ujian
-- setelah materi — jadi tidak ada satu pun yang berpindah arti.

alter table public.elearning_quizzes
  add column if not exists fase text not null default 'post';

alter table public.elearning_quizzes drop constraint if exists elearning_quizzes_fase_check;
alter table public.elearning_quizzes
  add constraint elearning_quizzes_fase_check check (fase in ('pre', 'kasus', 'post'));

-- Satu materi kini boleh punya tiga kuis, tapi tetap hanya SATU per tahap.
alter table public.elearning_quizzes drop constraint if exists elearning_quizzes_lesson_id_key;
create unique index if not exists elearning_quizzes_lesson_fase_key
  on public.elearning_quizzes (lesson_id, fase);

-- Hasil ikut membawa tahapnya.
--
-- Bisa saja ditelusuri lewat quiz_id, tapi setiap tampilan hasil lalu wajib
-- menggabungkan dua tabel hanya untuk tahu ini Pre atau Post — termasuk saat
-- kuisnya sudah dihapus, yang membuat riwayat nilainya ikut kehilangan arti.
alter table public.elearning_quiz_results
  add column if not exists fase text not null default 'post';

alter table public.elearning_quiz_results drop constraint if exists elearning_quiz_results_fase_check;
alter table public.elearning_quiz_results
  add constraint elearning_quiz_results_fase_check check (fase in ('pre', 'kasus', 'post'));

update public.elearning_quiz_results r
   set fase = q.fase
  from public.elearning_quizzes q
 where q.id = r.quiz_id and r.fase is distinct from q.fase;

create index if not exists elearning_quiz_results_user_fase_idx
  on public.elearning_quiz_results (user_id, lesson_id, fase, attempt);
