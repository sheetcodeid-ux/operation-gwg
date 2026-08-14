-- HC-MOS — Rekrutmen & Onboarding.
--
-- Kandidat dan jadwal wawancara TIDAK dipisah jadi dua tabel: wawancara adalah
-- salah satu tahap yang dilalui kandidat yang sama. Dipisah, jadwal wawancara
-- akan punya salinan nama & posisi sendiri yang mulai berbeda begitu ada
-- koreksi di salah satunya.
create table if not exists public.hc_candidates (
  id uuid primary key default gen_random_uuid(),
  nama text not null,
  posisi text,
  scope text not null default 'manajemen' check (scope in ('manajemen', 'outlet')),
  outlet_id text references public.outlets (id) on delete set null,
  sumber text,
  telepon text,
  email text,
  tahap text not null default 'baru'
    check (tahap in ('baru', 'screening', 'interview', 'tawaran', 'diterima', 'ditolak')),
  jadwal_interview timestamptz,
  pewawancara text,
  catatan text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text
);

create index if not exists hc_candidates_tahap_idx on public.hc_candidates (tahap);
create index if not exists hc_candidates_jadwal_idx on public.hc_candidates (jadwal_interview)
  where jadwal_interview is not null;

-- Onboarding karyawan baru.
--
-- Butir checklist-nya disimpan sebagai peta "kunci butir → sudah/belum"
-- (`ceklis`), bukan satu baris per butir: daftar butirnya ditentukan program
-- (lihat src/lib/hcmos/rekrutmen.ts) dan berubah bersama programnya. Satu baris
-- per butir akan meninggalkan baris yatim setiap kali butirnya diganti.
create table if not exists public.hc_onboarding (
  id uuid primary key default gen_random_uuid(),
  nama text not null,
  posisi text,
  scope text not null default 'manajemen' check (scope in ('manajemen', 'outlet')),
  outlet_id text references public.outlets (id) on delete set null,
  tgl_mulai date,
  mentor text,
  ceklis jsonb not null default '{}'::jsonb,
  catatan text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text
);

create index if not exists hc_onboarding_mulai_idx on public.hc_onboarding (tgl_mulai desc);

alter table public.hc_candidates enable row level security;
alter table public.hc_onboarding enable row level security;

comment on table public.hc_candidates is
  'HC-MOS Rekrutmen: kandidat beserta tahap dan jadwal wawancaranya.';
comment on table public.hc_onboarding is
  'HC-MOS Onboarding: karyawan baru beserta ceklis orientasinya.';
