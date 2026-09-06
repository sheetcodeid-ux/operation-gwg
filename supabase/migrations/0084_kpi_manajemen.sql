-- Isian tangan KPI Manajemen, satu baris per bulan.
--
-- Tiga dari empat komponennya sudah punya sumbernya sendiri di aplikasi ini:
-- omzet korporat dan penjualan per outlet dari ESB, laba bersih dari isian
-- Coordinator Area. Yang TIDAK punya sumber adalah nilai KPI tiap divisi —
-- sebagian divisi (HR, Warehouse) belum punya modul KPI-nya sendiri, jadi
-- angkanya diketik.
--
-- `sales_manual` mengesampingkan total actual same store sebagai dasar margin
-- EBITDA; kosong berarti memakai totalnya, yang jadi perilaku bawaan.
create table if not exists kpi_manajemen (
  periode text primary key,
  divisi jsonb not null default '[]'::jsonb,
  laba_bersih numeric,
  sales_manual numeric,
  catatan text,
  diubah_oleh text,
  diubah_nama text,
  diubah_pada timestamptz not null default now()
);

comment on table kpi_manajemen is
  'Isian tangan Kalkulator KPI Manajemen per bulan: nilai KPI tiap divisi dan pengesampingan angka EBITDA.';
comment on column kpi_manajemen.divisi is
  'Daftar [{nama, nilai}] nilai KPI divisi, skala 0-100.';
comment on column kpi_manajemen.sales_manual is
  'Pengganti total actual same store sebagai dasar margin EBITDA. Kosong = pakai total same store.';

alter table kpi_manajemen enable row level security;
