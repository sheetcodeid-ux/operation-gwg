-- HPP Produksi — kalkulator biaya untuk gudang (Supply Chain).
--
-- Tabel TERPISAH dari hpp_calculations, dan itu disengaja. Bentuknya mirip,
-- tapi isinya menjawab pertanyaan yang berbeda:
--
--   hpp_calculations : menu yang DIJUAL ke pelanggan — punya harga jual,
--                      margin, kelas harga, dan target omset.
--   produksi_hpp     : barang yang DIPRODUKSI gudang lalu dikirim ke outlet —
--                      tidak dijual, jadi tidak punya satu pun dari itu.
--
-- Menumpangkannya di satu tabel berarti separuh kolomnya selalu kosong pada
-- setiap baris, dan setiap kueri harus ingat baris mana yang boleh dibaca
-- kolom mana. Itu bukan penghematan, itu jebakan yang menunggu.

create table if not exists public.produksi_hpp (
  id            text primary key,
  nama          text not null,
  kategori      text not null default 'lainnya',
  -- batch = sekali masak menghasilkan banyak; satuan = dihitung per 1 unit.
  mode          text not null default 'batch',
  hasil         numeric not null default 0,
  hasil_unit    text not null default 'pcs',
  -- Penyusutan saat diproses, persen. Ayam mentah 10 kg tidak jadi 10 kg ayam
  -- ungkep; tanpa kolom ini HPP per potong selalu terlihat lebih murah.
  susut_pct     numeric not null default 0,
  bahan         jsonb not null default '[]'::jsonb,
  overhead      jsonb not null default '[]'::jsonb,
  catatan       text,
  -- Hasil hitungan ikut disimpan supaya daftar dan rekap tidak perlu
  -- menghitung ulang seluruh resep hanya untuk menampilkan satu angka.
  biaya_bahan    numeric not null default 0,
  biaya_overhead numeric not null default 0,
  total_batch    numeric not null default 0,
  hpp_per_unit   numeric not null default 0,
  created_by    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.produksi_hpp
  drop constraint if exists produksi_hpp_mode_check;
alter table public.produksi_hpp
  add constraint produksi_hpp_mode_check check (mode in ('batch', 'satuan'));

-- Penyusutan di luar 0–100 tidak punya arti. Dibatasi di basis data, bukan
-- hanya di formulir: kiriman bisa datang dari mana saja, dan batas yang cuma
-- ada di layar bukan batas.
alter table public.produksi_hpp
  drop constraint if exists produksi_hpp_susut_check;
alter table public.produksi_hpp
  add constraint produksi_hpp_susut_check check (susut_pct >= 0 and susut_pct <= 100);

create index if not exists produksi_hpp_created_idx on public.produksi_hpp (created_at desc);
create index if not exists produksi_hpp_nama_idx on public.produksi_hpp (lower(nama));

-- Selaras dengan seluruh tabel lain: akses hanya lewat service role di server.
alter table public.produksi_hpp enable row level security;
