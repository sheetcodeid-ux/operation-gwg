-- Request Intervensi Kinerja.
--
-- Menggantikan "Appraisal Review", yang dihapus di Meeting Fitur HRD. Yang
-- dibutuhkan bukan sesi peninjauan terjadwal, melainkan JALUR MEMINTA
-- INTERVENSI saat kinerja seseorang turun.
--
-- Siapa yang meminta ditentukan oleh posisi orang yang bermasalah:
--
--   anggota tim bermasalah  -> head divisinya yang meminta
--   head divisi bermasalah  -> Owner yang meminta
--
-- Itulah sebabnya `peran_pemohon` disimpan terpisah dari `pemohon`. Nama saja
-- tidak cukup: yang menentukan bobot sebuah permintaan adalah dari lapis mana
-- ia datang, dan nama orang bisa berpindah jabatan sementara catatannya tidak.
--
-- Tabel terpisah dari `hc_reviews`, bukan kolom tambahan di sana. Penilaian
-- kinerja berjalan per periode untuk SEMUA orang; intervensi muncul sesekali
-- untuk SATU orang, dan biasanya di tengah periode. Menumpangkannya berarti
-- setiap baris penilaian membawa selusin kolom kosong yang hanya terisi pada
-- segelintir baris.

create table if not exists public.hc_interventions (
  id             text primary key,
  -- Yang diminta diintervensi.
  nama           text not null,
  jabatan        text,
  divisi         text,
  scope          text not null default 'manajemen',
  outlet_id      text,
  -- Yang meminta.
  pemohon        text not null,
  peran_pemohon  text not null default 'head',
  tanggal        date,
  -- Apa yang terlihat turun, dan seberapa mendesak.
  gejala         text,
  urgensi        text not null default 'normal',
  -- Tindakan Human Capital atas permintaan ini.
  tindakan       text,
  status         text not null default 'baru',
  catatan        text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Batasan ditaruh di basis data, bukan hanya di formulir: kiriman bisa datang
-- dari mana saja, dan batas yang cuma ada di layar bukan batas.
alter table public.hc_interventions drop constraint if exists hc_interventions_peran_check;
alter table public.hc_interventions
  add constraint hc_interventions_peran_check check (peran_pemohon in ('head', 'owner', 'hc'));

alter table public.hc_interventions drop constraint if exists hc_interventions_status_check;
alter table public.hc_interventions
  add constraint hc_interventions_status_check check (status in ('baru', 'diproses', 'selesai', 'ditutup'));

alter table public.hc_interventions drop constraint if exists hc_interventions_scope_check;
alter table public.hc_interventions
  add constraint hc_interventions_scope_check check (scope in ('manajemen', 'outlet'));

alter table public.hc_interventions drop constraint if exists hc_interventions_urgensi_check;
alter table public.hc_interventions
  add constraint hc_interventions_urgensi_check check (urgensi in ('urgent', 'normal', 'rendah'));

create index if not exists hc_interventions_tanggal_idx on public.hc_interventions (tanggal desc);
create index if not exists hc_interventions_status_idx on public.hc_interventions (status);

-- Selaras dengan seluruh tabel lain: akses hanya lewat service role di server.
alter table public.hc_interventions enable row level security;
