-- ESB product catalog synced from Sales Menu Recapitulation (last 30 days):
-- distinct menu × its ESB unit price (pre-tax) + 30-day qty sold. Powers the
-- calculator product picker, target-sales recommendation, and the ESB-price
-- vs HPP comparison. Service-role only (RLS on, no policies).
create table if not exists esb_menu (
  menu text primary key,             -- menu name (natural key from ESB)
  menu_code text not null default '',
  category text not null default '',
  category_detail text not null default '',
  food_bev text not null default 'makanan',   -- 'makanan' | 'minuman'
  qty_30d numeric not null default 0,          -- total qty sold over the window
  unit_price numeric not null default 0,       -- ESB pre-tax unit price
  window_days integer not null default 30,
  synced_at timestamptz not null default now()
);

create index if not exists esb_menu_foodbev on esb_menu (food_bev);
alter table esb_menu enable row level security;
