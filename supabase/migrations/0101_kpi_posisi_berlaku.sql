-- Sejak kapan sebuah posisi mulai dinilai.
--
-- MASALAH YANG DIPECAHKAN. Posisi baru dibuat pertengahan jalan — Online
-- Delivery Officer, misalnya, KPI-nya berlaku mulai September. Pada bulan
-- Agustus posisi itu belum punya data sama sekali, tapi tetap ikut dihitung
-- sebagai anggota departemennya: rata-rata Operational turun, dan KPI
-- Manajemen ikut turun, gara-gara orang yang bulan itu memang belum dinilai.
--
-- Disimpan sebagai BULAN MULAI, bukan sakelar nyala-mati. Sakelar menuntut
-- seseorang ingat menyalakannya lagi tepat pada bulan yang benar; kalau lupa,
-- September ikut hilang dan tidak ada yang memberi tahu. Bulan mulai ditetapkan
-- sekali dan benar selamanya, ke depan maupun ke belakang.
--
-- `berlaku_mulai` kosong berarti BERLAKU SEJAK KAPAN PUN — itu keadaan seluruh
-- posisi yang sudah ada, dan tidak boleh berubah hanya karena tabel ini dibuat.
-- `aktif = false` menghentikan penilaiannya sama sekali, untuk posisi yang
-- ditiadakan.
create table if not exists public.kpi_posisi_setelan (
  posisi text primary key,
  aktif boolean not null default true,
  berlaku_mulai text,
  -- TEXT, bukan uuid. Id pengguna di aplikasi ini berbentuk "usr_001"; tujuh
  -- tabel KPI lainnya sudah menyimpannya sebagai text. Dibuat uuid, setiap
  -- penyimpanan gagal dengan pesan Postgres apa adanya di layar pengguna:
  -- invalid input syntax for type uuid: "usr_001".
  diubah_oleh text,
  diubah_nama text,
  diubah_pada timestamptz not null default now()
);

-- Sama seperti seluruh tabel lain di proyek ini: RLS menyala tanpa satu pun
-- policy, sehingga hanya service role yang bisa menyentuhnya.
alter table public.kpi_posisi_setelan enable row level security;
