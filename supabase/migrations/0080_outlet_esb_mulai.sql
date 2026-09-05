-- Sejak bulan berapa angka ESB satu outlet boleh dipercaya.
--
-- Tiga outlet pindahan POS Majoo punya angka di ESB untuk bulan-bulan SEBELUM
-- migrasinya, dan angka itu bukan penjualan mereka. Yang membuatnya berbahaya:
-- angkanya bukan nol dan bukan kosong, melainkan ratusan juta yang terlihat
-- sangat meyakinkan —
--
--   Ayam Goreng Busari Siantan  Jan 186 jt · Feb 163 jt · Mar 225 jt · Apr 180 jt
--   Nordu Coffee Siantan        Jan 186 jt · Feb  33 jt
--
-- Tidak ada satu pun tanda bahwa angka itu salah. Ia akan lolos aturan tiga
-- bulan, menjadi dasar target bulan berikutnya, dan ikut terhitung sebagai
-- capaian — untuk penjualan yang tidak pernah ada.
--
-- Sebelum bulan yang ditandai di sini, ESB diabaikan sepenuhnya dan yang
-- dipakai hanya isian tangan.
alter table public.outlets add column if not exists esb_mulai text
  check (esb_mulai is null or esb_mulai ~ '^\d{4}-\d{2}$');

comment on column public.outlets.esb_mulai is
  'Bulan pertama angka ESB outlet ini boleh dipercaya; sebelum itu ESB diabaikan.';

update public.outlets set esb_mulai = '2026-08'
 where name in ('Ayam Goreng Busari Serdam', 'Ayam Goreng Busari Siantan');

update public.outlets set esb_mulai = '2026-09'
 where name = 'Nordu Coffee Siantan';
