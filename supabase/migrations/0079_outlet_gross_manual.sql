-- Penanda outlet yang penjualannya diisi tangan.
--
-- Tiga outlet pindah dari POS Majoo dan riwayatnya tidak ikut terbawa ke ESB.
-- Sebelumnya form isian menebak siapa mereka dari keadaan datanya — "belum
-- lolos aturan tiga bulan" — dan tebakan itu ikut menyeret outlet lain yang
-- kebetulan juga belum genap tiga bulan, misalnya saat bulan Januari dibuka.
-- Daftarnya jadi berubah-ubah tiap kali bulan diganti, dan yang mengisinya
-- tidak pernah tahu mana yang benar-benar perlu diisi.
--
-- Sekarang ditandai apa adanya. Kalau suatu saat ada outlet pindahan lain,
-- cukup tandai barisnya — tanpa mengubah kode.
alter table public.outlets add column if not exists gross_manual boolean not null default false;

comment on column public.outlets.gross_manual is
  'Penjualannya diisi tangan karena riwayatnya tidak ada di ESB (pindahan POS lain).';

update public.outlets
   set gross_manual = true
 where name in ('Nordu Coffee Siantan', 'Ayam Goreng Busari Siantan', 'Ayam Goreng Busari Serdam');
