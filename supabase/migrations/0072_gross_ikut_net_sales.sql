-- Meluruskan tiga hari yang gross-nya memakai istilah ESB, bukan istilah GWG.
--
-- "Gross sales" di aplikasi ini adalah NET SALES di ESB — itu angka omset yang
-- dipakai sehari-hari, dan itulah isi kolom `gross` untuk seluruh 2.346 hari
-- lainnya. Tiga hari (29–31 Desember 2025, hasil pengisian manual 23 Juli)
-- terlanjur menyimpan gross versi ESB, yang sekitar 9% lebih tinggi karena
-- belum dipotong. Di grafik Musiman ketiganya tampil melonjak di ujung tahun
-- tanpa ada yang benar-benar naik.
--
-- Angka penggantinya bukan karangan: menarik ulang hari itu dari ESB hari ini
-- akan menuliskan net sales ke kolom gross — persis yang dikerjakan di sini,
-- tanpa perlu menunggu penarikan ulang yang memang tidak menjangkau tahun lalu.
update public.seasonal_daily
   set gross = net
 where gross <> net;
