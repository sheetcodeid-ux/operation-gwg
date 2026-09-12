-- Katalog menu ESB: nilai penjualan YANG SEBENARNYA, dan penarikan yang tidak
-- bisa menggelembung.
--
-- DUA KESALAHAN YANG DIPERBAIKI DI SINI.
--
-- Pertama, angka penjualannya selama ini DIKARANG: qty × harga satuan. ESB
-- sudah mengirim Grand Total tiap barisnya dan pengurainya sudah membacanya,
-- tapi angkanya dibuang lalu dikira-kira ulang dari perkalian. Satu menu yang
-- terjual pada lebih dari satu harga — promo, ukuran berbeda, tingkat harga
-- outlet berbeda — tidak mungkin benar dengan cara itu, dan "harga satuan"
-- yang dipakai adalah harga terakhir yang kebetulan terbaca.
--
-- Kedua, qty-nya MENUMPUK tiap kali penarikan berjalan. Ekspornya 175 halaman
-- dan tidak selesai dalam satu jalannya cron, jadi halaman berikutnya menambah
-- ke baris yang sudah ada. Yang direset hanya menu yang kebetulan muncul di
-- halaman 0; sekitar 700 menu lainnya menambah satu jendela penuh setiap
-- ekspor baru. Pada 12 September 2026 jumlah seluruh katalog mencapai
-- Rp 397 miliar untuk jendela 30 hari — tiga puluh kali lipat penjualan
-- sebulan yang sebenarnya.
--
-- Obatnya: baris ditulis ke TABEL SINGGAHAN dulu, berkunci nomor halaman
-- ekspornya, dan baru dipindahkan ke katalog setelah seluruh halaman terbaca.
-- Halaman yang terbaca dua kali menimpa dirinya sendiri alih-alih menambah,
-- dan katalog tidak pernah berisi campuran dua ekspor.

-- Nilai penjualan sebenarnya (jumlah Grand Total), menggantikan perkalian.
alter table public.esb_menu add column if not exists amount numeric not null default 0;

-- Rentang tanggal ekspor yang menghasilkan baris ini. Disimpan supaya layar
-- bisa menyebut tanggalnya apa adanya — "30 hari terakhir" yang ditulis tangan
-- akan tetap tertulis 30 hari lama setelah jendelanya diubah.
alter table public.esb_menu add column if not exists periode_dari date;
alter table public.esb_menu add column if not exists periode_sampai date;

-- Tabel singgahan satu penarikan. Berkunci (run_id, page, menu): membaca ulang
-- satu halaman menimpa barisnya sendiri, bukan menambah.
create table if not exists public.esb_menu_stage (
  run_id          text not null,
  page            integer not null,
  menu            text not null,
  menu_code       text,
  category        text,
  category_detail text,
  qty             numeric not null default 0,
  amount          numeric not null default 0,
  -- Jumlah harga × qty, untuk menghitung rata-rata harga tertimbang saat
  -- dipindahkan. Rata-rata biasa memberi bobot sama kepada satu cangkir yang
  -- terjual di harga promo dan seribu cangkir di harga normal.
  harga_qty       numeric not null default 0,
  primary key (run_id, page, menu)
);

-- Baris singgahan milik penarikan yang sudah selesai tidak pernah dibaca lagi.
create index if not exists esb_menu_stage_run_idx on public.esb_menu_stage (run_id);

-- Data lama TIDAK bisa diselamatkan: qty-nya sudah bercampur entah berapa
-- ekspor dan tidak ada catatan berapa kali. Dikosongkan supaya tidak ada satu
-- pun halaman yang menampilkan angka lama sebagai kebenaran; penarikan
-- berikutnya mengisinya ulang dari ESB.
truncate table public.esb_menu;

-- Kursor ekspor lama ikut dibuang: bentuknya berubah, dan yang tersimpan
-- menunjuk ekspor 30 hari yang sudah tidak dipakai.
delete from public.app_config where key = 'esb_menu_cursor';
