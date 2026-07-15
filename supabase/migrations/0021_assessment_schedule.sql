-- Operation GWG — assessment window (jadwal mulai/selesai)
--
-- A single-row schedule for the grade-promotion assessment. Admin sets the
-- start/end datetime; while OPEN every Head-Office account (except supervisor)
-- may access the assessment. After the end time only Heads, Director and Legal
-- keep access (they run the interviews). Empty ⇒ always open (no window).
--
-- RLS enabled with NO policies ⇒ service-role only; all access via server
-- actions. Singleton enforced by a fixed id.

create table if not exists public.assessment_schedule (
  id         int primary key default 1,
  start_at   timestamptz,
  end_at     timestamptz,
  updated_at timestamptz not null default now(),
  constraint assessment_schedule_singleton check (id = 1)
);

alter table public.assessment_schedule enable row level security;
