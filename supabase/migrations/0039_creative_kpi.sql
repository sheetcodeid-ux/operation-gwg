-- KPI Creative — Social Media.
--
-- Delapan indikator berbobot dari dua sumber. Empat indikator (jumlah konten
-- Post/Reels/Story + Kecepatan & Ketepatan) dihitung langsung dari tabel
-- `hc_requests` yang sudah ada — tidak perlu tabel baru dan tidak perlu input
-- tangan. Empat sisanya berasal dari Instagram dan disimpan di sini.

-- Angka Instagram per bulan.
--
-- Diisi tangan dulu; kolomnya sengaja disusun mengikuti nama metrik Instagram
-- Graph API supaya penyambungan otomatis nanti tidak perlu memindahkan data:
--   likes+comments+shares+saves -> total_interactions
--   follower_growth             -> follower_count
--   views                       -> views   (menggantikan impressions, Apr 2025)
--   profile_visits              -> profile_views
--
-- CATATAN PENTING: Meta hanya menyimpan data insight 90 HARI. Tabel inilah yang
-- menjadi arsip permanennya — tanpa ini, target "bulan lalu + 10%" kehilangan
-- baseline-nya begitu lewat tiga bulan.
create table if not exists public.creative_sosmed_metrics (
  period          text not null,              -- 'YYYY-MM'
  -- Disiapkan untuk akun Instagram per brand (Nordu, Cattu, …). Kosong berarti
  -- satu akun gabungan; ikut di kunci primer supaya menambah brand nanti tidak
  -- perlu mengubah kunci tabel yang sudah berisi data.
  brand           text not null default '',
  likes           integer not null default 0,
  comments        integer not null default 0,
  shares          integer not null default 0,
  saves           integer not null default 0,
  follower_growth integer not null default 0, -- PERTAMBAHAN BERSIH, bukan total
  views           integer not null default 0,
  profile_visits  integer not null default 0,
  -- 'manual' | 'instagram' — supaya angka hasil tarikan API tidak tertimpa
  -- input tangan tanpa disadari, dan sebaliknya.
  source          text not null default 'manual',
  updated_by      text,
  updated_at      timestamptz not null default now(),
  primary key (period, brand)
);

alter table public.creative_sosmed_metrics enable row level security;

-- Pengaturan: siapa anggota tim sosmed + bobot tiap indikator.
--
-- Satu baris ('default'), sama polanya dengan `op_settings`. Bobot disimpan
-- sebagai data, bukan konstanta di kode, karena jumlah bobot yang diminta
-- sekarang 90% dan sisanya masih akan ditentukan.
create table if not exists public.creative_kpi_settings (
  id         text primary key default 'default',
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.creative_kpi_settings enable row level security;
