-- Costing policy: target food-cost % per category, with a company-wide default
-- ('default') and optional per-brand overrides (scope = brand name).
-- food_pct / bev_pct are the TARGET food cost (COGS ÷ selling price), e.g.
-- Food 35%, Beverage 25%. Service-role only (RLS on, no policies).
create table if not exists costing_policy (
  scope text primary key,          -- 'default' | 'Nordu' | 'Cattu' | 'Busari' | 'Lesung Pipi'
  food_pct numeric not null default 35,
  bev_pct numeric not null default 25,
  updated_at timestamptz not null default now()
);

alter table costing_policy enable row level security;

insert into costing_policy (scope, food_pct, bev_pct) values ('default', 35, 25)
on conflict (scope) do nothing;
