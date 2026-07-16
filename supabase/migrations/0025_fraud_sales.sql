-- Net-sales (omset) cache from ESB's dashboard highlight endpoint, used to
-- express fraud as a % of revenue.
--
-- sales_daily : all-outlet net sales per day (cron keeps the horizon filled).
-- sales_period: per-branch net sales for a requested [from,to] period, synced
--               on demand; periods that ended before synced_at are final.
-- Service-role only (RLS on, no policies).

create table if not exists sales_daily (
  day date primary key,
  net_sales numeric not null default 0,
  synced_at timestamptz not null default now()
);

alter table sales_daily enable row level security;

create table if not exists sales_period (
  branch text not null,
  date_from date not null,
  date_to date not null,
  net_sales numeric not null default 0,
  synced_at timestamptz not null default now(),
  primary key (branch, date_from, date_to)
);

alter table sales_period enable row level security;
