-- Matriks RACI yang bisa disunting Human Capital sendiri.
--
-- Sebelumnya seluruh matriks tertulis sebagai kode di `lib/hcmos/pillars.ts`,
-- jadi mengganti satu nama penanggung jawab menuntut penempatan ulang
-- aplikasi. Penanggung jawab berpindah jauh lebih sering daripada kode
-- seharusnya berubah — dan sepanjang belum ditempatkan ulang, matriks yang
-- dibaca orang menyebut nama yang sudah tidak memegangnya lagi.
--
-- Yang disimpan di sini HANYA yang berbeda dari matriks Juknis, bukan salinan
-- seluruh matriks. Bedanya menentukan: saat Juknis bertambah pilar atau
-- sub-menu, baris barunya langsung muncul membawa RACI bawaannya. Kalau
-- seluruh matriks disalin ke tabel, setiap penambahan di Juknis akan
-- meninggalkan baris kosong yang tidak ada yang tahu harus diisi siapa.
--
-- Itu juga berarti susunan asli Juknis tidak pernah hilang: menghapus baris di
-- sini mengembalikan sel itu ke bawaannya, apa pun yang sudah terjadi padanya.

create table if not exists public.hc_raci (
  pilar_slug  text not null,
  sub_slug    text not null,
  peran       text not null check (peran in ('R', 'A', 'C', 'I')),
  -- Ditulis apa adanya seperti matriks aslinya — "Uswatun, Head of Operation".
  -- Nama dipisah koma dan diuraikan di aplikasi, bukan disimpan sebagai tabel
  -- penghubung: sebagian pemegang peran bukan akun ("Seluruh Karyawan",
  -- "Karyawan Bersangkutan"), jadi memaksanya menunjuk baris users akan
  -- membuang justru bagian yang paling sering dibaca.
  pemegang    text not null,
  updated_at  timestamptz not null default now(),
  updated_by  text references public.users(id) on delete set null,
  primary key (pilar_slug, sub_slug, peran)
);

create index if not exists hc_raci_pilar_idx on public.hc_raci (pilar_slug);

-- Seluruh pembacaan dan penulisan lewat lapisan server yang memakai service
-- role dan memeriksa hak akses HC lebih dulu. Tidak ada kebijakan untuk peran
-- anon maupun authenticated: matriks ini menyebut nama orang beserta apa yang
-- ditanggungnya, dan tidak ada alasan ia bisa dibaca langsung dari peramban.
alter table public.hc_raci enable row level security;

comment on table public.hc_raci is
  'Suntingan matriks RACI HC-MOS. Hanya memuat sel yang BERBEDA dari matriks Juknis di lib/hcmos/pillars.ts; sel tanpa baris di sini memakai bawaan Juknis.';
