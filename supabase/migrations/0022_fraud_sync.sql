-- Fraud (void/cancel/delete) order cache synced from ESB.
--
-- `fraud_orders` stores every ESB line-item per day so reports read from the
-- DB instantly; `fraud_sync` tracks which (kind, day) buckets are synced and
-- whether the read was complete. kind: 'cv' = Cancel/Void export, 'delete' =
-- Delete Order export. Service-role only (RLS on, no policies).

create table if not exists fraud_orders (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('cv', 'delete')),
  day date not null,
  branch text not null default '',
  sales_number text not null default '',
  menu text not null default '',
  menu_category text not null default '',
  order_by text not null default '',
  order_time text not null default '',
  void_by text not null default '',
  void_time text not null default '',
  type text not null default '',
  notes text not null default '',
  qty numeric not null default 0,
  total numeric not null default 0
);

create index if not exists fraud_orders_kind_day on fraud_orders (kind, day);

alter table fraud_orders enable row level security;

create table if not exists fraud_sync (
  kind text not null check (kind in ('cv', 'delete')),
  day date not null,
  total_items integer not null default 0,
  rows_read integer not null default 0,
  complete boolean not null default false,
  synced_at timestamptz not null default now(),
  primary key (kind, day)
);

alter table fraud_sync enable row level security;
