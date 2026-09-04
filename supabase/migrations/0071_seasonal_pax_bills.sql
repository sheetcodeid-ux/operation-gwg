-- Jumlah tamu dan jumlah struk harian dari Sales Dashboard ESB.
--
-- Average Transaction sebulan = total net sales dibagi total struk sebulan.
-- Merata-ratakan angka rata-rata harian memberi bobot yang sama kepada hari
-- sepi dan hari ramai, dan hasilnya selalu meleset dari angka di ESB.
--
-- Dibiarkan NULL untuk hari yang sudah terlanjur disinkron sebelum kolom ini
-- ada. NULL berarti "belum ditarik" — beda dengan nol, dan pembacaannya
-- memang mengabaikan hari yang masih NULL supaya tidak ada bulan yang
-- rata-ratanya dihitung dari separuh datanya.
alter table public.seasonal_daily
  add column if not exists pax integer,
  add column if not exists bills integer;

comment on column public.seasonal_daily.pax is 'PAX TOTAL harian dari ESB; NULL = belum ditarik.';
comment on column public.seasonal_daily.bills is 'NUMBER OF BILL harian dari ESB; NULL = belum ditarik.';
