-- Operation GWG — HPP master bahan baku (ingredient library)
--
-- Central ingredient list with the highest regional purchase price (per makalah:
-- "HPP dihitung berdasarkan harga tertinggi bahan baku di masing-masing wilayah").
-- The calculator can pick an ingredient from here so a price change propagates to
-- every menu that references it.
--   buy_price / buy_qty / buy_unit — purchase price for a quantity (e.g. Rp 120000 / 1 kg)
--   region                         — wilayah for the highest price
--   prev_price                     — buy_price before the last change (delta detection)
--   alert                          — true when the last change raised price >5% (update HPP)
-- RLS enabled with no policies: service-role (server) only, like every other table.

create table if not exists public.hpp_ingredients (
  id          text primary key,
  name        text not null,
  buy_price   numeric not null default 0,
  buy_qty     numeric not null default 1,
  buy_unit    text not null default 'kg',
  region      text,
  prev_price  numeric,
  alert       boolean not null default false,
  updated_by  text,
  updated_at  timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

create index if not exists idx_hpp_ingredients_name on public.hpp_ingredients (name);

alter table public.hpp_ingredients enable row level security;
