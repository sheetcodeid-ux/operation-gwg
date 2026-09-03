-- Modul Key Performance Indicator — enam departemen, sepuluh posisi.
--
-- YANG DISIMPAN HANYA YANG TIDAK BISA DIHITUNG ULANG. Target, persentase, dan
-- skor tidak punya kolom di mana pun: ketiganya diturunkan dari bobot, entri,
-- dan angka actual setiap kali dibaca. Menyimpannya berarti menyimpan angka
-- yang bisa berbeda dari sumbernya begitu satu entri diperbaiki — dan angka
-- yang tidak cocok dengan sumbernya jadi bahan perdebatan, bukan bahan
-- evaluasi.
--
-- Periode selalu 'YYYY-MM'. Posisi memakai kode dari `src/lib/kpi/struktur.ts`.

-- Bobot & target yang menimpa bawaan kode. Baris yang tidak ada = pakai bawaan.
create table if not exists public.kpi_pengaturan (
  posisi       text not null,
  indikator    text not null,
  bobot        numeric,
  target       numeric,
  pertumbuhan  numeric,
  diubah_oleh  text,
  diubah_nama  text,
  diubah_pada  timestamptz not null default now(),
  primary key (posisi, indikator)
);

-- Angka yang memang harus diketik: metrik sosial media, capaian Marcomm yang
-- sumber otomatisnya belum tersambung, penilaian kecepatan & ketepatan.
-- `brand` kosong berarti bukan angka per brand.
create table if not exists public.kpi_actual (
  periode    text not null,
  posisi     text not null,
  indikator  text not null,
  brand      text not null default '',
  nilai      numeric not null default 0,
  catatan    text,
  bukti      jsonb not null default '[]'::jsonb,
  diisi_oleh text,
  diisi_nama text,
  diisi_pada timestamptz not null default now(),
  primary key (periode, posisi, indikator, brand)
);

-- Entri form yang jumlah barisnya menjadi angka KPI: kunjungan quality control,
-- riset menu, event, faktur pajak, penyampaian data, temuan Head, pelunasan.
create table if not exists public.kpi_entri (
  id                 text primary key,
  jenis              text not null,
  periode            text not null,
  posisi             text not null,
  tanggal            date not null,
  pic_id             text,
  pic_nama           text,
  outlet_id          text,
  judul              text,
  deskripsi          text,
  nominal            numeric,
  nominal_seharusnya numeric,
  tenggat            date,
  -- Penanda gagal: telat mengirim, atau nilai faktur tidak sesuai. Inilah yang
  -- mengurangi capaian pada indikator berbentuk pengurang.
  gagal              boolean not null default false,
  lampiran           jsonb not null default '[]'::jsonb,
  dibuat_oleh        text,
  dibuat_nama        text,
  dibuat_pada        timestamptz not null default now()
);
create index if not exists kpi_entri_periode_idx on public.kpi_entri (periode, posisi, jenis);

-- Realisasi beban operasional per outlet. Target dan budget-nya dihitung dari
-- rata-rata net sales 3 bulan terakhir, jadi tidak ikut disimpan.
create table if not exists public.kpi_efisiensi (
  periode       text not null,
  posisi        text not null,
  outlet_id     text not null,
  actual_wh     numeric,
  actual_non_wh numeric,
  diisi_oleh    text,
  diisi_pada    timestamptz not null default now(),
  primary key (periode, posisi, outlet_id)
);

-- Ceklis kesesuaian Invoice Management Fee, satu baris per outlet per bulan.
-- Sengaja berkunci periode: ceklis bulan lalu tidak boleh terbawa ke bulan ini.
create table if not exists public.kpi_fee (
  periode    text not null,
  outlet_id  text not null,
  sesuai     boolean not null default false,
  catatan    text,
  diisi_oleh text,
  diisi_pada timestamptz not null default now(),
  primary key (periode, outlet_id)
);

-- Menu yang dinilai pada indikator Keberhasilan Pasar. Penjualannya ditarik
-- dari ESB, jadi yang disimpan hanya pilihan menunya.
create table if not exists public.kpi_menu_pasar (
  periode   text not null,
  posisi    text not null,
  menu      text not null,
  dipilih_oleh text,
  dipilih_pada timestamptz not null default now(),
  primary key (periode, posisi, menu)
);

-- Penguncian bulan. Setelah dikunci, angkanya tidak berubah lagi di belakang
-- hari — dan pembukaannya kembali tercatat siapa dan kapan.
create table if not exists public.kpi_periode (
  periode      text not null,
  posisi       text not null,
  dikunci      boolean not null default false,
  dikunci_oleh text,
  dikunci_nama text,
  dikunci_pada timestamptz,
  primary key (periode, posisi)
);

alter table public.kpi_pengaturan enable row level security;
alter table public.kpi_actual     enable row level security;
alter table public.kpi_entri      enable row level security;
alter table public.kpi_efisiensi  enable row level security;
alter table public.kpi_fee        enable row level security;
alter table public.kpi_menu_pasar enable row level security;
alter table public.kpi_periode    enable row level security;

-- Penjualan menu Keberhasilan Pasar diisi manual dulu; kolomnya disiapkan
-- sekarang supaya bentuk barisnya tidak berubah saat penarikan dari ESB
-- dipasang — yang berganti cuma dari mana angkanya datang.
alter table public.kpi_menu_pasar add column if not exists penjualan numeric;
alter table public.kpi_menu_pasar add column if not exists omset numeric;
