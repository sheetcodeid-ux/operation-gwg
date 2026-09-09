-- Net sales PER MINGGU per cabang, langsung dari ESB.
--
-- KENAPA TABEL SENDIRI, BUKAN MENJUMLAHKAN `seasonal_daily`. Data harian per
-- cabang memang ada, tapi diisi satu hari satu panggilan ESB: sebulan berarti
-- 30 panggilan per cabang, 60 cabang berarti 1.800 panggilan sebulan. Itu
-- persis biaya yang dihindari migrasi 0074 saat angka bulanan dipindahkan dari
-- penjumlahan harian ke satu panggilan berentang. Akibatnya `seasonal_daily`
-- diisi bergiliran satu cabang per jalannya cron dan selalu tertinggal —
-- September ini baru 32 dari 60 cabang. Tabel per minggu yang berdiri di
-- atasnya akan menampilkan puluhan outlet berangka nol padahal outletnya
-- berjualan, dan nol yang berarti "belum ditarik" adalah kesalahan yang paling
-- mahal di halaman KPI: ia terbaca sebagai outlet yang gagal.
--
-- ESB menerima RENTANG tanggal, jadi satu minggu = satu panggilan. Sebulan
-- berarti 5 panggilan per cabang, 60 cabang = 300 panggilan sebulan — seperlima
-- dari jalur harian, dan minggu yang sudah lewat cukup ditarik sekali.
--
-- `sampai` menyimpan tanggal terakhir yang ikut terhitung: minggu berjalan
-- belum penuh, dan yang membacanya harus tahu angkanya sampai kapan supaya
-- minggu yang baru dua hari tidak dibandingkan dengan minggu tujuh hari.
create table if not exists public.esb_net_mingguan (
  branch      text        not null,
  periode     text        not null check (periode ~ '^\d{4}-\d{2}$'),
  minggu      smallint    not null check (minggu between 1 and 5),
  net         numeric     not null default 0,
  bills       integer,
  pax         integer,
  -- Tanggal awal minggu ini — disimpan supaya rentangnya terbaca tanpa perlu
  -- menghitung ulang pembagian minggunya di sisi pembaca.
  dari        date        not null,
  sampai      date        not null,
  synced_at   timestamptz not null default now(),
  primary key (branch, periode, minggu)
);

comment on table public.esb_net_mingguan is 'Net sales per minggu per cabang ESB — satu panggilan per cabang per minggu.';
comment on column public.esb_net_mingguan.minggu is 'Minggu ke-N dalam bulan: 1-7, 8-14, 15-21, 22-28, sisanya. Tanggal, bukan Senin-Minggu, supaya minggu ke-N sebanding antarbulan.';
comment on column public.esb_net_mingguan.sampai is 'Tanggal terakhir yang ikut terhitung; minggu berjalan belum penuh.';

alter table public.esb_net_mingguan enable row level security;

-- Pembacanya selalu satu periode sekaligus untuk seluruh cabang.
create index if not exists esb_net_mingguan_periode_idx on public.esb_net_mingguan (periode);
