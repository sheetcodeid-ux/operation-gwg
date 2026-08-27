-- Peserta per subject E-Learning.
--
-- Sebelum ini tidak ada penugasan sama sekali: setiap Coordinator Area otomatis
-- jadi peserta SETIAP course. Untuk satu course itu benar; untuk kurikulum yang
-- mulai bercabang (Fast Start crew, orientasi manajemen, materi khusus satu
-- brand) itu berarti semua orang melihat semua hal, dan tidak ada satu pun
-- angka yang bisa menjawab "berapa persen yang WAJIB mengikuti sudah selesai" —
-- karena penyebutnya tidak pernah ditetapkan.
--
-- ATURAN KOSONG YANG DISENGAJA. Course TANPA satu pun baris di sini berarti
-- TERBUKA untuk semua peserta, persis seperti perilaku hari ini. Jadi tidak ada
-- backfill, tidak ada course lama yang mendadak kehilangan pesertanya, dan HC
-- bisa memindahkannya satu per satu kapan pun mereka siap. Begitu satu nama
-- ditambahkan, course itu berhenti terbuka dan hanya milik yang terdaftar.
--
-- Aturan itu hidup di `src/lib/data/elearning-peserta.ts` dan dikunci tesnya;
-- di sini ia hanya bisa dituliskan sebagai catatan.

create table if not exists public.elearning_participants (
  course_id   text not null references public.elearning_courses(id) on delete cascade,
  user_id     text not null,
  assigned_at timestamptz not null default now(),
  assigned_by text,
  primary key (course_id, user_id)
);

-- "Course apa saja yang jadi tugas saya" ditanyakan setiap kali seorang peserta
-- membuka Ruang Belajar; tanpa indeks ini ia memindai seluruh tabel.
create index if not exists elearning_participants_user_idx on public.elearning_participants (user_id);

alter table public.elearning_participants enable row level security;
