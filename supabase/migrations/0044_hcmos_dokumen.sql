-- Pusat Dokumen HC — satu tabel untuk seluruh dokumen tertulis Human Capital.
--
-- SOP muncul di kesembilan pilar, dan di sampingnya ada Kebijakan, Culture &
-- Value, dokumen kepatuhan, serta PKS Kemitraan. Bentuknya sama persis: judul,
-- pemilik, isi/tautan, versi, masa berlaku. Membuat sembilan tabel SOP yang
-- identik hanya karena pilarnya berbeda berarti sembilan tempat yang harus
-- diubah setiap kali bentuk dokumennya berkembang.
create table if not exists public.hc_documents (
  id uuid primary key default gen_random_uuid(),
  jenis text not null check (jenis in ('sop', 'kebijakan', 'culture', 'compliance', 'pks')),
  -- Slug pilar (lihat src/lib/hcmos/pillars.ts). NULL untuk dokumen lintas pilar.
  pilar text,
  judul text not null,
  ringkasan text,
  isi text,
  tautan text,
  versi text,
  pemilik text,
  -- Hanya dipakai PKS & dokumen kepatuhan yang punya masa berlaku.
  berlaku_mulai date,
  berlaku_sampai date,
  pihak text,
  status text not null default 'aktif' check (status in ('draf', 'aktif', 'arsip')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text
);

create index if not exists hc_documents_jenis_idx on public.hc_documents (jenis, pilar);
create index if not exists hc_documents_berlaku_idx on public.hc_documents (berlaku_sampai)
  where berlaku_sampai is not null;

alter table public.hc_documents enable row level security;

comment on table public.hc_documents is
  'HC-MOS Pusat Dokumen: SOP tiap pilar, Kebijakan, Culture & Value, dokumen kepatuhan, dan PKS Kemitraan.';
