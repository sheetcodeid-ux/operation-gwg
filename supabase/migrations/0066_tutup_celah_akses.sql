-- Dua sisa hak akses yang tidak pernah dipakai aplikasi ini.
--
-- Seluruh pembacaan dan penulisan berjalan lewat lapisan server yang memakai
-- service role; peran `anon` dan `authenticated` sama sekali tidak punya hak
-- atas tabel mana pun di schema public. Dua hal berikut luput dari pembersihan
-- itu, dan keduanya ditutup di sini.

-- 1. Fungsi yang masih bisa dipanggil lewat RPC dengan kunci anon.
--
-- Ketiganya SECURITY INVOKER, jadi badannya berjalan sebagai pemanggil — dan
-- pemanggil anon tidak punya hak baca tabel apa pun, sehingga tidak ada data
-- yang benar-benar keluar hari ini. Yang dicabut adalah PERMUKAANNYA: hak yang
-- tidak dipakai siapa pun hanya menunggu satu perubahan lain membuatnya
-- berarti, dan perubahan itu biasanya tidak disadari saat dilakukan.
revoke execute on function public.fraud_agg(text, date, date, text, boolean) from anon, authenticated;
revoke execute on function public.fraud_top_orders(text, date, date, text, integer) from anon, authenticated;
revoke execute on function public.assessment_block_insert_guard() from anon, authenticated;

-- 2. Bucket foto Hygiene yang berstatus publik.
--
-- Kodenya sudah menandatangani URL sejak awal — komentarnya bahkan menyebut
-- "bucket is private" — tapi buckets-nya sendiri tidak pernah diubah. Selama
-- publik, siapa pun yang mengetahui path sebuah objek bisa mengambil foto
-- audit outlet tanpa masuk sama sekali.
--
-- Aman diubah: dari 2.485 audit, TIDAK ADA satu pun yang menyimpan URL publik;
-- 25 yang berlampiran foto semuanya memakai URL bertanda tangan, dan tanda
-- tangan tetap berlaku pada bucket privat.
update storage.buckets set public = false where id = 'hygiene-photos';
