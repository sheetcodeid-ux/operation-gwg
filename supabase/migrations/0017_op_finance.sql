-- Operation — Beban Operasional & Pembelian (Finance input per outlet per month)
-- Wide format: one row per (month, outlet). RLS on, no policies = service-role only.

create table if not exists public.op_expenses (
  month         text not null,           -- YYYY-MM
  outlet_code   text not null,
  outlet_name   text not null default '',
  utilitas      numeric not null default 0,
  sewa          numeric not null default 0,
  tenaga_kerja  numeric not null default 0,
  potongan      numeric not null default 0,
  manajemen_fee numeric not null default 0,
  pemasaran     numeric not null default 0,
  ongkos_kirim  numeric not null default 0,
  lainnya       numeric not null default 0,
  updated_at    timestamptz not null default now(),
  primary key (month, outlet_code)
);
create index if not exists idx_op_expenses_month on public.op_expenses (month);
alter table public.op_expenses enable row level security;

create table if not exists public.op_purchases (
  month         text not null,           -- YYYY-MM
  outlet_code   text not null,
  outlet_name   text not null default '',
  warehouse     numeric not null default 0,
  non_warehouse numeric not null default 0,
  updated_at    timestamptz not null default now(),
  primary key (month, outlet_code)
);
create index if not exists idx_op_purchases_month on public.op_purchases (month);
alter table public.op_purchases enable row level security;
