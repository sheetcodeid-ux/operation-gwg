-- Operation GWG — HPP brand + F&B verification workflow
--
-- brand        : Nordu | Cattu | Busari (drives margin bands & class pricing).
-- status       : draft → submitted → verified | rejected. R&D drafts & submits,
--                tim F&B verifies/rejects before a calculation is final (per makalah:
--                "finalisasi data melalui screening tim F&B").
-- review_note  : F&B note when verifying/rejecting.
-- reviewed_by  : user id of the F&B reviewer.
-- reviewed_at  : timestamp of the review decision.
-- Additive & defaulted so existing rows keep working (become 'Nordu' / 'draft').

alter table public.hpp_calculations
  add column if not exists brand text not null default 'Nordu',
  add column if not exists status text not null default 'draft',
  add column if not exists review_note text,
  add column if not exists reviewed_by text,
  add column if not exists reviewed_at timestamptz;

create index if not exists idx_hpp_status on public.hpp_calculations (status);
