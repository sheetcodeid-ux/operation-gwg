-- Net sales BULANAN per cabang, langsung dari ESB.
--
-- Sebelumnya angka bulanan per outlet dijumlahkan dari data harian
-- (`seasonal_daily`), dan itu memaksa 250 panggilan ESB per cabang — 57 cabang
-- berarti belasan ribu panggilan, berhari-hari, dan selama itu angkanya
-- separuh jadi. Padahal Management Fee dan Efisiensi tidak pernah butuh rincian
-- harian per outlet: yang dipakai totalnya sebulan.
--
-- Satu panggilan ESB dengan rentang satu bulan memberi angka itu utuh, jadi 57
-- cabang × 1 bulan = 57 panggilan, bukan 14.250. Tidak ada lagi bulan yang
-- "baru separuh" — barisnya ada berarti bulannya utuh.
create table if not exists public.esb_net_bulanan (
  branch      text        not null,
  periode     text        not null check (periode ~ '^\d{4}-\d{2}$'),
  net         numeric     not null default 0,
  bills       integer,
  pax         integer,
  -- Bulan berjalan masih bertambah tiap hari; tanggal terakhir yang ikut
  -- terhitung disimpan supaya yang membacanya tahu angkanya sampai kapan.
  sampai      date        not null,
  synced_at   timestamptz not null default now(),
  primary key (branch, periode)
);

comment on table public.esb_net_bulanan is 'Net sales sebulan per cabang ESB — satu panggilan per cabang per bulan.';
comment on column public.esb_net_bulanan.sampai is 'Tanggal terakhir yang ikut terhitung; untuk bulan berjalan ini kemarin/hari ini.';

alter table public.esb_net_bulanan enable row level security;

-- Sewa waktu untuk pekerjaan berat ESB.
--
-- ESB melayani satu sesi per akun, dan dua penarikan yang berjalan bersamaan
-- saling merebut sesi itu: yang kalah mendapat balasan yang tidak bisa
-- diuraikan, lalu hari itu dilewati diam-diam. Pernah terlihat sebagai
-- "ESB highlight: respons tidak terbaca" di tengah penarikan per cabang.
--
-- Pengambilannya SATU perintah UPDATE ber-syarat, bukan baca-lalu-tulis: dua
-- pemanggil yang datang bersamaan hanya satu yang mendapat barisnya, dan yang
-- lain menerima nol baris — tidak ada celah di antara membaca dan menulis.
create table if not exists public.esb_lock (
  name        text        primary key,
  lease_until timestamptz not null default now()
);

comment on table public.esb_lock is 'Satu sewa waktu untuk pekerjaan berat ESB — mencegah dua penarikan berjalan bersamaan.';

alter table public.esb_lock enable row level security;

insert into public.esb_lock (name, lease_until) values ('esb', now())
on conflict (name) do nothing;
