-- Operation GWG — admin-managed org structure (departments/divisions + employees)
--
-- Lets User Management add new departments/divisions and the people inside them.
-- These rows are MERGED on top of the built-in ORG_RAW hierarchy in
-- `src/lib/assessment/org.ts`, so they surface in the assessment employee
-- pickers (Departemen → Jabatan → Nama) on every page that reads the org.
--
-- Additive & zero-downtime: empty tables ⇒ behaviour identical to before.
-- RLS is enabled with NO policies, so only the service-role key (which bypasses
-- RLS) may read/write — matching the lockdown pattern of 0004. The browser never
-- touches these tables directly; all access goes through server actions.

create table if not exists public.org_departments (
  id         text primary key,
  name       text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.org_employees (
  id            text primary key,
  department_id text not null,
  jabatan       text not null,
  name          text not null,
  is_head       boolean not null default false,
  created_at    timestamptz not null default now()
);

-- No FK on department_id by design: cascade delete is done in the data layer
-- (deleteOrgDepartment removes employees before the department) so a partially
-- seeded org can't be blocked by referential order — matching the deployed schema.
create index if not exists idx_org_employees_dept on public.org_employees(department_id);

alter table public.org_departments enable row level security;
alter table public.org_employees   enable row level security;
