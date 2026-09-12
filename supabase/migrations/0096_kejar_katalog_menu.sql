-- Jadwal KEJAR sementara untuk mengisi ulang katalog menu ESB.
--
-- Katalog baru saja dikosongkan dan harus dibaca ulang ratusan halaman.
-- Jadwal normalnya dua kali sehari, jadi tanpa ini pengisiannya makan
-- berhari-hari.
--
-- Perintahnya DISALIN dari job yang sudah ada, bukan ditulis ulang: tokennya
-- ikut tersalin di dalam basis data tanpa pernah keluar ke mana pun.
--
-- Dua menit, bukan lebih rapat: satu jalannya cron dibatasi 60 detik oleh
-- Vercel, jadi jarak dua menit menjamin dua penarikan tidak pernah tumpang
-- tindih. ESB melayani satu ekspor per sesi — dua panggilan berbarengan
-- membuatnya mengembalikan berkas yang salah, dan itu pernah terjadi.
--
-- Dihapus lagi begitu katalognya penuh.
select cron.unschedule('esb-menu-kejar') where exists (select 1 from cron.job where jobname = 'esb-menu-kejar');
select cron.schedule('esb-menu-kejar', '*/2 * * * *', (select command from cron.job where jobname = 'esb-menu-sync-hourly'));
