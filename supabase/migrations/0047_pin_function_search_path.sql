-- Mematok search_path ketiga fungsi basis data.
--
-- Tanpa patokan, nama tabel di dalam fungsi diselesaikan memakai search_path
-- milik PEMANGGIL. Siapa pun yang bisa membuat objek di schema lain berpeluang
-- menyisipkan tabel atau fungsi bernama sama, lalu fungsi ini membaca objek
-- yang salah tanpa ada tanda apa pun.
--
-- Ketiganya SECURITY INVOKER — berjalan dengan hak pemanggilnya sendiri — jadi
-- ini bukan jalan untuk menaikkan hak akses. Patokan ini menutup seluruh kelas
-- kejutan tersebut tanpa mengubah perilaku sedikit pun: 'public, pg_temp'
-- persis urutan yang memang sudah dipakai selama ini.
--
-- Terdeteksi oleh database linter Supabase (0011_function_search_path_mutable).

alter function public.assessment_block_insert_guard() set search_path = public, pg_temp;
alter function public.fraud_agg(text, date, date, text, boolean) set search_path = public, pg_temp;
alter function public.fraud_top_orders(text, date, date, text, integer) set search_path = public, pg_temp;
