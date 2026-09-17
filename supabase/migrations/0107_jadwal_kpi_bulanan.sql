-- Operational V.1 · TASK #85 — penjadwalan penulisan KPI bulanan.
--
-- Tanpa jadwal, `kpi_values` hanya terisi saat ada yang memanggil rutenya
-- dengan tangan — dan itulah keadaan sepanjang Phase 2A sampai 2C: 1.118 baris
-- Agustus seluruhnya ditulis lewat migrasi tangan, dan September tidak akan
-- pernah terisi sendiri.
--
-- MEMAKAI pg_cron SUPABASE, BUKAN CRON VERCEL. Bukan selera: pg_cron sudah jadi
-- penjadwal primer project ini (empat job aktif), tidak punya batas jumlah job,
-- dan `vercel.json` sudah berisi dua cron harian — bentuk yang persis sama
-- dengan batas plan Hobby. Menambah yang ketiga di sana berisiko ditolak saat
-- deploy, dan menukar penjadwal yang sudah bekerja dengan yang belum tentu
-- diterima bukan pertukaran yang masuk akal.
--
-- Perintahnya DITURUNKAN dari jadwal yang sudah ada, bukan diketik ulang:
-- tokennya tidak pernah muncul di berkas mana pun, termasuk berkas ini. Pola
-- yang sama dipakai `0075_jadwal_net_bulanan.sql` dan `0096_kejar_katalog_menu.sql`.
--
-- ┌─ KENAPA HARIAN, DAN KENAPA PUKUL SEGITU ─────────────────────────────────┐
-- │                                                                          │
-- │ KPI bulanan tidak berubah lebih cepat dari sehari sekali: `hariBerjalan`  │
-- │ dan `kelengkapanPersen` keduanya bergerak per hari WIB, dan identitas     │
-- │ berbasis isi membuat jalan kedua di hari yang sama jadi no-op. Menjalankan │
-- │ tiap jam cuma menghasilkan 23 no-op sehari.                              │
-- │                                                                          │
-- │ 22.15 UTC = 05.15 WIB. Sesudah tengah malam WIB, jadi hari kemarin sudah  │
-- │ utuh; dan menit ke-15 tidak dipakai jadwal lain (7, 23, 37, dan tiap 10   │
-- │ menit), supaya tidak berangkat bersamaan dengan penarikan ESB.            │
-- └──────────────────────────────────────────────────────────────────────────┘

select cron.schedule(
  'kpi-bulanan-harian',
  '15 22 * * *',
  (select replace(command, '/api/cron/fraud-sync?token=', '/api/cron/kpi-bulanan?token=')
     from cron.job where jobid = 1)
);
