-- Reusable overhead (biaya tetap) templates so a team can save a common set of
-- overhead line-items (BTKL, sewa alat, gas, listrik, air, …) and apply it to a
-- new HPP calculation without re-typing. Applying only fills the form — the
-- values stay editable afterwards (data is not locked).
--
-- Each item carries a `kind` so the template preserves the Fixed vs
-- Variable/Operational split: [{ "name": "Listrik", "monthly": 500000, "kind": "variable" }].
create table if not exists overhead_template (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  brand text,                                   -- optional scope hint (informational)
  items jsonb not null default '[]'::jsonb,     -- [{ name, monthly, kind }]
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Service-role only (RLS enabled, no policies) — same posture as the other HPP
-- tables; all access goes through server actions with an app-side role gate.
alter table overhead_template enable row level security;
