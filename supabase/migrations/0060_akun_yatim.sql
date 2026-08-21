-- Akun login yang tidak punya profil karyawan.
--
-- Mereka lolos ke Supabase Auth tapi tidak bisa masuk aplikasi, jadi pemiliknya
-- melihat "password ditolak" padahal passwordnya benar. Persis itu yang dialami
-- satu Head of HC selama berminggu-minggu: ia punya tiga alamat email, dua di
-- antaranya tanpa profil, dan tidak ada satu pun layar yang bisa menunjukkannya.
--
-- SECURITY DEFINER karena `auth.users` tidak terjangkau PostgREST biasa, dan
-- `search_path` dipatok supaya isi fungsinya tidak bisa dibelokkan lewat skema
-- bayangan. Hak jalannya dicabut dari `authenticated` juga — Supabase memberi
-- EXECUTE ke peran itu secara bawaan untuk setiap fungsi baru di skema public,
-- jadi mencabut dari `public` dan `anon` saja tidak cukup.
create or replace function public.gwg_akun_yatim()
returns table (email text, dibuat timestamptz, login_terakhir timestamptz)
language sql
security definer
set search_path = public, auth
as $$
  select au.email::text, au.created_at, au.last_sign_in_at
  from auth.users au
  where not exists (
    select 1 from public.users u where lower(u.email) = lower(au.email)
  )
  order by au.last_sign_in_at desc nulls last, au.created_at desc
$$;

revoke all on function public.gwg_akun_yatim() from public, anon, authenticated;
grant execute on function public.gwg_akun_yatim() to service_role;
