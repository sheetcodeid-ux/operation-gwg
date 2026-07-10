-- Operation GWG — HPP (Harga Pokok Produksi) calculator storage
--
-- Saved cost calculations for the R&D division: variable-cost items, fixed-cost
-- allocation, chosen selling price & target profit, plus the derived HPP snapshot.
-- The raw item lists are stored as jsonb so the calculator can rehydrate a saved
-- draft exactly; the numeric snapshot columns (variable_cost, hpp) let history &
-- reports read totals without recomputation.
--
-- RLS is enabled with NO policies: the table is reachable only through the server
-- service-role client (same lockdown as every other table), never from the browser.

create table if not exists public.hpp_calculations (
  id            text primary key,
  name          text not null,
  image_url     text,
  mode          text not null default 'per_pcs',   -- per_pcs | per_resep
  alloc_mode    text not null default 'product',   -- product | even
  target_sales  integer not null default 0,
  variables     jsonb not null default '[]'::jsonb,
  fixed         jsonb not null default '[]'::jsonb,
  chosen_price  numeric not null default 0,
  target_profit numeric not null default 0,
  variable_cost numeric not null default 0,
  hpp           numeric not null default 0,
  created_by    text,
  created_at    timestamptz not null default now()
);

create index if not exists idx_hpp_created_at on public.hpp_calculations (created_at desc);

alter table public.hpp_calculations enable row level security;
