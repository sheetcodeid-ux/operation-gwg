-- Operation GWG — admin-defined sidebar divisions (grup menu)
--
-- Lets User Management add new app divisions (sidebar groups) over EXISTING
-- menus, e.g. a "Marketing" division containing Reports + Complaints. Purely
-- additive: never alters built-in divisions, roles, menus or access rules.
-- Access to a custom division's menus is granted per-user via the existing
-- grants mechanism ("<Division>:<menuKey>"), so no new routes/roles are needed.
--
-- RLS enabled with NO policies ⇒ service-role only (browser never queries it),
-- matching the lockdown pattern of 0004. Empty table ⇒ sidebar identical to base.

create table if not exists public.org_divisions (
  id         text primary key,
  name       text not null,
  icon       text not null default 'Briefcase', -- lucide icon name (see NAV_ICONS)
  menus      text[] not null default '{}',       -- subset of NAV_MENUS keys
  created_at timestamptz not null default now()
);

alter table public.org_divisions enable row level security;
