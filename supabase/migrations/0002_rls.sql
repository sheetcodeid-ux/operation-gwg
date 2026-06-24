-- Operation GWG — Row Level Security (Phase 11)
-- Mirrors src/lib/rbac.ts scoping at the database layer.

-- ---------------- helper functions ----------------
create or replace function auth_role()
returns role language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function auth_area()
returns uuid language sql stable security definer set search_path = public as $$
  select area_id from profiles where id = auth.uid();
$$;

create or replace function auth_outlets()
returns uuid[] language sql stable security definer set search_path = public as $$
  select outlet_ids from profiles where id = auth.uid();
$$;

create or replace function is_global()
returns boolean language sql stable security definer set search_path = public as $$
  select auth_role() in ('super_admin','director','head_operation');
$$;

-- True when the current user may READ data for the given outlet.
create or replace function can_read_outlet(o uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare a uuid; begin
  if is_global() then return true; end if;
  if auth_role() = 'area_coordinator' then
    select area_id into a from outlets where id = o;
    return a = auth_area();
  end if;
  return o = any (auth_outlets());
end; $$;

-- True when the current user may WRITE operational data for the given outlet.
create or replace function can_write_outlet(o uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare a uuid; begin
  if auth_role() = 'super_admin' then return true; end if;
  if auth_role() = 'area_coordinator' then
    select area_id into a from outlets where id = o;
    return a = auth_area();
  end if;
  return false;
end; $$;

-- ---------------- enable RLS ----------------
alter table profiles enable row level security;
alter table areas enable row level security;
alter table outlets enable row level security;
alter table hospitality_assessments enable row level security;
alter table work_tasks enable row level security;
alter table ops_events enable row level security;
alter table hygiene_audits enable row level security;
alter table complaints enable row level security;
alter table notifications enable row level security;
alter table audit_logs enable row level security;

-- ---------------- profiles ----------------
create policy "profiles self read" on profiles for select using (id = auth.uid() or is_global());
create policy "profiles admin manage" on profiles for all
  using (auth_role() = 'super_admin') with check (auth_role() = 'super_admin');

-- ---------------- org (read-all; super admin writes) ----------------
create policy "areas read" on areas for select using (true);
create policy "areas manage" on areas for all
  using (auth_role() = 'super_admin') with check (auth_role() = 'super_admin');

create policy "outlets read" on outlets for select using (is_global() or can_read_outlet(id));
create policy "outlets manage" on outlets for all
  using (auth_role() = 'super_admin') with check (auth_role() = 'super_admin');

-- ---------------- operational data: read scoped, write scoped ----------------
create policy "hosp read" on hospitality_assessments for select using (can_read_outlet(outlet_id));
create policy "hosp write" on hospitality_assessments for insert with check (can_write_outlet(outlet_id));

create policy "tasks read" on work_tasks for select using (can_read_outlet(outlet_id));
create policy "tasks write" on work_tasks for insert with check (can_write_outlet(outlet_id));
create policy "tasks update" on work_tasks for update using (can_write_outlet(outlet_id));

create policy "events read" on ops_events for select using (can_read_outlet(outlet_id));
create policy "events write" on ops_events for insert with check (can_write_outlet(outlet_id));

create policy "hyg read" on hygiene_audits for select using (can_read_outlet(outlet_id));
create policy "hyg write" on hygiene_audits for insert with check (can_write_outlet(outlet_id));

create policy "comp read" on complaints for select using (can_read_outlet(outlet_id));
create policy "comp write" on complaints for insert with check (can_write_outlet(outlet_id));
create policy "comp update" on complaints for update using (can_write_outlet(outlet_id));

create policy "notif read" on notifications for select
  using (outlet_id is null or can_read_outlet(outlet_id));

create policy "audit read" on audit_logs for select using (is_global());
