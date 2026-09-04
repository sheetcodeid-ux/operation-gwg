-- Penarikan angka bulanan per cabang, terjadwal tiap jam.
--
-- Tanpa jadwal sendiri, tabel `esb_net_bulanan` hanya terisi saat ada yang
-- memanggilnya dengan tangan — dan angka bulan berjalan akan berhenti di
-- tanggal terakhir penarikan manual. Management Fee dan budget Efisiensi ikut
-- membeku di situ, tanpa satu pun tanda bahwa angkanya sudah basi.
--
-- Menit ke-23 dipilih supaya tidak berangkat bersamaan dengan jadwal lain
-- (menit ke-7 dan ke-37). Kalaupun bertabrakan, sewa waktu ESB yang membuat
-- salah satunya pulang dan mencoba lagi — tapi lebih baik tidak bertabrakan
-- sejak awal.
--
-- Perintahnya DITURUNKAN dari jadwal yang sudah ada, bukan diketik ulang:
-- tokennya tidak pernah muncul di berkas mana pun, termasuk berkas ini.
select cron.schedule(
  'esb-net-bulanan-hourly',
  '23 * * * *',
  (select replace(command, '?token=', '?job=net-bulanan&token=') from cron.job where jobid = 1)
);
