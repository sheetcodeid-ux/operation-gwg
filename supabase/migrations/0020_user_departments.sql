-- Operation GWG — User Management department/jabatan taxonomy
--
-- Backs the "Kelola Departemen & Jabatan" tool next to Add User. Admins define a
-- department (e.g. "Finance Accounting Tax") and the list of jabatan (job titles /
-- sub-teams) under it. These feed the Add User "Departement" + "Jabatan" comboboxes
-- so accounts can be placed in the GWG Head-Office org structure without touching
-- code. Kept SEPARATE from `org_departments`/`org_employees` (the assessment org,
-- which is employee-centric) so the two concerns never interfere.
--
-- Additive & zero-downtime: empty table ⇒ Add User falls back to the built-in
-- HO structure suggestions only. RLS enabled with NO policies ⇒ service-role only
-- (browser never queries it; all access goes through server actions), matching the
-- lockdown pattern of 0004.

create table if not exists public.user_departments (
  id         text primary key,          -- slug of name, e.g. dep_finance-accounting-tax
  name       text not null,
  jabatan    text[] not null default '{}', -- ordered list of job titles under this department
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_departments enable row level security;
