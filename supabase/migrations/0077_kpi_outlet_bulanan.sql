-- Angka bulanan per OUTLET yang diisi tangan — bahan KPI Coordinator Area.
--
-- Tiga hal disimpan bersama karena ketiganya diisi orang yang sama, untuk
-- outlet yang sama, pada bulan yang sama:
--
--  • `gross`      — HANYA untuk outlet yang penjualannya tidak ada di ESB.
--                   Nordu Siantan dan dua Ayam Goreng Busari pindah dari POS
--                   Majoo, jadi riwayatnya tidak ikut terbawa: tanpa isian ini
--                   ketiganya terbaca seperti outlet yang baru buka, lalu
--                   tersingkir dari KPI oleh aturan tiga bulan. Yang dari ESB
--                   tidak pernah ditimpa — angka yang bisa diperdebatkan tidak
--                   boleh mengalahkan angka yang tidak bisa.
--  • `net_profit` — laba bersih outlet itu.
--  • `hpp`        — harga pokok penjualan dalam persen.
--
-- Kuncinya outlet + bulan, BUKAN outlet + bulan + orang. Satu area bisa
-- dipegang tiga Coordinator Area sekaligus; kalau angkanya menempel pada orang,
-- outlet yang sama akan punya tiga laba bersih yang berbeda dan tidak ada cara
-- memilih mana yang benar.
create table if not exists public.kpi_outlet_bulanan (
  outlet_id    text        not null,
  periode      text        not null check (periode ~ '^\d{4}-\d{2}$'),
  gross        numeric,
  net_profit   numeric,
  hpp          numeric,
  diubah_oleh  text,
  diubah_nama  text,
  diubah_pada  timestamptz not null default now(),
  primary key (outlet_id, periode)
);

comment on table public.kpi_outlet_bulanan is 'Angka bulanan per outlet yang diisi tangan untuk KPI Coordinator Area.';
comment on column public.kpi_outlet_bulanan.gross is 'Gross sales manual; dipakai HANYA bila ESB tidak punya angkanya.';
comment on column public.kpi_outlet_bulanan.hpp is 'Harga pokok penjualan dalam persen, mis. 37.5.';

alter table public.kpi_outlet_bulanan enable row level security;
