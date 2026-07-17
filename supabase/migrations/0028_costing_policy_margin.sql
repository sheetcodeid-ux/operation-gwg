-- Settable selling-price margin bands per category (drives the price
-- suggestions), separate from the food-cost health target. Food margin min/max
-- and Beverage margin min/max, as percentages. Defaults: food 35–50%,
-- beverage 60–100% (per owner decision, MoM update).
alter table costing_policy add column if not exists food_margin_min numeric not null default 35;
alter table costing_policy add column if not exists food_margin_max numeric not null default 50;
alter table costing_policy add column if not exists bev_margin_min numeric not null default 60;
alter table costing_policy add column if not exists bev_margin_max numeric not null default 100;
