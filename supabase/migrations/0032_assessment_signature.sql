-- Signatures (TTD) for assessment signatories — HC, Director, and division Heads.
-- Keyed by the signatory's User Management account. `image` is a data URL of the
-- uploaded signature; `name` overrides the printed name (defaults to the account
-- name). Used to auto-fill the signature blocks on the PDF report.
create table if not exists public.assessment_signature (
  user_id    text primary key,
  name       text,
  image      text,
  updated_at timestamptz not null default now()
);

alter table public.assessment_signature enable row level security;
