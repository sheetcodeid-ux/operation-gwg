-- Bulan-bulan yang angka ESB-nya diabaikan untuk satu outlet.
--
-- `esb_mulai` hanya bisa menyatakan SATU GARIS BATAS: sebelum bulan itu ESB
-- diabaikan, sesudahnya dipercaya. Bentuk itu pas untuk outlet pindahan POS
-- (Busari, Nordu Coffee Siantan) yang riwayat sebelum migrasinya memang tidak
-- ada.
--
-- Nordu Landak bentuknya berbeda: angkanya wajar pada Mei (221 juta) dan
-- Agustus (300 juta), tapi Juni dan Juli terisi belasan juta yang bukan
-- omsetnya. Yang salah CELAH DI TENGAH, bukan awalan — dan menandainya dengan
-- `esb_mulai` akan ikut membuang Mei beserta seluruh bulan sebelumnya yang
-- angkanya benar.
--
-- Kolom ini menyebut bulannya satu per satu. Bulan yang tidak disebut tetap
-- otomatis dari ESB.
alter table outlets add column if not exists esb_abaikan text[];

comment on column outlets.esb_abaikan is
  'Daftar bulan "YYYY-MM" yang angka ESB-nya diabaikan; penjualannya diisi tangan. Bulan lain tetap dari ESB.';

update outlets set esb_abaikan = array['2026-06','2026-07'] where name = 'Nordu Landak';
