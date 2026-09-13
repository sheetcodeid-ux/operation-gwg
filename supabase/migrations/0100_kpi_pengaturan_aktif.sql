-- Indikator bisa dinonaktifkan tanpa menghapusnya.
--
-- Kebijakan KPI berubah: satu indikator berhenti dipakai satu periode, lalu
-- dipakai lagi. Menghapusnya dari kode berarti riwayat bulan-bulan sebelumnya
-- kehilangan barisnya, dan angka yang pernah dinilai tidak bisa dibaca ulang.
-- Ditandai nonaktif, definisinya tetap ada dan riwayatnya tetap utuh.
--
-- Bawaannya AKTIF: baris pengaturan yang sudah ada dibuat sebelum kolom ini
-- ada, dan indikator yang selama ini terpakai tidak boleh tiba-tiba hilang
-- dari penilaian hanya karena kolomnya baru ditambahkan.
--
-- Yang boleh mengubahnya hanya super admin — dijaga di aksi servernya, bukan
-- hanya dengan menyembunyikan tombolnya.
alter table public.kpi_pengaturan
  add column if not exists aktif boolean not null default true;
