-- Tanggal buka outlet — penentu aturan tiga bulan.
--
-- Sebelumnya "sudah tiga bulan" ditentukan ADA-TIDAKNYA penjualan pada tiga
-- bulan sebelumnya. Outlet yang buka 31 Mei punya penjualan di bulan Mei —
-- satu hari — dan Mei terhitung sebagai satu bulan penuh. Nordu Bakes Samarinda
-- lolos aturan tiga bulan padahal baru berjalan dua bulan satu hari.
--
-- Kosong berarti tanggalnya belum diketahui; aturan lama yang dipakai untuk
-- outlet itu. Menebak tanggal buka lebih buruk daripada tidak tahu.
alter table outlets add column if not exists buka_tanggal date;

comment on column outlets.buka_tanggal is
  'Tanggal buka outlet. Bulan buka hanya terhitung sebagai bulan berjalan bila tanggalnya <= 15.';

update outlets set buka_tanggal = '2026-05-31' where name = 'Nordu Bakes Samarinda';
