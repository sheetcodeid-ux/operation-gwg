-- Operation GWG — Assessment roster & per-participant assignment (revisi Juli 2026)
--
-- Two settings, both sourced from User Management accounts, edited by HC/Admin:
--
--  1. assessment_roster       — which accounts take part & in what capacity.
--     `role` drives ACCESS (what the account sees when it opens Assessment):
--       karyawan  → peserta yang dinilai (3 tab: Panduan, Syarat & SA, Referensi)
--       head      → Atasan Langsung (Penilai 1) untuk divisinya
--       director  → akses penuh (lihat & putuskan), penilai posisi director-only
--       hc        → Human Capital, akses penuh + administrasi
--     Accounts NOT in the roster (and not assigned as a peer/atasan) have no
--     access — this fixes the old bug where any account fell back to full HR view.
--
--  2. assessment_assignments  — per peserta: siapa yang menilainya.
--       atasan_user_id  = Atasan Langsung (Penilai 1)
--       peer_user_ids   = hingga 5 Rekan Sejawat (Penilai 3, dirata-rata)
--
--  3. assessment_peer_reviews — satu baris per rekan sejawat per sesi. Skor
--     Penilai 3 = rata-rata review yang sudah disubmit.
--
-- RLS enabled with NO policies ⇒ service-role only; all access via server
-- actions (the browser never touches these tables directly).

create table if not exists public.assessment_roster (
  user_id             text primary key,
  role                text not null default 'karyawan',
  scope_department_id text,
  active              boolean not null default true,
  updated_at          timestamptz not null default now()
);

create table if not exists public.assessment_assignments (
  participant_user_id text primary key,
  atasan_user_id      text,
  peer_user_ids       jsonb not null default '[]'::jsonb,
  updated_at          timestamptz not null default now()
);

create table if not exists public.assessment_peer_reviews (
  session_id       text not null,
  reviewer_user_id text not null,
  scores           jsonb not null default '{}'::jsonb,
  note             text,
  submitted        boolean not null default false,
  submitted_at     timestamptz,
  updated_at       timestamptz not null default now(),
  primary key (session_id, reviewer_user_id)
);

create index if not exists idx_peer_reviews_session on public.assessment_peer_reviews(session_id);

alter table public.assessment_roster       enable row level security;
alter table public.assessment_assignments  enable row level security;
alter table public.assessment_peer_reviews enable row level security;
