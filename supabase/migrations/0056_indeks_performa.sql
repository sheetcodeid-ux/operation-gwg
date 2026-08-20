-- Perapian indeks berdasarkan pengukuran, bukan tebakan.
--
-- Sumbernya `pg_stat_statements` selama 49 hari dan keluaran database linter
-- Supabase. Tiga jenis perbaikan, masing-masing dengan alasannya sendiri.

-- ── 1. Indeks gabungan untuk pembacaan Hygiene per periode ──────────────────
--
-- Halaman Hygiene menyaring `outlet_id IN (...)` lalu `date` dalam satu rentang,
-- lalu mengurutkan `date DESC`. Yang ada sekarang cuma indeks satu kolom pada
-- `outlet_id`, jadi Postgres menyaring lewat indeks tapi MENGURUTKAN manual —
-- 56,7 ms rata-rata untuk 4.163 panggilan.
--
-- Indeks gabungan ini melayani ketiganya sekaligus: penyaringan outlet,
-- pembatasan rentang tanggal, dan urutannya. Urutan kolomnya penting —
-- `outlet_id` lebih dulu karena ia disaring dengan kesamaan, `date` menyusul
-- karena ia dipakai untuk rentang dan pengurutan.
create index if not exists hygiene_outlet_date_idx
  on public.hygiene (outlet_id, date desc);

-- ── 2. Indeks yang menduplikasi indeks lain ─────────────────────────────────
--
-- Indeks bukan barang gratis: setiap INSERT dan UPDATE harus memperbaruinya,
-- dan indeks yang isinya sama persis dengan indeks lain menambah biaya tulis
-- tanpa pernah mempercepat satu pun pembacaan.
--
-- `tasks_work_request_idx` isinya (id) — persis sama dengan kunci utama
-- `tasks_pkey`. Postgres tidak akan pernah memilihnya.
drop index if exists public.tasks_work_request_idx;

-- `idx_notifications_target_user` isinya (target_user), sementara
-- `notifications_target_idx` sudah (target_user, dismissed, created_at DESC).
-- Kolom pertamanya sama, jadi indeks gabungan itu bisa melayani pencarian
-- berdasarkan target_user saja — yang satu kolom tidak menambah apa pun.
drop index if exists public.idx_notifications_target_user;

-- ── 3. Kunci asing tanpa indeks ─────────────────────────────────────────────
--
-- Delapan tabel HC punya `outlet_id` bertautan ke `outlets` tanpa indeks.
-- Tabelnya masih kecil hari ini sehingga belum terasa, dan itu justru alasan
-- mengerjakannya SEKARANG: menambah indeks pada tabel berisi puluhan baris
-- selesai seketika, pada tabel berisi ratusan ribu baris tidak.
--
-- Selain mempercepat penyaringan per outlet, indeks ini juga yang dipakai
-- Postgres saat memeriksa apakah sebuah outlet masih dirujuk ketika hendak
-- dihapus — tanpanya, pemeriksaan itu memindai seluruh tabel.
create index if not exists hc_benefits_outlet_idx         on public.hc_benefits (outlet_id);
create index if not exists hc_candidates_outlet_idx       on public.hc_candidates (outlet_id);
create index if not exists hc_cases_outlet_idx            on public.hc_cases (outlet_id);
create index if not exists hc_leaves_outlet_idx           on public.hc_leaves (outlet_id);
create index if not exists hc_onboarding_outlet_idx       on public.hc_onboarding (outlet_id);
create index if not exists hc_payroll_outlet_idx          on public.hc_payroll (outlet_id);
create index if not exists hc_reviews_outlet_idx          on public.hc_reviews (outlet_id);
create index if not exists hc_training_records_outlet_idx on public.hc_training_records (outlet_id);
