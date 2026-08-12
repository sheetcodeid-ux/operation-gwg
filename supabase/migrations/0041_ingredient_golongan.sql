-- Golongan bahan baku: Makanan / Minuman / General.
--
-- Master Bahan Baku memuat ratusan baris yang bercampur, padahal bisnisnya
-- menjual makanan DAN minuman: bahan dapur dan bahan bar tidak pernah dicari
-- bersamaan. Tanpa pemisah ini satu-satunya cara memfilter adalah mengetik
-- nama bahannya satu per satu.
--
-- `general` jadi bawaan karena banyak bahan memang dipakai keduanya (gula,
-- es batu, kemasan) — dan karena baris lama tidak boleh salah tergolong hanya
-- gara-gara kolomnya baru ditambahkan.
alter table public.hpp_ingredients
  add column if not exists golongan text not null default 'general';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'hpp_ingredients_golongan_check'
  ) then
    alter table public.hpp_ingredients
      add constraint hpp_ingredients_golongan_check
      check (golongan in ('makanan', 'minuman', 'general'));
  end if;
end $$;

-- Daftar hampir selalu dibaca per golongan lalu diurut nama.
create index if not exists hpp_ingredients_golongan_idx
  on public.hpp_ingredients (golongan, name);

comment on column public.hpp_ingredients.golongan is
  'Pemisah bahan: makanan (dapur), minuman (bar), atau general (dipakai keduanya).';
