-- HC-MOS — tabel untuk pilar yang tersisa.
--
-- Yang TIDAK disimpan di sini sama pentingnya dengan yang disimpan: kelulusan
-- Fast Start, take-home pay, skor kinerja, dan status masa berlaku semuanya
-- DIHITUNG saat dibaca. Menyimpan hasil hitungan berarti mengubah aturannya
-- (ambang lulus, bobot aspek) menuntut menulis ulang seluruh baris lama — dan
-- baris yang tidak ikut ditulis ulang jadi salah tanpa ada yang tahu.

create table if not exists public.hc_training_records (
  id uuid primary key default gen_random_uuid(),
  nama text not null,
  outlet_id text references public.outlets (id) on delete set null,
  program text not null default 'fast_start' check (program in ('fast_start', 'fast_track')),
  batch text,
  materi text,
  pre_test numeric,
  role_play numeric,
  post_test numeric,
  tanggal date,
  catatan text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text
);
create index if not exists hc_training_program_idx on public.hc_training_records (program, batch);

create table if not exists public.hc_competency (
  id uuid primary key default gen_random_uuid(),
  nama text not null,
  jabatan text,
  scope text not null default 'manajemen' check (scope in ('manajemen', 'outlet')),
  kompetensi text not null,
  level_standar int not null default 3 check (level_standar between 1 and 5),
  level_aktual int not null default 1 check (level_aktual between 1 and 5),
  catatan text,
  updated_at timestamptz not null default now(),
  updated_by text
);
create index if not exists hc_competency_nama_idx on public.hc_competency (nama);

-- Penilaian kinerja & appraisal review dalam satu baris: peninjauan adalah sesi
-- atas penilaian yang sama, bukan penilaian kedua yang berdiri sendiri.
create table if not exists public.hc_reviews (
  id uuid primary key default gen_random_uuid(),
  nama text not null,
  jabatan text,
  scope text not null default 'manajemen' check (scope in ('manajemen', 'outlet')),
  outlet_id text references public.outlets (id) on delete set null,
  periode text not null,
  penilai text,
  nilai jsonb not null default '{}'::jsonb,
  catatan text,
  status text not null default 'draf' check (status in ('draf', 'selesai', 'ditinjau')),
  tgl_review date,
  hasil_review text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text
);
create index if not exists hc_reviews_periode_idx on public.hc_reviews (periode);

create table if not exists public.hc_career_paths (
  id uuid primary key default gen_random_uuid(),
  jabatan text not null,
  level int not null default 1,
  scope text not null default 'manajemen' check (scope in ('manajemen', 'outlet')),
  jabatan_berikutnya text,
  syarat text,
  masa_minimum_bulan int,
  updated_at timestamptz not null default now(),
  updated_by text
);

create table if not exists public.hc_succession (
  id uuid primary key default gen_random_uuid(),
  posisi text not null,
  pemegang text,
  kandidat text,
  kesiapan text not null default 'perlu_dikembangkan'
    check (kesiapan in ('siap_sekarang', 'siap_1_tahun', 'perlu_dikembangkan')),
  catatan text,
  updated_at timestamptz not null default now(),
  updated_by text
);

create table if not exists public.hc_leaves (
  id uuid primary key default gen_random_uuid(),
  nama text not null,
  scope text not null default 'manajemen' check (scope in ('manajemen', 'outlet')),
  outlet_id text references public.outlets (id) on delete set null,
  jenis text not null default 'cuti' check (jenis in ('cuti', 'izin', 'sakit', 'alpa')),
  tgl_mulai date not null,
  tgl_selesai date not null,
  alasan text,
  status text not null default 'diajukan' check (status in ('diajukan', 'disetujui', 'ditolak')),
  disetujui_oleh text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text
);
create index if not exists hc_leaves_tanggal_idx on public.hc_leaves (tgl_mulai desc);

-- Take-home pay TIDAK disimpan — dihitung dari komponennya, supaya tidak
-- mungkin ada baris yang jumlahnya tidak cocok dengan isinya.
create table if not exists public.hc_payroll (
  id uuid primary key default gen_random_uuid(),
  periode text not null,
  nama text not null,
  scope text not null default 'manajemen' check (scope in ('manajemen', 'outlet')),
  outlet_id text references public.outlets (id) on delete set null,
  gaji_pokok numeric not null default 0,
  tunjangan numeric not null default 0,
  lembur numeric not null default 0,
  potongan numeric not null default 0,
  catatan text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text,
  unique (periode, nama)
);
create index if not exists hc_payroll_periode_idx on public.hc_payroll (periode);

create table if not exists public.hc_benefits (
  id uuid primary key default gen_random_uuid(),
  nama text not null,
  scope text not null default 'manajemen' check (scope in ('manajemen', 'outlet')),
  outlet_id text references public.outlets (id) on delete set null,
  bpjs_kesehatan text,
  bpjs_tk text,
  status text not null default 'terdaftar' check (status in ('terdaftar', 'proses', 'belum')),
  tgl_daftar date,
  catatan text,
  updated_at timestamptz not null default now(),
  updated_by text
);

create table if not exists public.hc_salary_grades (
  id uuid primary key default gen_random_uuid(),
  golongan text not null,
  jabatan text,
  scope text not null default 'manajemen' check (scope in ('manajemen', 'outlet')),
  gaji_min numeric not null default 0,
  gaji_max numeric not null default 0,
  tunjangan text,
  updated_at timestamptz not null default now(),
  updated_by text
);

-- Kasus hubungan industrial & proses keluar karyawan: satu tabel, dibedakan
-- `jenis`. Keduanya perkara yang dibuka, ditangani, lalu ditutup, dengan bidang
-- yang sama persis.
create table if not exists public.hc_cases (
  id uuid primary key default gen_random_uuid(),
  jenis text not null default 'kasus' check (jenis in ('kasus', 'offboarding')),
  nama text not null,
  jabatan text,
  scope text not null default 'manajemen' check (scope in ('manajemen', 'outlet')),
  outlet_id text references public.outlets (id) on delete set null,
  kategori text,
  tanggal date,
  ringkasan text,
  tindakan text,
  status text not null default 'terbuka' check (status in ('terbuka', 'proses', 'selesai')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text
);
create index if not exists hc_cases_jenis_idx on public.hc_cases (jenis, status);

alter table public.hc_training_records enable row level security;
alter table public.hc_competency enable row level security;
alter table public.hc_reviews enable row level security;
alter table public.hc_career_paths enable row level security;
alter table public.hc_succession enable row level security;
alter table public.hc_leaves enable row level security;
alter table public.hc_payroll enable row level security;
alter table public.hc_benefits enable row level security;
alter table public.hc_salary_grades enable row level security;
alter table public.hc_cases enable row level security;
