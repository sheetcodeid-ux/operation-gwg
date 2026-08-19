-- Appraisal Review — sesi peninjauan hasil penilaian bersama atasan langsung.
--
-- Bukan pengganti dan bukan duplikat Request Intervensi, walau keduanya sempat
-- menempati baris menu yang sama. Bedanya jelas begitu ditulis berdampingan:
--
--   Appraisal Review  : sesi TERJADWAL, untuk sekelompok orang, di akhir
--                       periode penilaian, sebelum nilainya difinalisasi.
--   Request Intervensi: permintaan SESAAT, untuk satu orang, kapan pun
--                       kinerjanya terlihat turun.
--
-- Peserta disimpan sebagai teks bebas ("Seluruh Supervisor Outlet", "Staff
-- Manajemen") dan itu disengaja. Yang dijadwalkan memang KELOMPOK, bukan daftar
-- nama; memaksanya jadi relasi ke karyawan berarti setiap sesi harus memilih
-- seratus nama satu per satu, dan daftar itu langsung basi begitu ada yang
-- masuk atau keluar sebelum harinya tiba.
--
-- Tabel terpisah dari `hc_reviews`: satu sesi meninjau banyak penilaian
-- sekaligus, jadi menumpangkannya di sana berarti menyalin tanggal dan nama
-- reviewer yang sama ke puluhan baris — dan begitu jadwalnya bergeser, sebagian
-- salinannya pasti tertinggal.

create table if not exists public.hc_appraisal_sessions (
  id          text primary key,
  tanggal     date,
  peserta     text not null,
  reviewer    text,
  scope       text not null default 'manajemen',
  status      text not null default 'terjadwal',
  catatan     text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  text
);

-- Batasan ditaruh di basis data, bukan hanya di formulir: kiriman bisa datang
-- dari mana saja, dan batas yang cuma ada di layar bukan batas.
alter table public.hc_appraisal_sessions drop constraint if exists hc_appraisal_sessions_status_check;
alter table public.hc_appraisal_sessions
  add constraint hc_appraisal_sessions_status_check check (status in ('terjadwal', 'selesai', 'batal'));

alter table public.hc_appraisal_sessions drop constraint if exists hc_appraisal_sessions_scope_check;
alter table public.hc_appraisal_sessions
  add constraint hc_appraisal_sessions_scope_check check (scope in ('manajemen', 'outlet'));

create index if not exists hc_appraisal_sessions_tanggal_idx on public.hc_appraisal_sessions (tanggal desc);

-- Selaras dengan seluruh tabel lain: akses hanya lewat service role di server.
alter table public.hc_appraisal_sessions enable row level security;
