-- HC-MOS — Kontrak Tracker (PKWT/PKWTT) & Update Bulanan Supervisor.
--
-- Menggantikan berkas HTML statis yang menyimpan datanya di window.storage:
-- penyimpanan itu hanya hidup di dalam Claude, sehingga di hosting sendiri
-- tombol simpannya mati dan 60 supervisor tidak bisa memakainya dari HP
-- masing-masing. Di sini datanya nyata: satu tabel karyawan kontrak, satu
-- tabel laporan bulanan, keduanya bersandar pada outlet yang sudah ada.

-- Karyawan outlet beserta kontraknya.
--
-- Status kontrak, durasi, sisa hari, dan masa kerja SENGAJA tidak disimpan —
-- semuanya dihitung dari tanggal saat dibaca (lihat src/lib/hcmos/kontrak.ts).
-- Menyimpannya berarti status "Aktif" tetap tertulis aktif berbulan-bulan
-- setelah kontraknya lewat, dan tidak ada yang tahu sampai timbul masalah.
create table if not exists public.hc_contracts (
  id uuid primary key default gen_random_uuid(),
  outlet_id text not null references public.outlets (id) on delete cascade,

  -- Identitas karyawan
  nip text,
  nama text not null,
  jabatan text,

  -- Data kontrak
  no_kontrak text,
  jenis text check (jenis in ('PKWT', 'PKWTT')),
  tgl_mulai date,
  tgl_berakhir date,
  kontrak_ke int not null default 1,
  prioritas_renewal text not null default 'normal'
    check (prioritas_renewal in ('normal', 'penting', 'mendesak')),

  -- Soft file & lampiran
  link_kontrak text,
  link_ktp text,
  link_foto text,
  catatan text,

  -- Riwayat & masa kerja
  tgl_masuk_pertama date,

  -- Turnover
  tgl_resign date,
  kategori_turnover text,
  alasan_keluar text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text
);

-- Hampir semua kueri bertumpu pada satu outlet: portal supervisor, daftar
-- karyawan, dan rekap per outlet.
create index if not exists hc_contracts_outlet_idx on public.hc_contracts (outlet_id);
-- Pemantauan kontrak yang akan berakhir menyaring lewat tanggal berakhir.
create index if not exists hc_contracts_berakhir_idx on public.hc_contracts (tgl_berakhir)
  where tgl_resign is null;

-- Laporan wajib bulanan tiap outlet.
--
-- Satu outlet satu baris per periode — pengisian ulang MEMPERBARUI laporan yang
-- sama, bukan menumpuk baris baru. Tanpa itu, "berapa outlet yang sudah lapor
-- bulan ini" akan terhitung dari jumlah baris dan langsung salah begitu ada
-- supervisor yang mengirim dua kali.
create table if not exists public.hc_monthly_updates (
  id uuid primary key default gen_random_uuid(),
  outlet_id text not null references public.outlets (id) on delete cascade,
  periode text not null,
  jumlah_karyawan int not null default 0,
  catatan text,
  dilaporkan_oleh text,
  dilaporkan_oleh_nama text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (outlet_id, periode)
);

create index if not exists hc_monthly_updates_periode_idx on public.hc_monthly_updates (periode);

alter table public.hc_contracts enable row level security;
alter table public.hc_monthly_updates enable row level security;

comment on table public.hc_contracts is
  'HC-MOS Kontrak Tracker: karyawan outlet beserta PKWT/PKWTT-nya. Status & durasi dihitung dari tanggal, tidak disimpan.';
comment on table public.hc_monthly_updates is
  'HC-MOS Update Bulanan: laporan wajib supervisor outlet, satu baris per outlet per periode.';
