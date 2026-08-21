-- Menyambungkan langkah terakhir alur Offboarding.
--
-- Alurnya berbunyi: Notifikasi → Exit Interview → Serah Terima Aset → Payroll
-- Final → Update Database Karyawan (Non-Aktif). Empat langkah pertama tercatat
-- di `hc_cases`; langkah kelima ada di dua tempat lain — `hc_contracts`
-- (tgl_resign) dan `users` (active) — dan TIDAK ADA yang menghubungkannya.
--
-- Akibatnya langkah yang paling menentukan justru yang paling mudah terlewat:
-- kalau petugas lupa, orang yang sudah keluar masih bisa masuk aplikasi, dan
-- tidak ada satu pun layar yang memberi tahu bahwa ada yang tertinggal.
--
-- Yang menghalangi penyambungan itu bukan kemauan, melainkan skema: `hc_cases`
-- hanya menyimpan NAMA. Mencocokkan orang berdasarkan nama berarti menonaktifkan
-- akun berdasarkan tebakan — dan salah tebak di sini artinya mengunci karyawan
-- yang masih bekerja. Karena itu ditambahkan penunjuk yang pasti.
alter table public.hc_cases add column if not exists user_id text;
alter table public.hc_cases add column if not exists kontrak_id uuid;

-- `on delete set null`, bukan cascade: menghapus akun tidak boleh ikut
-- menghapus riwayat perkaranya. Catatan offboarding justru sering dibutuhkan
-- setelah orangnya tidak ada lagi di sistem.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'hc_cases_user_fk') then
    alter table public.hc_cases
      add constraint hc_cases_user_fk foreign key (user_id) references public.users(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'hc_cases_kontrak_fk') then
    alter table public.hc_cases
      add constraint hc_cases_kontrak_fk foreign key (kontrak_id) references public.hc_contracts(id) on delete set null;
  end if;
end $$;

create index if not exists hc_cases_user_idx on public.hc_cases(user_id) where user_id is not null;
create index if not exists hc_cases_kontrak_idx on public.hc_cases(kontrak_id) where kontrak_id is not null;
