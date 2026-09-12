-- Nilai penjualan menu disimpan SEBELUM PAJAK, dengan nilai kotornya dibawa
-- berdampingan.
--
-- Setelah katalog terisi ulang, angkanya dicocokkan dengan tarikan ESB milik
-- pemiliknya untuk Juni–Agustus 2026:
--
--   ESB Grand Total (termasuk pajak) : Rp 672.325.156
--   Sub total sebelum pajak          : Rp 617.982.922
--   Tarikan pemilik (Excel)          : Rp 617.982.897   ← selisih Rp 25
--
-- Jadi patokan yang dipakai perusahaan adalah angka SEBELUM PAJAK, dan itu
-- pula yang benar untuk indikator Keberhasilan Pasar: pembaginya net sales
-- ESB, yang juga sebelum pajak. Membandingkan penjualan menu bersama pajak
-- dengan omzet tanpa pajak akan menaikkan bagiannya ~9% tanpa satu menu pun
-- benar-benar terjual lebih banyak.
--
-- Selisih Rp 25 tadi murni pembulatan harga rata-rata; karena itu `amount`
-- kini diisi dari penjumlahan harga × qty per baris (tepat), bukan dari
-- perkalian ulang harga rata-rata.

-- Nilai kotor termasuk pajak — disimpan untuk penelusuran, bukan dipakai KPI.
alter table public.esb_menu add column if not exists amount_kotor numeric not null default 0;

-- Baris yang ada ditarik ulang lengkap oleh sinkronisasi berikutnya; dikosongkan
-- supaya tidak ada satu pun halaman yang menampilkan angka bercampur dua dasar.
truncate table public.esb_menu;
delete from public.app_config where key = 'esb_menu_cursor';
