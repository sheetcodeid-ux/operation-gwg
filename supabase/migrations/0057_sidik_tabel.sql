-- Sidik perubahan per tabel — dipakai aplikasi untuk tahu tabel mana yang
-- BERUBAH sejak pembacaan terakhir, tanpa menarik isinya.
--
-- Latar belakangnya: hidrasi menarik seluruh isi enam tabel setiap kali
-- singgahannya kedaluwarsa, entah datanya berubah atau tidak. Sebagian besar
-- waktu tidak ada yang berubah — dan menarik 1,5 MB untuk menemukan bahwa
-- tidak ada yang berubah adalah cara termahal untuk tidak melakukan apa-apa.
-- Egress inilah yang menghabiskan 38,5 GB dari jatah 5 GB dan mematikan
-- produksi pada 20 Agustus 2026.
--
-- Postgres sudah menghitung berapa baris disisipkan, diubah, dan dihapus per
-- tabel. Gabungan ketiganya jadi sidik: sidik sama berarti tidak ada satu pun
-- baris yang berpindah.
--
-- Kenapa pencacah, bukan `max(updated_at)`: sebagian tabel tidak punya kolom
-- itu sama sekali, dan menambahkannya berarti mengubah sepuluh skema plus
-- memasang pemicu di masing-masing. Pencacah menangkap SEMUA bentuk perubahan
-- — sisip, ubah, hapus — tanpa menyentuh satu pun tabel.
--
-- Fungsinya TIDAK mengembalikan satu pun data pengguna: hanya nama tabel dan
-- tiga angka. Hak jalannya pun dicabut dari `public` dan `anon`.
create or replace function public.gwg_sidik_tabel()
returns table (tabel text, sidik text)
language sql
stable
security definer
set search_path = ''
as $$
  select s.relname::text,
         s.n_tup_ins || '-' || s.n_tup_upd || '-' || s.n_tup_del
  from pg_catalog.pg_stat_user_tables s
  where s.schemaname = 'public'
    and s.relname in (
      'hospitality', 'tasks', 'events', 'hygiene', 'complaints',
      'notifications', 'users', 'credentials', 'areas', 'outlets'
    );
$$;

comment on function public.gwg_sidik_tabel() is
  'Pencacah perubahan per tabel untuk hidrasi bersyarat. Tidak mengembalikan data pengguna.';

-- `authenticated` disebut TERPISAH dari `public` karena Supabase memberi hak
-- jalan ke peran itu secara bawaan untuk fungsi baru di skema public. Mencabut
-- dari `public` saja tidak cukup — hak bawaannya tetap tertinggal, dan database
-- linter menandainya sebagai fungsi SECURITY DEFINER yang bisa dijalankan
-- pengguna yang sudah login. Fungsinya memang tidak mengembalikan data
-- pengguna, tapi hak yang tidak dipakai tetap sebaiknya tidak diberikan.
revoke all on function public.gwg_sidik_tabel() from public, anon, authenticated;
grant execute on function public.gwg_sidik_tabel() to service_role;
