-- Katalog menu ESB sudah terisi penuh: 1.004 menu, 1 Juni – 31 Agustus 2026.
--
-- Uji silangnya lolos dari dua arah:
--   ES KOPI SUSU ASTRO sebelum pajak  Rp    617.982.922  (Excel: 617.982.897)
--   Seluruh katalog, rata per bulan   Rp 13,50 miliar    (penjualan sebenarnya ± Rp 13 M)
-- Sebelum perbaikan, seluruh katalog berjumlah Rp 397 miliar untuk 30 hari.
--
-- Jadwal kejar tiap 2 menit dihapus; jadwal normal dua kali sehari dihidupkan.
select cron.unschedule('esb-menu-kejar');
select cron.alter_job(2, active := true);

-- Baris singgahan yatim — milik penarikan yang kursornya sudah hilang, jadi
-- tidak ada lagi yang tahu harus membersihkannya. Pencegahannya ada di kode:
-- tiap penarikan baru mengosongkan seluruh isi tabel singgahan lebih dulu.
delete from public.esb_menu_stage;
