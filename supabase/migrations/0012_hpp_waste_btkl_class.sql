-- Operation GWG — HPP makalah alignment: waste, BTKL, class
--
-- Bring saved calculations in line with the GWG HPP makalah (Juni 2026):
--   • waste_pct — waste normal (default 5%) applied to raw-material cost, part of
--     the HPP overhead step.
--   • btkl — Biaya Tenaga Kerja Langsung (kitchen/bar staff salary / month),
--     allocated per product like other fixed costs.
--   • use_class — Nordu class pricing (HPP identical, selling price +Rp5.000/class).
-- Additive & defaulted so existing rows keep working.

alter table public.hpp_calculations
  add column if not exists waste_pct numeric not null default 5,
  add column if not exists btkl numeric not null default 0,
  add column if not exists use_class boolean not null default false;
