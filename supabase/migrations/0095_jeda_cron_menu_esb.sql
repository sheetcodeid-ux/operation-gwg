-- Cron penarik katalog menu ESB dijeda SEMENTARA sampai perbaikannya naik ke
-- produksi.
--
-- Kode lama menulis qty yang menumpuk tiap penarikan; membiarkannya jalan
-- setelah katalog dikosongkan hanya akan mengisinya ulang dengan angka yang
-- sama salahnya, dan yang membacanya tidak punya cara tahu bahwa angka itu
-- baru saja lahir dari bug yang sedang diperbaiki.
--
-- Dihidupkan lagi oleh migrasi berikutnya, setelah kode barunya live.
select cron.alter_job(2, active := false);
