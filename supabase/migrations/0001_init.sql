-- Operation GWG — schema (Phase 11)
-- Mirrors src/lib/types.ts. Run via Supabase CLI: `supabase db push`.

create extension if not exists "pgcrypto";

-- ---------------- enums ----------------
create type role as enum (
  'super_admin','director','head_operation','area_coordinator','supervisor','pic_outlet'
);
create type priority as enum ('critical','high','medium','low');
create type task_status as enum ('open','ongoing','pending','done','cancelled');
create type event_status as enum ('upcoming','running','finished','cancelled');
create type event_milestone as enum ('planning','preparation','execution','evaluation');
create type hygiene_rating as enum ('excellent','good','fair','poor');
create type complaint_source as enum ('google_review','instagram','whatsapp','email','walk_in');
create type complaint_category as enum (
  'cleanliness','service','product_quality','price','facilities','staff_attitude','waiting_time','others'
);
create type complaint_status as enum ('open','ongoing','pending','done','closed');
create type root_cause as enum ('man','method','material','machine','environment');
create type notification_kind as enum (
  'hygiene_overdue','complaint_overdue','task_overdue','event_deadline','score_drop'
);

-- ---------------- identity ----------------
-- profiles.id references auth.users.id (Supabase Auth)
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  email text not null unique,
  role role not null default 'pic_outlet',
  area_id uuid,
  outlet_ids uuid[] not null default '{}',
  avatar_url text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------- organization ----------------
create table areas (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  coordinator_id uuid references profiles (id) on delete set null
);

create table outlets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  city text not null,
  area_id uuid not null references areas (id) on delete cascade,
  supervisor_id uuid references profiles (id) on delete set null,
  pic_id uuid references profiles (id) on delete set null,
  active boolean not null default true
);

alter table profiles add constraint profiles_area_fk
  foreign key (area_id) references areas (id) on delete set null;

-- ---------------- module 2: hospitality ----------------
create table hospitality_assessments (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlets (id) on delete cascade,
  area_id uuid not null references areas (id) on delete cascade,
  assessor_id uuid references profiles (id) on delete set null,
  staff_name text not null,
  staff_position text not null,
  date timestamptz not null default now(),
  scores jsonb not null default '{}',
  notes text,
  overall_score numeric(5,1) not null default 0
);

-- ---------------- module 3: work tracker ----------------
create table work_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  category text not null,
  priority priority not null default 'medium',
  status task_status not null default 'open',
  outlet_id uuid not null references outlets (id) on delete cascade,
  area_id uuid not null references areas (id) on delete cascade,
  pic_id uuid references profiles (id) on delete set null,
  start_date timestamptz not null default now(),
  due_date timestamptz not null,
  completion_date timestamptz,
  progress int not null default 0 check (progress between 0 and 100),
  attachments jsonb not null default '[]',
  created_at timestamptz not null default now()
);

-- ---------------- module 4: events ----------------
create table ops_events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  outlet_id uuid not null references outlets (id) on delete cascade,
  area_id uuid not null references areas (id) on delete cascade,
  pic_id uuid references profiles (id) on delete set null,
  description text not null default '',
  budget bigint not null default 0,
  start_date timestamptz not null,
  end_date timestamptz not null,
  milestone event_milestone not null default 'planning',
  status event_status not null default 'upcoming',
  progress int not null default 0 check (progress between 0 and 100),
  created_at timestamptz not null default now()
);

-- ---------------- module 5: hygiene ----------------
create table hygiene_audits (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlets (id) on delete cascade,
  area_id uuid not null references areas (id) on delete cascade,
  date timestamptz not null default now(),
  shift text not null,
  inspector_name text not null,
  supervisor_name text not null,
  ratings jsonb not null default '{}',
  findings text[] not null default '{}',
  photos jsonb not null default '[]',
  is_clean boolean not null default false,
  hygiene_score numeric(5,1) not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------- module 6: complaints ----------------
create table complaints (
  id uuid primary key default gen_random_uuid(),
  source complaint_source not null,
  customer_name text not null default 'Anonymous',
  rating int check (rating between 1 and 5),
  content text not null,
  review_date timestamptz not null default now(),
  outlet_id uuid not null references outlets (id) on delete cascade,
  area_id uuid not null references areas (id) on delete cascade,
  category complaint_category not null,
  priority priority not null default 'medium',
  status complaint_status not null default 'open',
  root_cause root_cause,
  corrective_action jsonb,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

-- ---------------- notifications & audit ----------------
create table notifications (
  id uuid primary key default gen_random_uuid(),
  kind notification_kind not null,
  title text not null,
  message text not null,
  outlet_id uuid references outlets (id) on delete cascade,
  area_id uuid references areas (id) on delete cascade,
  severity text not null default 'info',
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles (id) on delete set null,
  action text not null,
  entity text not null,
  entity_id uuid,
  at timestamptz not null default now()
);

-- ---------------- indexes ----------------
create index on outlets (area_id);
create index on hospitality_assessments (outlet_id);
create index on work_tasks (outlet_id, status);
create index on ops_events (outlet_id, status);
create index on hygiene_audits (outlet_id);
create index on complaints (outlet_id, status);
create index on notifications (outlet_id, read);

-- ---------------- new-user trigger ----------------
-- Auto-create a profile row when a user signs up via Supabase Auth.
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)), new.email)
  on conflict (id) do nothing;
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
