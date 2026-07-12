-- Operation — configurable thresholds (Juknis bab 6). Single-row JSON config.
create table if not exists public.op_settings (
  id         text primary key default 'default',
  data       jsonb not null default '{}',
  updated_at timestamptz not null default now()
);
alter table public.op_settings enable row level security;
