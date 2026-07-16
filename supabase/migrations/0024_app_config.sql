-- Small key/value store for server-side configuration (e.g. the internal cron
-- token that lets the Supabase pg_cron scheduler call the app's sync endpoint
-- without any manual env setup). Service-role only (RLS on, no policies).

create table if not exists app_config (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table app_config enable row level security;
