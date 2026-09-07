-- Bobot dan target KPI Manajemen adalah KEBIJAKAN, bukan data bulanan.
--
-- Sebelumnya keempat bobot, laju pertumbuhan, target margin, dan ambang umur
-- same store ditulis sebagai tetapan di dalam kode — mengubahnya berarti
-- menunggu deploy, dan sampai deploy itu terjadi angkanya tidak bisa
-- disesuaikan sama sekali. Disimpan satu baris karena berlaku untuk seluruh
-- bulan; riwayat perubahannya cukup dari kolom diubah_*.
create table if not exists kpi_manajemen_setelan (
  id text primary key default 'global',
  bobot_a numeric not null default 40,
  bobot_b numeric not null default 30,
  bobot_c numeric not null default 20,
  bobot_d numeric not null default 10,
  pertumbuhan numeric not null default 15,
  target_margin numeric not null default 30,
  ambang_ebitda numeric not null default 85,
  umur_same_store numeric not null default 3,
  diubah_oleh text,
  diubah_nama text,
  diubah_pada timestamptz,
  constraint kpi_manajemen_setelan_tunggal check (id = 'global')
);

insert into kpi_manajemen_setelan (id) values ('global') on conflict (id) do nothing;

alter table kpi_manajemen_setelan enable row level security;
