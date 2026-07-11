-- Operation GWG — actual sales synced from GWG Manage (gwgmanage.com)
--
-- Per-menu monthly performance pulled from the gwgmanage reports API
-- (/api/reports/menu-performance). Matched to HPP menus by name to show
-- "Aktual vs Proyeksi" (units sold & omzet vs the HPP projection).
-- RLS enabled with no policies: written only by the server (service-role).

create table if not exists public.hpp_sales (
  month         text not null,       -- YYYY-MM
  menu_name     text not null,
  category_name text,
  category      text,                -- contribution class (e.g. FAST & HIGH CONTRIBUTION)
  qty           numeric not null default 0,   -- units sold
  amount        numeric not null default 0,   -- revenue (Rp)
  volume        text,
  omzet         text,
  keterangan    text,
  synced_at     timestamptz not null default now(),
  primary key (month, menu_name)
);

create index if not exists idx_hpp_sales_month on public.hpp_sales (month);

alter table public.hpp_sales enable row level security;
