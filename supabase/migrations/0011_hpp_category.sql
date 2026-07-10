-- Operation GWG — HPP product category
--
-- GWG sells both food (makanan) & drinks (minuman); the calculator now tags each
-- saved calculation with its category so history & reports can group by type.
-- Additive & nullable-safe: existing rows default to 'minuman'.

alter table public.hpp_calculations
  add column if not exists category text not null default 'minuman';
