-- Kolom tambahan catatan KPI untuk dua posisi baru: Coordinator Software dan
-- Coordinator POS.
--
-- KENAPA KOLOM SENDIRI, BUKAN MENUMPANG KOLOM YANG ADA. `judul` sudah dipakai
-- sebagai keterangan bebas oleh tujuh jenis catatan lain, dan `nominal` sudah
-- berarti rupiah di Faktur Pajak dan Pelunasan. Menumpanginya berarti satu
-- kolom yang artinya berubah-ubah tergantung barisnya — dan laporan apa pun
-- yang dibuat di atasnya akan menjumlahkan hari dengan rupiah tanpa satu pun
-- peringatan.

-- Kategori pekerjaan: input menu baru, update harga, setting promo, membership.
alter table public.kpi_entri add column if not exists kategori text;

-- Tanggal selesai — hanya terisi pada catatan yang punya rentang pengerjaan
-- (SLA Menu & Promo Deployment). `tanggal` tetap tanggal mulainya.
alter table public.kpi_entri add column if not exists selesai date;

-- Berapa hari pengerjaannya melewati targetnya. Lebih dari nol menandai baris
-- ini sebagai pengurang poin, dan `gagal` ikut diisi supaya perhitungan yang
-- sudah ada tidak perlu tahu soal kolom baru ini.
alter table public.kpi_entri add column if not exists hari_lewat integer;

-- Catatan yang berlaku untuk SELURUH outlet sekaligus.
--
-- Dibedakan dari `outlet_id` yang kosong: kosong berarti catatan kantor yang
-- memang tidak menyangkut cabang mana pun, sedangkan ini berarti menyangkut
-- semuanya. Tanpa pembedaan itu, satu penyetelan promo se-perusahaan tercatat
-- sama persis dengan catatan yang lupa memilih outlet.
alter table public.kpi_entri add column if not exists semua_outlet boolean not null default false;
