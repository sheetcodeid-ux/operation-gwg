-- Penilaian terhadap YANG MEMINTA design, diisi saat hasilnya di-ACC.
--
-- Satu baris per permintaan, bukan per penilai: yang menilai hanya satu orang
-- (yang meng-ACC hasil akhir), dan itu disengaja. Penilai yang berbeda-beda
-- membuat angka antar-outlet tidak bisa dibandingkan sama sekali.
--
-- Yang DISIMPAN di sini hanya ceklis faktanya. Selisih hari — bagian terbesar
-- skornya — TIDAK disimpan: ia dihitung ulang dari `hc_requests.created_at` dan
-- `planned_date` setiap kali dibaca. Menyimpannya berarti menyimpan angka yang
-- bisa berbeda dari sumbernya begitu tanggalnya diperbaiki, dan angka yang
-- tidak cocok dengan sumbernya adalah angka yang akan diperdebatkan.

create table if not exists public.design_request_penilaian (
  request_id     text primary key references public.hc_requests(id) on delete cascade,
  tujuan_jelas   boolean not null default false,
  ukuran_media   boolean not null default false,
  materi_lengkap boolean not null default false,
  tanggal_tayang boolean not null default false,
  catatan        text,
  dinilai_oleh   text not null,
  dinilai_nama   text not null,
  dinilai_pada   timestamptz not null default now()
);

alter table public.design_request_penilaian enable row level security;
